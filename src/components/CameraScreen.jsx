import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, CameraRotate, ChevronDown, Lock, RotateCcw } from '../icons.jsx';
import { CS } from '../hooks/useCapture.js';
import { CAM } from '../hooks/useCamera.js';
import { playClick } from '../utils/sounds.js';
import Countdown from './Countdown.jsx';
import './camera.css';

/* ── Seconds between photos ── */
function TimerPicker({ value, options, onChange, disabled = false, compact = false, idPrefix = 'timer', className = '' }) {
  return (
    <div className={`cam-timer ${compact ? 'cam-timer--compact' : ''} ${className}`} role="radiogroup" aria-label="Seconds between photos">
      {options.map(sec => (
        <button key={sec} type="button" role="radio" id={`${idPrefix}-${sec}`} aria-checked={value === sec} disabled={disabled}
                className="cam-timer-b" onClick={() => onChange?.(sec)}>
          {sec}<small>s</small>
        </button>
      ))}
    </div>
  );
}

/* Front / back camera button (Tailwind). */
export const CAM_BTN = 'inline-flex h-[42px] min-w-[42px] items-center justify-center gap-2 rounded-xl border-2 border-oln-edge ' +
  'bg-oln-dark/70 px-3 text-[13px] font-semibold text-oln-cream shadow-[0_3px_0_#191516] transition-colors duration-150 ' +
  'hover:border-oln-pink disabled:opacity-45 max-sm:h-9 max-sm:min-w-9 max-sm:px-2';
const TOOL_BTN = CAM_BTN;

/* ── Viewfinder: the live camera, with no crop lines, no Live badge and no fullscreen button.
     The front / back button shows only on the booth step, and only where the device can switch (phones or several cameras). ── */
function Viewfinder({ videoRef, camState, error, onAllow, variant = 'setup',
                      onSwitchCamera, canSwitch = false, switchDisabled = false, switching = false, facing = 'user',
                      notice = null, onClearNotice, children }) {
  const booth = variant === 'booth';

  const isLive    = camState === CAM.GRANTED;
  const isLoading = camState === CAM.REQUESTING;
  const isDenied  = camState === CAM.DENIED;
  const isError   = camState === CAM.ERROR;
  const isIdle    = camState === CAM.IDLE;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const h = () => v.play().catch(() => {});
    v.addEventListener('canplay', h);
    return () => v.removeEventListener('canplay', h);
  }, [videoRef]);

  // a short-lived message (e.g. "rear camera not available") that never hides the preview
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => onClearNotice?.(), 5000);
    return () => clearTimeout(t);
  }, [notice, onClearNotice]);

  const showSwitch = booth && !!onSwitchCamera && canSwitch && isLive;

  return (
    <div className="cam-vf" data-live={isLive}>
      <video ref={videoRef} className="cam-video" data-live={isLive} autoPlay playsInline muted
             aria-label="Live camera preview" />

      {showSwitch && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[11] flex justify-end p-3.5 max-sm:p-2.5">
          <button type="button" className={`pointer-events-auto ${TOOL_BTN}`} onClick={onSwitchCamera} disabled={switchDisabled || switching}
                  aria-label={`Switch camera (now ${facing === 'environment' ? 'back' : 'front'})`} title="Switch front / back camera">
            <CameraRotate size={18} aria-hidden="true" />
            <span className="max-sm:hidden">{facing === 'environment' ? 'Back' : 'Front'}</span>
          </button>
        </div>
      )}

      {switching && (
        <div className="cam-switching" role="status" aria-live="polite"><div className="cam-spin" aria-hidden="true" /><span>Switching camera…</span></div>
      )}
      {notice && <div className="cam-notice" role="status" aria-live="polite">{notice}</div>}

      {isLoading && (
        <div className="cam-ov" role="status" aria-live="polite">
          <div className="cam-spin" aria-hidden="true" />
          <h3>Waiting for permission…</h3>
          <p>Tap <b>Allow</b> when your browser asks to use the camera.</p>
        </div>
      )}
      {isIdle && (
        <div className="cam-ov">
          <span className="cam-ov-ic"><Camera size={28} /></span>
          <p>OldLunar needs your camera to take your four photos.</p>
          <button type="button" className="pb-btn pb-btn--primary pb-btn--lg" onClick={onAllow}><Camera size={18} />Allow camera</button>
          <p className="cam-ov-note"><Lock size={13} aria-hidden="true" />Photos stay on your device. Nothing is uploaded.</p>
        </div>
      )}
      {(isDenied || isError) && (
        <div className="cam-ov" role="alert">
          <span className="cam-ov-ic">{isDenied ? <Lock size={28} /> : <Camera size={28} />}</span>
          <h3>{isDenied ? 'Camera access is blocked' : 'Camera unavailable'}</h3>
          <p>{error ?? 'OldLunar needs your camera to take photos.'}</p>
          {isDenied && (
            <ol className="cam-steps">
              <li>Tap the lock or camera icon next to the address bar.</li>
              <li>Set Camera to <b>Allow</b>.</li>
              <li>Come back here and tap <b>Try again</b>.</li>
            </ol>
          )}
          <button type="button" className="pb-btn pb-btn--primary pb-btn--lg" onClick={onAllow}><RotateCcw size={18} />Try again</button>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Main screen: Step 1 (Camera Settings) and Step 2 (Photobooth) ── */
export default function CameraScreen({
  step = 1, onStepChange,
  videoRef, camState, camError, onAllowCamera,
  devices = [], deviceId = '', onDeviceChange,
  soundEnabled,
  onCapture, onCancelCapture,
  captureState, countdown, currentShot,
  isCapturing, isReady, photoUrls = [], total = 4, retakeIndex = null,
  captureError = null, onRetryCapture,
  showCameraSelect = true,
  timer = 5, timerOptions = [], onTimerChange,
  onSwitchCamera, canSwitch = false, switching = false, facing = 'user', notice = null, onClearNotice,
}) {
  const canGo    = isReady && !isCapturing;
  const done     = captureState === CS.DONE && photoUrls.length > 0 && retakeIndex === null;
  const isRetake = retakeIndex !== null;
  const isShootSequence = isCapturing || currentShot > 0 || countdown !== null || captureState === CS.FLASH || captureState === CS.PROCESSING;
  const [announce, setAnnounce] = useState('');
  useEffect(() => { setAnnounce(isReady ? 'Camera is ready' : ''); }, [isReady]);

  const go = n => { playClick(soundEnabled); onStepChange?.(n); };

  const overlays = (
    <>
      {isCapturing && countdown !== null && (
        <div className="cam-cd">
          <Countdown value={countdown} currentShot={currentShot} totalShots={total} onCancel={onCancelCapture} />
        </div>
      )}
      {captureError && (
        <div className="cam-ov" role="alert">
          <span className="cam-ov-ic"><Camera size={28} /></span>
          <h3>Photo not saved</h3>
          <p>{captureError}</p>
          <button type="button" className="pb-btn pb-btn--primary" onClick={onRetryCapture}><RotateCcw size={18} />Try again</button>
        </div>
      )}
      {captureState === CS.PROCESSING && (
        <div className="cam-proc" role="status"><div className="cam-spin" aria-hidden="true" /><p>Developing…</p></div>
      )}
    </>
  );

  const timerOn = !!onTimerChange && timerOptions.length > 0;

  /* Front / back switch. Allowed before and during a session; blocked only for the shutter and developing. */
  const switchProps = onSwitchCamera ? {
    onSwitchCamera, canSwitch, facing, switching,
    switchDisabled: captureState === CS.FLASH || captureState === CS.PROCESSING,
  } : {};

  const viewfinderProps = { videoRef, camState, error: camError, onAllow: onAllowCamera, notice, onClearNotice };

  return (
    <div className="pb-screen">
      <p className="sr-only" aria-live="polite">{announce}</p>

      {/* ───────── STEP 1 — Camera Settings ───────── */}
      {step === 1 && (
        <div className="cam-s1" data-live={isReady}>
          <Viewfinder {...viewfinderProps} variant="setup">{overlays}</Viewfinder>

          <section className="pb-card cam-card" aria-label="Camera setup">
            <div>
              <span className="pb-eyebrow">Setup</span>
              <h2>{showCameraSelect ? 'Your Camera' : 'Get ready'}</h2>
            </div>

            {showCameraSelect && (
              <div className="cam-field">
                <label className="pb-label" htmlFor="cam-select">Select camera</label>
                <div className="pb-select">
                  <select id="cam-select" value={deviceId} disabled={!devices.length || isCapturing}
                          onChange={e => onDeviceChange?.(e.target.value)}>
                    {!devices.length && <option value="">Default camera</option>}
                    {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                  </select>
                  <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
                </div>
              </div>
            )}

            {timerOn && (
              <div className="cam-field">
                <span className="pb-label" id="timer-label-s1">Seconds between photos</span>
                <TimerPicker value={timer} options={timerOptions} onChange={n => { playClick(soundEnabled); onTimerChange(n); }} idPrefix="s1-timer" />
                <p className="cam-hint cam-hint--left">The countdown runs before each of your {total} photos.</p>
              </div>
            )}

            {/* Phones and multi-camera devices: front / back toggle. Desktop has no row here. */}
            {canSwitch && onSwitchCamera && (
              <button type="button" className="cam-row" onClick={onSwitchCamera} disabled={switching}
                      aria-label={`Camera: ${facing === 'environment' ? 'back' : 'front'}. Tap to switch`}>
                <span className="cam-row-l"><CameraRotate size={18} aria-hidden="true" />Camera</span>
                <span className="cam-row-r"><em>{facing === 'environment' ? 'Back' : 'Front'}</em></span>
              </button>
            )}

            <button type="button" className="pb-btn pb-btn--primary pb-btn--block pb-btn--lg" disabled={!canGo} onClick={() => go(2)}>
              Continue <ArrowRight size={18} />
            </button>
            {!isReady && camState !== CAM.REQUESTING && <p className="cam-hint">Camera needs to be on to continue.</p>}
          </section>
        </div>
      )}

      {/* ───────── STEP 2 — Photobooth ───────── */}
      {step === 2 && (
        <div className="cam-s2">
          <div className="cam-stage">
            <Viewfinder {...viewfinderProps} {...switchProps} variant="booth">
              {overlays}
              {isReady && !isShootSequence && captureState !== CS.PROCESSING && !captureError && !done && (
                <div className="cam-ctrl">
                  {timerOn && (
                    <TimerPicker compact value={timer} options={timerOptions} onChange={n => { playClick(soundEnabled); onTimerChange(n); }}
                                 disabled={isCapturing} idPrefix="s2-timer" className="pointer-events-auto" />
                  )}
                  <button type="button" className="cam-go pointer-events-auto" onClick={onCapture} disabled={switching}
                          aria-label={isRetake ? 'Start retake' : 'Start capture'}>
                    <Camera size={20} aria-hidden="true" />
                    {isRetake ? 'Retake photo' : 'START'}
                  </button>
                </div>
              )}
            </Viewfinder>
          </div>

          <div className="cam-side">
            <div className="cam-strip" aria-label="Photo strip">
              {Array.from({ length: total }).map((_, i) => {
                const url = photoUrls[i];
                const active = isCapturing && currentShot === i + 1 && (!url || isRetake);
                return (
                  <div key={i} className={`cam-slot ${url ? 'is-filled' : ''} ${active ? 'is-active' : ''}`}>
                    {url ? <img src={url} alt={`Photo ${i + 1}`} /> : i + 1}
                    {url && <span className="cam-slot-n">{i + 1}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}