/**
 * useCapture — manages the full capture session (OldLunar + PairSnap share this).
 *
 * TIMING CONTRACT
 *   countdown 5 → 4 → 3 → 2 → 1 → the frame is grabbed in the SAME tick the countdown ends.
 *   - There is no timeout, flash wait or "next video frame" wait between "0" and the grab.
 *   - The countdown is timestamp-based (one deadline per shot), so it does not drift.
 *   - The captured photo appears on screen in the SAME tick (instant JPEG preview of the grabbed frame).
 *   - The full-quality PNG is encoded in the background and swapped in seamlessly (never blocks a countdown).
 *   - The flash and sounds also happen AFTER the frame is grabbed.
 *   - The only pause (PAUSE_BETWEEN_SHOTS_MS) sits between "photo stored" and the NEXT countdown.
 *   - The camera is never restarted between shots.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { grabFrame, canvasToBlob, previewURL, preDecode, isVideoReady, waitForFrame } from '../utils/canvas.js';
import { playBeep, playShutter, playSuccess } from '../utils/sounds.js';

export const CS = { IDLE:'idle', COUNTDOWN:'countdown', FLASH:'flash', PROCESSING:'processing', DONE:'done' };
export const PHOTO_COUNTS = [1, 3, 4, 6];
export const TIMER_OPTIONS = [3, 5, 7, 10, 15];   // seconds of countdown before EACH photo
export const DEFAULT_TIMER = 5;
export const DEFAULT_COUNT = 3;
export const CAPTURE_DELAY_MS = 0;          // extra delay after the countdown ends — must stay 0
export const PAUSE_BETWEEN_SHOTS_MS = 500;  // 0–500 ms, applied BEFORE the next countdown only
const FLASH_MS = 180;

/**
 * @param videoRef  the live <video>
 * @param gateRef   optional ref whose `.current` is true while the camera is being swapped (front/rear).
 *                  The countdown keeps running; only the frame grab waits (max 3 s) for the new stream.
 */
export function useCapture(videoRef, gateRef = null) {
  const [captureState,   setCS]       = useState(CS.IDLE);
  const [countdown,      setCountdown] = useState(null);
  const [currentShot,    setShot]      = useState(0);
  const [photos,         setPhotos]    = useState([]); // PNG Blobs
  const [photoUrls,      setUrls]      = useState([]); // object URLs for preview
  const [isFlashing,     setFlashing]  = useState(false);
  const [error,          setError]     = useState(null);

  const busy      = useRef(false);
  const photosRef = useRef([]);     // always-current copy of blobs (state can lag behind async loops)
  const urlsRef   = useRef([]);
  const runId     = useRef(0);      // bumped on start / cancel / reset so stale loops stop
  const waitTimer = useRef(null);   // the single pending countdown/pause timer
  const wakeWait  = useRef(null);
  const flashTimer = useRef(null);
  const skipRef    = useRef(false); // set by skip(): the running countdown ends now and the frame is grabbed

  /** Cancellable sleep — cancel()/reset() clear the timer and release the loop immediately. */
  const wait = useCallback(ms => new Promise(resolve => {
    wakeWait.current = resolve;
    waitTimer.current = setTimeout(() => { waitTimer.current = null; wakeWait.current = null; resolve(); }, ms);
  }), []);
  const abortWait = useCallback(() => {
    if (waitTimer.current) { clearTimeout(waitTimer.current); waitTimer.current = null; }
    const w = wakeWait.current; wakeWait.current = null; w?.();
  }, []);
  const flash = useCallback(() => {
    setFlashing(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashing(false), FLASH_MS); // never awaited
  }, []);

  /** Countdown from `from` seconds using ONE deadline. Resolves true the moment it reaches zero. */
  const runCountdown = useCallback(async (from, soundEnabled, live) => {
    setCS(CS.COUNTDOWN);
    const endAt = performance.now() + from * 1000;
    let shown = null;
    for (;;) {
      if (!live()) return false;
      if (skipRef.current) return true;                // skip(): grab right away
      const remaining = endAt - performance.now();
      if (remaining <= 0) return true;                 // → caller grabs the frame right now
      const value = Math.ceil(remaining / 1000);
      if (value !== shown) { shown = value; setCountdown(value); playBeep(value, soundEnabled); }
      await wait(Math.max(1, remaining - (value - 1) * 1000)); // sleep to the next displayed number
    }
  }, [wait]);

  /**
   * Grab the frame NOW (synchronous) and return it with an instant preview URL.
   * Nothing here awaits encoding — the caller shows the preview immediately.
   */
  const captureNow = useCallback(async (soundEnabled) => {
    const video = videoRef.current;
    // Camera switch in progress: the clock is NOT paused, we only wait for the new stream to deliver a frame.
    for (let waited = 0; gateRef?.current && waited < 3000; waited += 40) await new Promise(r => setTimeout(r, 40));
    let frame;
    try { frame = grabFrame(video); }
    catch { await waitForFrame(video, 1500); frame = grabFrame(video); } // only if the stream stalled
    // ── frame is secured; nothing below can delay or alter it ──
    setCS(CS.FLASH); setCountdown(null); flash(); playShutter(soundEnabled);
    return { frame, preview: previewURL(frame) };
  }, [videoRef, gateRef, flash]);

  /** Background: encode the full-quality PNG, pre-decode it, and swap it in for the preview. */
  const finalizeShot = useCallback(async (frame, preview) => {
    const blob = await canvasToBlob(frame);
    const url = URL.createObjectURL(blob);
    await preDecode(url);
    const idx = urlsRef.current.indexOf(preview);
    if (idx < 0) { URL.revokeObjectURL(url); return; } // reset() already discarded this slot
    const nb = [...photosRef.current]; nb[idx] = blob;
    const nu = [...urlsRef.current];   nu[idx] = url;
    photosRef.current = nb; urlsRef.current = nu;
    setPhotos(nb); setUrls(nu);
  }, []);

  /**
   * Start a full capture session or retake a single slot.
   * @param {{ timerSecs, photoCount, soundEnabled, retakeIndex, resume, pauseMs }} opts
   */
  const start = useCallback(async ({ timerSecs=5, photoCount=3, soundEnabled=true, retakeIndex=null, resume=false, pauseMs=PAUSE_BETWEEN_SHOTS_MS }) => {
    if (busy.current) return;                // one controller per sequence, no duplicate captures
    busy.current = true;
    skipRef.current = false;
    const id = ++runId.current;
    const live = () => runId.current === id;

    setError(null);
    try {
      const isRetake = retakeIndex !== null;
      const slots    = isRetake ? 1 : photoCount;

      // The camera must be producing real frames BEFORE the first countdown starts.
      if (!isVideoReady(videoRef.current)) await waitForFrame(videoRef.current, 3000);
      if (!live()) return;

      // resume = keep the photos already taken and continue from the first missing slot
      const startAt = (!isRetake && resume) ? Math.min(photosRef.current.length, photoCount) : 0;
      if (!isRetake && startAt === 0) {
        urlsRef.current.forEach(u => u && URL.revokeObjectURL(u));
        photosRef.current = []; urlsRef.current = [];
        setPhotos([]); setUrls([]); setShot(0);
      }

      const pending = [];   // background PNG encodes

      for (let i=startAt; i<slots; i++) {
        if (!live()) break;
        const shotNum = isRetake ? retakeIndex+1 : i+1;
        setShot(shotNum);

        const ok = await runCountdown(timerSecs, soundEnabled, live);
        if (!ok || !live()) break;
        if (CAPTURE_DELAY_MS > 0) await wait(CAPTURE_DELAY_MS); // 0 by default: skipped

        const { frame, preview } = await captureNow(soundEnabled);
        if (!live()) break;

        // Show the captured photo IMMEDIATELY (preview), then upgrade it to the PNG in the background.
        if (isRetake) {
          const old = urlsRef.current[retakeIndex];
          const nu = [...urlsRef.current]; nu[retakeIndex] = preview;
          urlsRef.current = nu; setUrls(nu);
          if (old && old.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(old), 2000);
        } else {
          photosRef.current = [...photosRef.current, null];
          urlsRef.current   = [...urlsRef.current, preview];
          setPhotos(photosRef.current); setUrls(urlsRef.current);
        }
        setCS(CS.IDLE);
        pending.push(finalizeShot(frame, preview));

        // Optional pause: sits between this photo and the NEXT countdown, never before a capture.
        if (i < slots-1 && pauseMs > 0) await wait(pauseMs);
      }

      if (!live()) return; // cancelled or reset: cancel()/reset() already restored state

      // The editor needs the real PNGs; this normally finished long ago (it ran during the pause / countdown).
      await Promise.all(pending);
      if (!live()) return;

      playSuccess(soundEnabled);
      setCS(CS.DONE);
    } catch (err) {
      console.error('Capture failed', err);
      if (live()) { setError('We could not take the photo. Please try again.'); setCS(CS.IDLE); setCountdown(null); setShot(0); }
    } finally {
      if (live()) { busy.current = false; }
    }
  }, [runCountdown, captureNow, finalizeShot, wait, videoRef]);

  const cancel = useCallback(() => {
    // setShot(0): without it `currentShot` stays > 0, the camera screen still thinks a sequence is running and the START button never comes back.
    runId.current++; busy.current = false; abortWait();
    setCountdown(null); setFlashing(false); setShot(0); setCS(CS.IDLE);
  }, [abortWait]);

  const clearError = useCallback(() => setError(null), []);

  /** Skip the rest of the current countdown and take the photo immediately. */
  const skip = useCallback(() => { skipRef.current = true; abortWait(); }, [abortWait]);

  useEffect(() => () => {
    runId.current++; abortWait(); clearTimeout(flashTimer.current);
    urlsRef.current.forEach(u => u && URL.revokeObjectURL(u));
  }, [abortWait]);

  /** Back to idle but KEEP the photos (used before retaking a single slot). */
  const rearm = useCallback(() => {
    runId.current++; busy.current = false; abortWait();
    setCountdown(null); setFlashing(false); setShot(0); setCS(CS.IDLE);
  }, [abortWait]);

  const reset = useCallback(() => {
    runId.current++; busy.current = false; abortWait();
    urlsRef.current.forEach(u => u && URL.revokeObjectURL(u));
    photosRef.current = []; urlsRef.current = [];
    setCS(CS.IDLE); setCountdown(null); setFlashing(false);
    setShot(0); setPhotos([]); setUrls([]); setError(null);
  }, [abortWait]);

  /** Keep blobs/urls in the order the user arranged them (so retake indexes stay correct). */
  const reorder = useCallback((newUrls) => {
    const order = newUrls.map(u => urlsRef.current.indexOf(u));
    if (order.some(i => i < 0) || order.length !== urlsRef.current.length) return;
    photosRef.current = order.map(i => photosRef.current[i]);
    urlsRef.current   = [...newUrls];
    setPhotos(photosRef.current); setUrls(urlsRef.current);
  }, []);

  return {
    reorder,
    captureState, countdown, currentShot,
    photos, photoUrls, isFlashing, error, clearError,
    isCapturing: captureState!==CS.IDLE && captureState!==CS.DONE,
    isBusy: busy.current,
    start, cancel, rearm, reset, skip,
  };
}