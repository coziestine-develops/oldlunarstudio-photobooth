import { useState, useEffect, useRef, useCallback } from 'react';

export const CAM = { IDLE:'idle', REQUESTING:'requesting', GRANTED:'granted', DENIED:'denied', ERROR:'error' };

/* Full HD target. Tried in order: ideal 1080p (16:9) → ideal 720p → anything.
   Constraints are never strict (no `min`/`exact` on size), so a camera that cannot do 1080p still starts. */
const FHD = { width: 1920, height: 1080 };

/* Default: the front camera on phones/tablets, the default webcam on laptops/desktops.
   Step 2 of the booth has a front/rear switch. Once permission is granted, a specific camera is opened by deviceId
   (no new permission prompt); `facing` is only used when no device id is known yet. */
const LABEL_BACK  = /back|rear|environment|world/i;
const LABEL_FRONT = /front|user|face|selfie/i;

function buildAttempts(deviceId, facing) {
  const base = deviceId ? { deviceId: { exact: deviceId } }
             : facing   ? { facingMode: { exact: facing } }
             :            { facingMode: 'user' };
  return [
    { ...base, width: { ideal: FHD.width }, height: { ideal: FHD.height }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30 } },
    { ...base, width: { ideal: 1280 }, height: { ideal: 720 } },
    deviceId ? { deviceId: { exact: deviceId } } : facing ? { facingMode: { ideal: facing } } : true,
  ];
}

const isTouchDevice = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function useCamera() {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const reqId     = useRef(0);      // latest request wins; older ones discard their stream
  const pending   = useRef(null);   // { key, promise } — an identical request already in flight is shared, never duplicated
  const [state, setState]           = useState(CAM.IDLE);
  const [error, setError]           = useState(null);
  const [devices, setDevices]       = useState([]);
  const [deviceId, setDeviceId]     = useState('');
  const [resolution, setResolution] = useState(null);   // { width, height }
  const [facing, setFacing]         = useState('user');   // 'user' (front) | 'environment' (rear) — what is on screen right now
  const [switching, setSwitching]   = useState(false);
  const [notice, setNotice]         = useState(null);     // non-fatal message (e.g. rear camera not available) — the preview stays up
  const switchingRef = useRef(false);                     // read by useCapture so a frame is never grabbed from a half-swapped stream
  const devicesRef   = useRef([]);
  const failRef      = useRef(null);                      // why the last switch attempt failed: 'denied' | 'busy' | 'missing'

  const attach = useCallback(stream => {
    streamRef.current = stream;
    const v = videoRef.current;
    if (v && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); }
    const track = stream.getVideoTracks()[0];
    const read = () => {
      const s = track?.getSettings?.() ?? {};
      if (s.width && s.height) setResolution({ width: s.width, height: s.height });
      return s;
    };
    const s = read();
    if (s.deviceId) setDeviceId(s.deviceId);
    // front/rear: trust the track first, then the device label, else keep the last known value
    const lbl = track?.label ?? '';
    if (s.facingMode === 'user' || s.facingMode === 'environment') setFacing(s.facingMode);
    else if (LABEL_BACK.test(lbl)) setFacing('environment');
    else if (LABEL_FRONT.test(lbl)) setFacing('user');
    // Came up below Full HD? Ask the track for it again (some cameras only switch after start).
    if (track && Math.max(s.width || 0, s.height || 0) < 1900 && track.applyConstraints) {
      track.applyConstraints({ width: { ideal: FHD.width }, height: { ideal: FHD.height }, frameRate: { ideal: 30 } })
        .then(read).catch(() => {});
    }
    // The camera was unplugged / taken by another app / the OS revoked it → say so instead of freezing on the last frame.
    if (track) track.onended = () => {
      if (streamRef.current !== stream) return;       // we stopped it ourselves
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setResolution(null);
      setState(CAM.ERROR);
      setError('The camera was disconnected or is being used by another app. Tap Try again.');
    };
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === 'videoinput');
      devicesRef.current = cams;
      setDevices(cams);
    } catch (_) { /* ignore */ }
  }, []);

  const releaseStream = () => {
    const s = streamRef.current;
    streamRef.current = null;
    s?.getTracks().forEach(t => { t.onended = null; t.stop(); });
  };

  const stop = useCallback(() => {
    reqId.current++;   // a request still waiting for permission must not resurrect the camera
    pending.current = null;
    releaseStream();
    if (videoRef.current) videoRef.current.srcObject = null;
    setResolution(null);
    switchingRef.current = false; setSwitching(false); setNotice(null);
    setState(CAM.IDLE);
  }, []);

  const request = useCallback((opts = {}) => {
    // request() is also used directly as an onClick handler → ignore event objects
    const wantId = typeof opts.deviceId === 'string' ? opts.deviceId : deviceId;
    const wantFacing = opts.facing ?? null;
    const key = `${wantId}|${wantFacing ?? ''}|${opts.force ? 'f' : ''}`;

    // The same request is already waiting on getUserMedia → share it. Opening the camera twice at once
    // makes some devices (Windows webcams especially) fail with "camera busy".
    if (pending.current?.key === key) return pending.current.promise;

    const run = async () => {
      // Already live on the camera that was asked for? Reuse it — no new getUserMedia, no new permission prompt.
      const live = streamRef.current?.getVideoTracks().find(t => t.readyState === 'live');
      if (live && !opts.force) {
        const cur = live.getSettings?.() ?? {};
        if (!wantId || cur.deviceId === wantId) { attach(streamRef.current); setState(CAM.GRANTED); setError(null); return true; }
      }

      const myId = ++reqId.current;            // a newer request supersedes this one
      releaseStream();                          // most devices can't open two cameras at once → never two live streams
      if (!opts.switching) { setState(CAM.REQUESTING); setError(null); }   // a switch keeps the booth on screen (see `switching`)

      if (!navigator.mediaDevices?.getUserMedia) {
        if (opts.switching) return false;
        setState(CAM.ERROR);
        setError(window.isSecureContext === false
          ? 'Camera needs a secure (https) connection. Open this page over https or localhost.'
          : 'This browser does not support camera access. Try Chrome, Safari, Edge or Firefox.');
        return;
      }

      let lastErr = null;
      for (const video of buildAttempts(wantId, wantFacing)) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video, audio: false });
          if (reqId.current !== myId) { s.getTracks().forEach(t => t.stop()); return false; } // superseded while waiting
          attach(s);
          setState(CAM.GRANTED); setError(null);
          refreshDevices();
          return true;
        } catch (err) {
          if (reqId.current !== myId) return false;
          lastErr = err;
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError') {
            if (opts.switching) { failRef.current = 'denied'; return false; }   // switch: the caller restores the previous camera
            setState(CAM.DENIED);
            setError('Camera permission denied. Please allow access in your browser settings.');
            return false;
          }
          if (err.name === 'NotReadableError' || err.name === 'TrackStartError' || err.name === 'AbortError') break; // lower tiers will not help: the device is busy
          // OverconstrainedError / NotFoundError / etc → try the next, lower tier
        }
      }
      if (reqId.current !== myId) return false;
      console.error('Camera start failed', lastErr);
      if (opts.switching) { failRef.current = lastErr?.name === 'NotReadableError' ? 'busy' : 'missing'; return false; }
      setState(CAM.ERROR);
      const n = lastErr?.name;
      setError(
        n === 'NotFoundError' || n === 'DevicesNotFoundError' ? 'No camera was found. Connect one and try again.' :
        n === 'NotReadableError' || n === 'TrackStartError'   ? 'Your camera is busy. Close other apps using it, then try again.' :
        'Could not start the camera. Check your device and try again.'
      );
      return false;
    };

    const promise = run().finally(() => { if (pending.current?.promise === promise) pending.current = null; });
    pending.current = { key, promise };
    return promise;
  }, [deviceId, attach, refreshDevices]);

  const selectDevice = useCallback((id) => {
    setDeviceId(id);
    request({ deviceId: id });
  }, [request]);

  /** Re-bind the live stream to a <video> that mounted after the stream started (screen changes that don't re-render App). */
  const reattach = useCallback(() => {
    const v = videoRef.current, st = streamRef.current;
    if (v && st && v.srcObject !== st) { v.srcObject = st; v.play?.().catch(() => {}); }
  }, []);

  /**
   * Front ⇄ rear. Works with the camera list that is already known (opens by deviceId → no new permission prompt),
   * falls back to facingMode, and on desktop with several webcams cycles through them.
   * The old stream is released BEFORE the new one opens (never two live streams). If the new camera cannot be
   * opened, the previous one is restored and a notice explains why — the booth never ends up with a dead preview.
   */
  const switchCamera = useCallback(async () => {
    if (switchingRef.current || !streamRef.current) return false;
    const cams = devicesRef.current.length ? devicesRef.current : devices;
    const curId = streamRef.current.getVideoTracks()[0]?.getSettings?.().deviceId || deviceId;
    const target = facing === 'user' ? 'environment' : 'user';
    const pattern = target === 'environment' ? LABEL_BACK : LABEL_FRONT;
    const others = cams.filter(c => c.deviceId && c.deviceId !== curId);

    // 1) a camera whose label says front/back  2) no labels but several cameras → the next one in the list
    let next = others.find(c => pattern.test(c.label || ''));
    if (!next && others.length && !cams.some(c => LABEL_BACK.test(c.label || '') || LABEL_FRONT.test(c.label || ''))) {
      const i = cams.findIndex(c => c.deviceId === curId);
      next = cams[(i + 1) % cams.length];
    }
    // 3) a phone that only exposes facingMode (no usable labels)
    const attempt = next ? { deviceId: next.deviceId, facing: null } : { deviceId: '', facing: target };
    if (!next && cams.length < 2 && !isTouchDevice()) {
      setNotice('Only one camera was found on this device.');
      return false;
    }

    switchingRef.current = true; setSwitching(true); setNotice(null);
    const prevId = curId;
    let ok = false;
    try {
      failRef.current = null;
      ok = await request({ ...attempt, switching: true, force: true });
      if (ok) {
        // the browser could not tell us which way the new camera faces → trust what we asked for
        const tr = streamRef.current?.getVideoTracks()[0];
        if (!tr?.getSettings?.().facingMode && !LABEL_BACK.test(tr?.label ?? '') && !LABEL_FRONT.test(tr?.label ?? '')) setFacing(target);
      } else {
        const why = failRef.current;
        setNotice(
          why === 'denied' ? 'Camera access was denied, so the camera was not switched.' :
          why === 'busy'   ? 'That camera is busy or in use by another app.' :
          `The ${target === 'environment' ? 'rear' : 'front'} camera is not available on this device.`);
        // put the previous camera back so the preview keeps working
        await request({ deviceId: prevId, switching: true, force: true });
        if (!streamRef.current) { setState(CAM.ERROR); setError('Could not restart the camera. Tap Try again.'); }
      }
    } finally {
      switchingRef.current = false; setSwitching(false);
    }
    return ok;
  }, [request, devices, deviceId, facing]);

  const clearNotice = useCallback(() => setNotice(null), []);

  // No mirroring anywhere: the preview and the saved photo show the camera image exactly as it is.
  const isTouch = isTouchDevice();

  // Re-attach only if the <video> got a different/empty source (e.g. after a screen change).
  // Must NOT touch srcObject when it is already correct: setting it again restarts playback.
  useEffect(() => {
    const v = videoRef.current, s = streamRef.current;
    if (v && s && v.srcObject !== s) { v.srcObject = s; v.play?.().catch(() => {}); }
  });
  useEffect(() => {
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);
  // Coming back to the tab (or rotating the phone) can leave the video paused → resume it.
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      const v = videoRef.current;
      if (v && streamRef.current && v.paused) v.play?.().catch(() => {});
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('orientationchange', resume);
    return () => { document.removeEventListener('visibilitychange', resume); window.removeEventListener('orientationchange', resume); };
  }, []);
  useEffect(() => () => releaseStream(), []);

  return {
    videoRef, state, error,
    devices, deviceId, resolution,
    facing, switching, switchingRef, notice, clearNotice, switchCamera,
    canSwitch: devices.length > 1 || isTouch,
    request, stop, selectDevice, reattach,
    isReady: state === CAM.GRANTED,
  };
}