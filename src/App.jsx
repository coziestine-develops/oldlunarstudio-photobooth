/**
 * OldLunar — App.jsx
 *
 * Full flow:
 *   landing → photobooth(camera → session → editor → end)
 *
 * Photobooth steps for the header indicator:
 *   1 = Permission   (camera idle/requesting/denied)
 *   2 = Settings     (camera granted, configuring)
 *   3 = Capture      (countdown / capturing)
 *   4 = Edit & Save  (session gallery / editor / end)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import LandingPage      from './components/LandingPage.jsx';
import PhotoboothHeader from './components/PhotoboothHeader.jsx';
import CameraScreen     from './components/CameraScreen.jsx';
import CaptureFlash     from './components/CaptureFlash.jsx';
import SessionGallery   from './components/SessionGallery.jsx';
import PhotoEditor      from './components/PhotoEditor.jsx';

import { useCamera, CAM }              from './hooks/useCamera.js';
import { useCapture, CS, DEFAULT_TIMER, TIMER_OPTIONS } from './hooks/useCapture.js';
import { useGallery }                  from './hooks/useGallery.js';
import { initAudio }                   from './utils/sounds.js';
import { DEFAULT_FILTER, DEFAULT_INTENSITY } from './utils/filters.js';
import { blobToDataURL }               from './utils/canvas.js';
import { designToEditor } from './utils/share.js';
import { DEFAULT_EDITOR } from './utils/editorDefaults.js';
import PairSnap from './components/pairsnap/PairSnap.jsx';
import PhotoPop from './components/photopop/PhotoPop.jsx';
import { WATERMARK_TEXT } from './utils/watermark.js';

/* ── Sub-screen identifiers inside the photobooth ── */
const SUB = {
  CAMERA:  'camera',
  SESSION: 'session',
  EDITOR:  'editor',
};

export default function App() {
  /* ── Top-level view ── */
  const [mode,         setMode]         = useState('oldluna'); // 'oldluna' | 'pairsnap' | 'photopop'
  const [inPhotobooth, setInPhotobooth] = useState(false);
  const [sub,          setSub]          = useState(SUB.CAMERA);
  const [camStep,      setCamStep]      = useState(1); // 1 camera · 2 capture

  /* ── Photobooth settings (persist across retakes) ── */
  const [filter,       setFilter]       = useState(DEFAULT_FILTER);
  const [intensity,    setIntensity]    = useState(DEFAULT_INTENSITY);
  const [timer, setTimer] = useState(DEFAULT_TIMER);   // seconds of countdown before EACH photo (3/5/7/10/15, default 5); survives retakes, camera switches and restarts
  const photoCount = 4;   // fixed 4-photo strip
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [editorState,  setEditorState]  = useState(DEFAULT_EDITOR);


  /* ── Retake slot ── */
  const [retakeIdx, setRetakeIdx] = useState(null);

  /* ── Hooks ── */
  const cam = useCamera();
  const cap = useCapture(cam.videoRef, cam.switchingRef);   // switchingRef: a frame is never grabbed from a half-swapped stream
  const { save: saveToGallery } = useGallery();

  /* ── Audio init (must happen after user gesture) ── */
  const audioReady = useRef(false);
  const ensureAudio = () => {
    if (!audioReady.current) { initAudio(); audioReady.current = true; }
  };

  /* ── Start photobooth ── */
  const handleStart = useCallback((design = null) => {
    ensureAudio();
    setInPhotobooth(true);
    setSub(SUB.CAMERA);
    setCamStep(1);
    // a design chosen in the landing builder seeds the editor
    const d = design && typeof design === 'object' && 'frameStyle' in design ? design : null;
    setEditorState(d ? { ...DEFAULT_EDITOR, ...designToEditor(d) } : DEFAULT_EDITOR);
    if (d) { setFilter(d.filter); setIntensity(d.intensity); }
    cam.request();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.request]);

  /* ── Stop camera when leaving photobooth ── */
  useEffect(() => {
    if (!inPhotobooth) { cam.stop(); cap.reset(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPhotobooth]);

  /* ── Keyboard: Space starts capture (Esc cancels in Countdown) ── */
  useEffect(() => {
    if (!inPhotobooth || sub !== SUB.CAMERA) return;
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
      if (e.code === 'Space')   { e.preventDefault(); if (camStep === 2) handleCapture(); }
      // Esc is handled inside <Countdown>
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPhotobooth, sub, camStep, cam.isReady, cap.isCapturing]);

  /* ── Trigger capture ── */
  const handleCapture = useCallback((opts = {}) => {
    if (!cam.isReady || cap.isCapturing || cam.switching) return;
    cap.start({
      resume:       opts.resume === true,
      filterId:     'normal', // originals are saved untouched; filter is applied non-destructively
      timerSecs:    timer,
      photoCount,
      soundEnabled,
      retakeIndex:  retakeIdx,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.isReady, cam.switching, cap.isCapturing, filter, timer, photoCount, soundEnabled, retakeIdx]);

  /* ── Move to session gallery when capture completes ── */
  useEffect(() => {
    if (inPhotobooth && cap.captureState === CS.DONE && cap.photoUrls.length > 0) {
      // Move on right away: no artificial wait between the last capture and the results
      setRetakeIdx(null); setSub(SUB.SESSION);
    }
  }, [inPhotobooth, cap.captureState, cap.photoUrls.length]);

  /* ── Session gallery: reorder ── */
  const [sessionUrls, setSessionUrls] = useState([]);
  useEffect(() => { setSessionUrls(cap.photoUrls); }, [cap.photoUrls]);

  const handleReorder = useCallback((newUrls) => {
    setSessionUrls(newUrls);
    cap.reorder(newUrls);   // keep blobs/urls in the same order so retake targets the right photo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.reorder]);

  /* ── Session gallery: retake one slot ── */
  const handleRetakeSlot = useCallback((idx) => {
    setRetakeIdx(idx);
    cap.rearm();            // idle again, but keep the other photos
    setCamStep(2);
    setSub(SUB.CAMERA);
    cam.request();          // camera is switched off while reviewing / editing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.rearm, cam.request]);

  /* ── Switch the camera off whenever we leave the camera screen ── */
  useEffect(() => {
    if (inPhotobooth && sub !== SUB.CAMERA) cam.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, inPhotobooth]);

  /* ── Proceed from session to editor ── */
  const handleContinueToEditor = useCallback(() => {
    setSub(SUB.EDITOR);
  }, []);

  /* ── Editor state patch ── */
  const patchEditor = useCallback((partial) => {
    setEditorState(prev => ({ ...prev, ...partial }));
  }, []);

  /* ── Final output: first download/share/print also saves to the local gallery ── */
  const handleSaveToGallery = useCallback(async (blob) => {
    try {
      const url = await blobToDataURL(blob);
      saveToGallery(url, { filterId: filter, count: photoCount });
    } catch (err) { console.error('Gallery save failed', err); }
  }, [filter, photoCount, saveToGallery]);

  /* ── Retake from editor ── */
  const handleRetakeFromEditor = useCallback(() => {
    cap.reset();
    setRetakeIdx(null);
    setCamStep(2);
    setSub(SUB.CAMERA);
    cam.request();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.reset, cam.request]);

  /* ── Reset all edits on the Final Output screen (keeps the photos) ── */
  const handleResetEditor = useCallback(() => {
    setEditorState(DEFAULT_EDITOR);
    setFilter(DEFAULT_FILTER);
    setIntensity(DEFAULT_INTENSITY);
  }, []);

  /* ── Reset the photo strip on the camera screen ── */
  const handleResetStrip = useCallback(() => {
    cap.reset();
    setRetakeIdx(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap.reset]);

  /* ── Start again ── */
  const handleStartAgain = useCallback(() => {
    cap.reset();
    setRetakeIdx(null);
    setEditorState(DEFAULT_EDITOR);
    setSessionUrls([]);
    setCamStep(1);
    setSub(SUB.CAMERA);
    cam.request();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, cam.request]);

  /* ── Derive step number for header ── */
  const headerStep = sub === SUB.CAMERA ? camStep : sub === SUB.SESSION ? 3 : 4;

  /* ── Header back button: step back through the camera wizard, else leave ── */
  const handleBack = useCallback(() => {
    if (cap.isCapturing) return;
    if (sub === SUB.CAMERA && retakeIdx !== null) { setRetakeIdx(null); setSub(SUB.SESSION); return; }
    if (sub === SUB.CAMERA && camStep > 1) { setCamStep(camStep - 1); return; }
    if (sub === SUB.EDITOR)  { setSub(SUB.SESSION); return; }
    if (sub === SUB.SESSION) {
      if (window.confirm('Discard these photos and retake?')) handleRetakeFromEditor();
      return;
    }
    setInPhotobooth(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, camStep, retakeIdx, cap.isCapturing, handleRetakeFromEditor]);

  /* ─────────────────────────────────────────────────────── */
  /* RENDER                                                  */
  /* ─────────────────────────────────────────────────────── */

  if (mode === 'pairsnap') {
    return (
      <PairSnap
        cam={cam} cap={cap}
        onExit={() => { cam.stop(); cap.reset(); setMode('oldluna'); }}
      />
    );
  }

  if (mode === 'photopop') {
    return (
      <PhotoPop
        cam={cam} cap={cap}
        onExit={() => { cam.stop(); cap.reset(); setMode('oldluna'); }}
      />
    );
  }

  if (!inPhotobooth) {
    return (
      <LandingPage
        onStart={handleStart}
        onStartPairSnap={() => { ensureAudio(); setMode('pairsnap'); }}
        onStartPhotoPop={() => { ensureAudio(); setMode('photopop'); }}
        soundEnabled={soundEnabled}
      />
    );
  }

  return (
    <>
      {/* Global shutter flash */}
      <CaptureFlash active={cap.isFlashing} />

      {/* Photobooth shell */}
      <div className="app-photobooth pb">
        <PhotoboothHeader
          step={headerStep}
          onBack={handleBack}
          backDisabled={cap.isCapturing}
          counter={sub === SUB.CAMERA && headerStep === 2 ? `${cap.photoUrls.length}/${photoCount}` : null}
          next={
            null
          }
        />

        <div className="app-pb-body">
          {/* ── Camera screen ── */}
          {sub === SUB.CAMERA && (
            <CameraScreen
              step={camStep}
              onStepChange={setCamStep}
              devices={cam.devices}
              deviceId={cam.deviceId}
              onDeviceChange={cam.selectDevice}
              resolution={cam.resolution}
              videoRef={cam.videoRef}
              camState={cam.state}
              camError={cam.error}
              onAllowCamera={cam.request}
              soundEnabled={soundEnabled}
              onSoundToggle={() => setSoundEnabled(v => !v)}
              showCameraSelect={false}
              timer={timer}
              timerOptions={TIMER_OPTIONS}
              onTimerChange={cap.isCapturing ? undefined : setTimer}
              onSwitchCamera={cam.switchCamera}
              canSwitch={cam.canSwitch}
              switching={cam.switching}
              facing={cam.facing}
              notice={cam.notice}
              onClearNotice={cam.clearNotice}
              onCapture={() => handleCapture()}
              onCancelCapture={cap.cancel}
              onReset={handleResetStrip}
              captureState={cap.captureState}
              countdown={cap.countdown}
              currentShot={cap.currentShot}
              isCapturing={cap.isCapturing}
              isReady={cam.isReady}
              photoUrls={cap.photoUrls}
              retakeIndex={retakeIdx}
              captureError={cap.error}
              onRetryCapture={() => { cap.clearError(); handleCapture({ resume: retakeIdx === null }); }}
              total={photoCount}
            />
          )}

          {/* ── Session gallery ── */}
          {sub === SUB.SESSION && (
            <SessionGallery
              photoUrls={sessionUrls}
              onReorder={handleReorder}
              onRetake={handleRetakeSlot}
              onContinue={handleContinueToEditor}
              soundEnabled={soundEnabled}
            />
          )}

          {/* ── Final output (editor) ── */}
          {sub === SUB.EDITOR && (
            <PhotoEditor
              photoUrls={sessionUrls}
              filterId={filter}
              onFilterChange={setFilter}
              intensity={intensity}
              onIntensityChange={setIntensity}
              editorState={editorState}
              onStateChange={patchEditor}
              onSave={handleSaveToGallery}
              onResetEditor={handleResetEditor}
              onRetake={handleRetakeFromEditor}
              soundEnabled={soundEnabled}
              lockedWatermark={WATERMARK_TEXT}
            />
          )}
        </div>
      </div>

      <style>{`
        .app-photobooth {
          min-height: 100vh; min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: #191516;
        }
        .app-pb-body {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </>
  );
}