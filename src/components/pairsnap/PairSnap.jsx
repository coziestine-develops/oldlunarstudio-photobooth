/**
 * PairSnap — controller for the PairSnap mode.
 *
 * Steps:  1 Camera Settings (existing OldLunar screen)  →  2 Select References  →
 *         3 Photobooth (4 shots, per-shot retake)       →  4 Edit & Download (existing OldLunar editor)
 *
 * It does NOT own a camera: `cam` (useCamera) and `cap` (useCapture) come from App,
 * so PairSnap and the classic photobooth share one camera + capture implementation.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PhotoboothHeader from '../PhotoboothHeader.jsx';
import CameraScreen from '../CameraScreen.jsx';
import PhotoEditor from '../PhotoEditor.jsx';
import CaptureFlash from '../CaptureFlash.jsx';
import PoseSelect from './PoseSelect.jsx';
import PairCamera from './PairCamera.jsx';
import { POSE_MAP } from '../../data/poses.js';
import { DEFAULT_EDITOR } from '../../utils/editorDefaults.js';
import { WATERMARK_TEXT } from '../../utils/watermark.js';
import { DEFAULT_FILTER, DEFAULT_INTENSITY } from '../../utils/filters.js';
import { DEFAULT_TIMER, TIMER_OPTIONS, PAUSE_BETWEEN_SHOTS_MS } from '../../hooks/useCapture.js';
import { initAudio } from '../../utils/sounds.js';
import './pairsnap.css';

export const PS_TITLES = ['Camera Settings', 'Select References', 'Photobooth', 'Edit & Download'];
export const PS_SHOTS = 4;
/* The strip's brand line is the permanent watermark (see WATERMARK_TEXT), not an editable name. */
const PAIR_EDITOR = { ...DEFAULT_EDITOR, caption: '', showCaption: false, layout: 'strip',
  frameStyle: 'rounded', bgColor: 'cream', spacing: 0, padding: 16, showDate: true };

const pad = n => String(n).padStart(2, '0');
const pairFileName = () => {
  const d = new Date();
  return `oldlunar studio-pairsnap-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.png`;
};

/* PairSnap sounds (countdown beeps, shutter, success chime) are always on — there is no sound toggle. */
const soundEnabled = true;

export default function PairSnap({ cam, cap, onExit }) {
  const [step, setStep]               = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [retakeIdx, setRetakeIdx]     = useState(null);
  const [running, setRunning]         = useState(false);   // a countdown/capture sequence is active (includes the short pause between shots)
  const [filter, setFilter]           = useState(DEFAULT_FILTER);
  const [intensity, setIntensity]     = useState(DEFAULT_INTENSITY);
  const [editorState, setEditorState] = useState(PAIR_EDITOR);
  const [timer, setTimer]             = useState(DEFAULT_TIMER);   // seconds of countdown before EACH photo, chosen on step 1
  const runTok = useRef(0);

  const poses = useMemo(() => selectedIds.map(id => POSE_MAP[id]).filter(Boolean), [selectedIds]);
  const refImages = useMemo(() => poses.map(p => p.image), [poses]);

  /* Ask for the camera once, when the PairSnap booth opens. Later calls reuse the live stream. */
  useEffect(() => { initAudio(); cam.request(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /* ── capture (same hook as OldLunar: 5 s countdown, frame grabbed the instant it ends) ── */
  const run = useCallback(async (opts) => {
    const tok = ++runTok.current;
    setRunning(true);
    try {
      await cap.start({ timerSecs: timer, photoCount: PS_SHOTS, soundEnabled, pauseMs: PAUSE_BETWEEN_SHOTS_MS, ...opts });
    } finally {
      if (runTok.current === tok) { setRunning(false); setRetakeIdx(null); }
    }
  }, [cap, timer]);

  const startCapture = useCallback(() => {
    if (!cam.isReady || running) return;
    initAudio();
    run({ resume: true, retakeIndex: null });
  }, [cam.isReady, running, run]);

  const retakeShot = useCallback((idx) => {
    if (!cam.isReady || running) return;
    setRetakeIdx(idx);
    cap.rearm();                       // keep the other photos
    run({ retakeIndex: idx });
  }, [cam.isReady, running, cap, run]);

  const cancelCapture = useCallback(() => {
    runTok.current++;                  // the cancelled run must not touch state when it unwinds
    setRunning(false); setRetakeIdx(null);
    cap.cancel();
  }, [cap]);

  /* ── navigation ── */
  const goEdit = useCallback(() => {
    if (cap.photoUrls.length < PS_SHOTS || running) return;
    cam.stop();                        // camera off while editing
    setStep(4);
  }, [cap.photoUrls.length, running, cam]);

  const retakeAll = useCallback(() => {
    cap.reset(); setRetakeIdx(null);
    setStep(3); cam.request();
  }, [cap, cam]);

  const handleBack = useCallback(() => {
    if (running) return;
    if (step === 1) { onExit(); return; }
    if (step === 2) { setStep(1); return; }
    if (step === 3) {
      if (cap.photoUrls.length > 0 && !window.confirm('Go back? Your photos will be discarded.')) return;
      cap.reset(); setRetakeIdx(null); setStep(2);
      return;
    }
    if (step === 4) { setStep(3); cam.request(); }
  }, [step, running, cap, cam, onExit]);

  const resetEditor = useCallback(() => { setEditorState(PAIR_EDITOR); setFilter(DEFAULT_FILTER); setIntensity(DEFAULT_INTENSITY); }, []);
  const patchEditor = useCallback(p => setEditorState(prev => ({ ...prev, ...p })), []);

  const header = {
    1: {},
    2: {},
    3: { counter: `${cap.photoUrls.length}/${PS_SHOTS}`,
         next: cap.photoUrls.length === PS_SHOTS && !running ? { label: 'Edit & Download', onClick: goEdit } : null },
    4: {},
  }[step];

  return (
    <div className="ps-shell pb">
      <CaptureFlash active={cap.isFlashing} />
      <PhotoboothHeader step={step} titles={PS_TITLES} onBack={handleBack} backDisabled={running}
                        next={header.next ?? null} counter={header.counter ?? null} />

      <div className="ps-body">
        {step === 1 && (
          <CameraScreen
            step={1} onStepChange={() => setStep(2)}
            videoRef={cam.videoRef} camState={cam.state} camError={cam.error} onAllowCamera={cam.request}
            devices={cam.devices} deviceId={cam.deviceId} onDeviceChange={cam.selectDevice} resolution={cam.resolution}
            onSwitchCamera={cam.switchCamera} canSwitch={cam.canSwitch} switching={cam.switching} facing={cam.facing}
            notice={cam.notice} onClearNotice={cam.clearNotice}
            onCapture={() => {}} onCancelCapture={() => {}}
            captureState={cap.captureState} countdown={null} currentShot={0}
            isCapturing={false} isReady={cam.isReady} photoUrls={[]} total={PS_SHOTS}
            timer={timer} timerOptions={TIMER_OPTIONS} onTimerChange={setTimer}
            showCameraSelect={false}
          />
        )}

        {step === 2 && (
          <PoseSelect selectedIds={selectedIds} onChange={setSelectedIds} total={PS_SHOTS}
                      onContinue={() => { setStep(3); cam.request(); }} />
        )}

        {step === 3 && (
          <PairCamera
            cam={cam} cap={cap} poses={poses} total={PS_SHOTS}
            running={running} retakeIdx={retakeIdx}
            onStart={startCapture} onCancel={cancelCapture} onRetake={retakeShot} onContinue={goEdit}
            onSwitchCamera={cam.switchCamera} canSwitch={cam.canSwitch} switching={cam.switching} facing={cam.facing}
            notice={cam.notice} onClearNotice={cam.clearNotice}
          />
        )}

        {step === 4 && (
          <PhotoEditor
            photoUrls={cap.photoUrls}
            filterId={filter} onFilterChange={setFilter}
            intensity={intensity} onIntensityChange={setIntensity}
            editorState={editorState} onStateChange={patchEditor}
            onResetEditor={resetEditor} onRetake={retakeAll} onSave={() => {}}
            soundEnabled={soundEnabled} fileName={pairFileName} showLayoutPresets
            lockedWatermark={WATERMARK_TEXT}
            refs={refImages}
          />
        )}
      </div>
    </div>
  );
}