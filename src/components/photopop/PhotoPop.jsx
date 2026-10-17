/**
 * PhotoPop — the one-tap photo booth.
 *
 *   1 Style     the Classic Strip, live preview on the uploaded template
 *   2 Capture   camera preview, countdown, one photo per frame (tap a frame to retake)
 *   3 Download  final strip, PNG download
 *
 * Camera and capture come from App (shared with the classic booth and PairSnap),
 * so the camera stream and capture timing behave exactly like the other modes.
 */
import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import PhotoboothHeader from '../PhotoboothHeader.jsx';
import CaptureFlash from '../CaptureFlash.jsx';
import { loadSource, makeSample, downscale } from '../../utils/photopop/presets.js';
import { FILTERS, FILTER_MAP, DEFAULT_FILTER, DEFAULT_INTENSITY } from '../../utils/filters.js';
import { treatPhoto } from '../../utils/export.js';
import { composeImage, loadStripTemplate, STRIP_TEMPLATES, templateUrl } from '../../utils/photopop/compose.js';
import { downloadBlob, pngFilename } from '../../utils/canvas.js';
import { CAM } from '../../hooks/useCamera.js';
import { CS } from '../../hooks/useCapture.js';
import { ChevronDown } from '../../icons.jsx';
import './photopop.css';

export const PP_TITLES = ['Style', 'Capture', 'Download'];
const LAYOUT = 'strip';                                  // PhotoPop offers one layout: the Classic Strip
const MAX_SHOTS = 4;                                     // the most frames any template has
const TIMER_CHOICES = [0, 3, 5, 10];   // 0 = instant (skip the countdown)
const DEFAULT_SECS = 5;
const NO_SLOTS = [null, null, null, null];
/* Looks: the same filters, intensity and adjustments as PairSnap and the photo editor. */
const DEFAULT_ADJUST = { brightness: 100, contrast: 100, saturation: 100, grain: 0 };
const ADJUSTS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast',   label: 'Contrast',   min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0,  max: 200 },
  { key: 'grain',      label: 'Grain',      min: 0,  max: 60 },
];
const isDefaultAdjust = a => ADJUSTS.every(x => (a[x.key] ?? DEFAULT_ADJUST[x.key]) === DEFAULT_ADJUST[x.key]);

/** The look for one photo. Untouched photos are returned as they are; the original is never modified. */
function applyLook(src, filterId, intensity, adjustments) {
  const filter = FILTER_MAP[filterId] ?? FILTER_MAP[DEFAULT_FILTER];
  if (filter.id === DEFAULT_FILTER && isDefaultAdjust(adjustments)) return src;
  return treatPhoto(src, filter, intensity / 100, adjustments);
}

const dateStamp = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

/* ── small pieces ── */

/** Mounts a composed canvas into a host element (no image copy, no extra re-render). */
function Preview({ canvas, label }) {
  const host = useRef(null);
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    if (canvas) canvas.classList.add('pp-canvas');
    h.replaceChildren(...(canvas ? [canvas] : []));
  }, [canvas]);
  return <div className="pp-preview" ref={host} role="img" aria-label={label} />;
}

/** Shown in place of the live video until the camera is ready. */
function CameraStatus({ cam }) {
  if (cam.state === CAM.DENIED) {
    return (
      <div className="pp-status" role="alert">
        <strong>Camera access is blocked</strong>
        <p>Allow camera access for this site in your browser settings, then try again.</p>
        <button type="button" className="pp-btn pp-btn--ghost" onClick={cam.request}>Try again</button>
      </div>
    );
  }
  if (cam.state === CAM.ERROR) {
    return (
      <div className="pp-status" role="alert">
        <strong>No camera available</strong>
        <p>{cam.error || 'Connect a camera and make sure no other app is using it.'}</p>
        <button type="button" className="pp-btn pp-btn--ghost" onClick={cam.request}>Try again</button>
      </div>
    );
  }
  return (
    <div className="pp-status" role="status">
      <span className="pp-spin" aria-hidden="true" />
      <p>{cam.state === CAM.GRANTED ? 'Starting camera…' : 'Waiting for camera permission…'}</p>
    </div>
  );
}

/* ── main ── */

export default function PhotoPop({ cam, cap, onExit }) {
  const [step, setStep]               = useState(1);
  const [timer, setTimer]             = useState(DEFAULT_SECS);
  const [running, setRunning]         = useState(false);     // a countdown/capture sequence is active
  const [retakeIdx, setRetakeIdx]     = useState(null);
  const [photos, setPhotos]           = useState(NO_SLOTS);  // 4 decoded photos, null = empty frame
  const [templateId, setTemplateId]   = useState(STRIP_TEMPLATES[0].id);
  const [template, setTemplate]       = useState(null);      // the chosen strip template, as drawn
  const [filterId, setFilterId]       = useState(DEFAULT_FILTER);
  const [intensity, setIntensity]     = useState(DEFAULT_INTENSITY);
  const [adjust, setAdjust]           = useState(DEFAULT_ADJUST);
  const [fontsTick, setFontsTick]     = useState(0);         // bumps once the web font is ready, so canvases redraw with it
  const [loadError, setLoadError]     = useState(null);
  const [exporting, setExporting]     = useState(false);
  const [exportError, setExportError] = useState(null);

  const tmpl  = STRIP_TEMPLATES.find(t => t.id === templateId) ?? STRIP_TEMPLATES[0];
  const shots = tmpl.frames.length;                          // photos per session for this template

  const runTok   = useRef(0);
  const srcCache = useRef(new Map());                        // url -> Promise<canvas>

  const samples = useMemo(() => Array.from({ length: MAX_SHOTS }, (_, i) => makeSample(i)), []);
  const urls = cap.photoUrls;
  const photoCount = urls.length;
  const dateText = useMemo(dateStamp, []);
  const canShoot = cam.isReady && !running;

  /* Template: decoded once, used unchanged for the preview and the download. */
  useEffect(() => {
    let on = true;
    loadStripTemplate(templateId).then(img => { if (on) setTemplate(img); }).catch(() => { /* falls back to a plain background */ });
    return () => { on = false; };
  }, [templateId]);

  /* Fonts: redraw compositions once Poppins has loaded (canvas text needs the face ready). */
  useEffect(() => {
    let on = true;
    document.fonts?.ready?.then(() => { if (on) setFontsTick(t => t + 1); });
    return () => { on = false; };
  }, []);

  /* Camera is on only while capturing. Permission is asked when the booth reaches the capture step. */
  useEffect(() => {
    if (step === 2) { cam.request(); cam.reattach?.(); }
    else cam.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* Leaving PhotoPop: stop the camera and free every cached image. */
  useEffect(() => () => {
    runTok.current++;
    cam.stop();
    cap.cancel();
    cap.reset();
    srcCache.current.clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Decode the captured photos. cap.photoUrls (the originals) are never changed. */
  useEffect(() => {
    let alive = true;
    const cache = srcCache.current;
    const getSrc = u => {
      if (!cache.has(u)) {
        const p = loadSource(u);
        cache.set(u, p);
        p.catch(() => cache.delete(u));
      }
      return cache.get(u);
    };
    for (const k of cache.keys()) if (!urls.includes(k)) cache.delete(k);

    (async () => {
      let srcs;
      try { srcs = await Promise.all(urls.map(getSrc)); }
      catch { if (alive) setLoadError('A photo could not be loaded. Retake that frame.'); return; }
      if (!alive) return;
      setLoadError(null);
      setPhotos(Array.from({ length: MAX_SHOTS }, (_, i) => srcs[i] ?? null));
    })();
    return () => { alive = false; };
  }, [urls]);

  const hasPhotos = photos.some(Boolean);

  /* Looks are applied to the photos (and to the sample before any photo exists). The look values are
     deferred so a slider stays responsive while the four photos are re-processed behind it. */
  const dFilter = useDeferredValue(filterId);
  const dIntensity = useDeferredValue(intensity);
  const dAdjust = useDeferredValue(adjust);
  const treated = useMemo(
    () => photos.map(p => (p ? applyLook(p, dFilter, dIntensity, dAdjust) : null)),
    [photos, dFilter, dIntensity, dAdjust]);
  const treatedSamples = useMemo(
    () => samples.map(p => applyLook(p, dFilter, dIntensity, dAdjust)),
    [samples, dFilter, dIntensity, dAdjust]);
  const previewSlots = hasPhotos ? treated : treatedSamples;

  /* Filter thumbnails: each filter drawn on one small sample, the same way the editor draws its own. */
  const filterThumbs = useMemo(() => {
    const base = downscale(makeSample(0), 240);
    return Object.fromEntries(FILTERS.map(f => [f.id, treatPhoto(base, f, 1, DEFAULT_ADJUST).toDataURL('image/jpeg', 0.85)]));
  }, []);

  /* Composition preview. Not built on the capture screen (it is not shown there). */
  const previewCanvas = useMemo(() => {
    if (step === 2) return null;
    return composeImage(LAYOUT, previewSlots, { scale: 1, dateText, template, frames: tmpl.frames });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewSlots, dateText, template, tmpl, fontsTick]);

  /* ── capture ── */
  const run = useCallback(async (opts) => {
    const tok = ++runTok.current;
    setRunning(true);
    try {
      await cap.start({ timerSecs: timer, photoCount: shots, soundEnabled: true, ...opts });
    } finally {
      if (runTok.current === tok) { setRunning(false); setRetakeIdx(null); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, timer, shots]);

  const startSession = () => {
    if (!canShoot || photoCount >= shots) return;
    run({ resume: true, retakeIndex: null });            // keeps the photos taken so far
  };

  const retakeShot = (idx) => {
    if (!canShoot) return;
    setRetakeIdx(idx);
    cap.rearm();                                         // the other frames stay
    run({ retakeIndex: idx });
  };

  const stopCapture = () => {
    runTok.current++;
    setRunning(false); setRetakeIdx(null);
    cap.cancel();
  };

  const clearAll = () => {
    if (running) return;
    cap.reset(); setRetakeIdx(null);
  };

  /* ── navigation ── */
  const handleBack = () => {
    if (running) return;
    if (step === 1) {
      if (photoCount > 0 && !window.confirm('Leave PhotoPop? Your photos will be discarded.')) return;
      onExit();
      return;
    }
    setStep(step - 1);                                   // photos are kept
  };

  const goFinish = () => {
    if (running || photoCount < shots) return;
    setStep(3);
  };

  const newSession = () => {
    cap.reset(); setRetakeIdx(null);
    setStep(2);
  };

  /* ── export ── */
  const download = useCallback(async () => {
    if (exporting || photos.slice(0, shots).some(s => !s)) return;
    setExporting(true); setExportError(null);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise(r => setTimeout(r, 30));          // let the Preparing state paint first
      const canvas = composeImage(LAYOUT, treated, { scale: 2, dateText, template, frames: tmpl.frames });
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png'));
      downloadBlob(blob, pngFilename('oldlunar studio-photopop-strip'));
    } catch (err) {
      console.error('PhotoPop export failed', err);
      setExportError('We could not create the image. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exporting, photos, treated, dateText, template, tmpl]);

  // The header shows either the "Finish" button or the counter, never both.
  const next = step === 2 && photoCount === shots && !running ? { label: 'Finish', onClick: goFinish } : null;
  const counter = step === 2 && !next ? `${photoCount}/${shots}` : null;

  const resetLook = () => { setFilterId(DEFAULT_FILTER); setIntensity(DEFAULT_INTENSITY); setAdjust(DEFAULT_ADJUST); };
  const lookChanged = filterId !== DEFAULT_FILTER || intensity !== DEFAULT_INTENSITY || !isDefaultAdjust(adjust);

  const startLabel = running ? 'Shooting…'
    : photoCount === 0 ? 'Start photos'
    : photoCount < shots ? `Continue (${shots - photoCount} left)`
    : 'All photos taken';

  return (
    <div className="pp-shell pb">
      <CaptureFlash active={cap.isFlashing} />
      <PhotoboothHeader step={step} titles={PP_TITLES} onBack={handleBack} backDisabled={running}
                        next={next} counter={counter} className="pp-hd" />

      <div className="pp-body">

        {/* ── 1 · Style ── */}
        {step === 1 && (
          <section className="pp-step" aria-labelledby="pp-style-h">
            <div className="pp-style-grid">
              <div className="pp-preview-col">
                <Preview canvas={previewCanvas} label="Classic Strip preview" />
                <p className="pp-note">{hasPhotos ? 'Your photos in this layout.' : 'Sample preview. Your photos appear here after you shoot.'}</p>
              </div>

              <div className="pp-choices">
                <div className="pp-intro">
                  <h2 id="pp-style-h" className="pp-h2">Classic Strip</h2>
                  <p className="pp-sub">Choose a template, take one photo per frame, then download the finished strip.</p>
                </div>

                <fieldset className="pp-field">
                  <legend className="pp-legend">Template</legend>
                  <div className="pp-templates" role="radiogroup" aria-label="Strip template">
                    {STRIP_TEMPLATES.map(t => (
                      <button key={t.id} type="button" role="radio" aria-checked={templateId === t.id}
                        className={`pp-card pp-template${templateId === t.id ? ' is-active' : ''}`}
                        disabled={photoCount > 0}
                        onClick={() => setTemplateId(t.id)}>
                        <img className="pp-template-img" src={templateUrl(t)} alt="" />
                        <span className="pp-card-t">{t.label}</span>
                        <span className="pp-card-s">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  {photoCount > 0 && <p className="pp-note">Retake all to change the template.</p>}
                </fieldset>

                <details className="pp-dd">
                  <summary className="pp-dd-sum">
                    <span className="pp-dd-l">Filter</span>
                    <span className="pp-dd-v">{FILTER_MAP[filterId]?.label ?? 'Normal'}{filterId !== DEFAULT_FILTER ? ` · ${intensity}%` : ''}</span>
                    <span className="pp-dd-chev" aria-hidden="true"><ChevronDown size={16} /></span>
                  </summary>
                  <div className="pp-dd-body">
                  <div className="pp-filters" role="radiogroup" aria-label="Photo filters">
                    {FILTERS.map(f => (
                      <button key={f.id} type="button" role="radio" aria-checked={filterId === f.id}
                        className={`pp-card pp-filter${filterId === f.id ? ' is-active' : ''}`}
                        onClick={() => setFilterId(f.id)}>
                        <img className="pp-filter-img" src={filterThumbs[f.id]} alt="" />
                        <span className="pp-card-t">{f.label}</span>
                      </button>
                    ))}
                  </div>
                  {filterId !== DEFAULT_FILTER && (
                    <label className="pp-slider">
                      <span className="pp-slider-l">Filter strength</span>
                      <input type="range" className="pp-range" min={0} max={100} step={1} value={intensity}
                        onChange={e => setIntensity(Number(e.target.value))} />
                    </label>
                  )}
                  </div>
                </details>

                <details className="pp-dd">
                  <summary className="pp-dd-sum">
                    <span className="pp-dd-l">Adjust</span>
                    <span className="pp-dd-v">{isDefaultAdjust(adjust) ? 'Default' : 'Adjusted'}</span>
                    <span className="pp-dd-chev" aria-hidden="true"><ChevronDown size={16} /></span>
                  </summary>
                  <div className="pp-dd-body">
                  <div className="pp-sliders">
                    {ADJUSTS.map(a => (
                      <label key={a.key} className="pp-slider">
                        <span className="pp-slider-l">{a.label}</span>
                        <input type="range" className="pp-range" min={a.min} max={a.max} step={1} value={adjust[a.key]}
                          onChange={e => setAdjust(prev => ({ ...prev, [a.key]: Number(e.target.value) }))} />
                      </label>
                    ))}
                  </div>
                  <button type="button" className="pp-link pp-link--start" onClick={resetLook} disabled={!lookChanged}>Reset look</button>
                  </div>
                </details>
                <p className="pp-note">The strip frame and background come from the template and stay the same.</p>

                <button type="button" className="pp-btn pp-btn--primary pp-btn--block"
                  onClick={() => setStep(hasPhotos && photoCount === shots ? 3 : 2)}>
                  {hasPhotos && photoCount === shots ? 'Back to your strip' : 'Continue to camera'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── 2 · Capture ── */}
        {step === 2 && (
          <section className="pp-step pp-capture" aria-label="Capture photos">
            <div className="pp-cam-col">
              <div className="pp-stage">
                <video
                  ref={cam.videoRef}
                  className="pp-video"
                  autoPlay playsInline muted disablePictureInPicture
                  style={{ visibility: cam.isReady ? 'visible' : 'hidden' }}
                />
                {!cam.isReady && <CameraStatus cam={cam} />}
                {cam.isReady && cap.captureState === CS.COUNTDOWN && cap.countdown != null && (
                  <div className="pp-count" key={cap.countdown} aria-live="assertive" aria-label={`${cap.countdown}`}>{cap.countdown}</div>
                )}
                {cam.isReady && !running && (
                  <div className="pp-stage-start">
                    <div className="pp-timer" role="radiogroup" aria-label="Countdown before each photo">
                      {TIMER_CHOICES.map(s => (
                        <button key={s} type="button" role="radio" aria-checked={timer === s}
                          className={`pp-chip${timer === s ? ' is-active' : ''}`}
                          disabled={running} onClick={() => setTimer(s)}>
                          {s === 0 ? 'Instant' : `${s}s`}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="pp-btn pp-btn--primary" onClick={startSession}
                      disabled={!canShoot || photoCount >= shots}>
                      {startLabel}
                    </button>
                  </div>
                )}
              </div>

              {cam.notice && (
                <div className="pp-notice" role="status">
                  <span>{cam.notice}</span>
                  <button type="button" className="pp-link" onClick={cam.clearNotice}>Dismiss</button>
                </div>
              )}

              <div className="pp-cam-tools">
                {cam.canSwitch && (
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={cam.switchCamera}
                    disabled={cam.switching || running}>
                    Switch camera
                  </button>
                )}
              </div>
            </div>

            <div className="pp-slots-col">
              <p className="pp-slots-h">Your {shots} frames</p>
              <div className="pp-slots">
                {Array.from({ length: shots }, (_, i) => {
                  const url = urls[i];
                  return (
                    <button key={i} type="button"
                      className={`pp-slot${retakeIdx === i ? ' is-retaking' : ''}`}
                      aria-label={url ? `Photo ${i + 1}, tap to retake` : `Photo ${i + 1}, empty`}
                      disabled={running && !url}
                      onClick={() => (url ? retakeShot(i) : startSession())}>
                      {url ? <img src={url} alt="" /> : null}
                      <span className="pp-slot-n">{i + 1}</span>
                    </button>
                  );
                })}
              </div>

              {cap.error && (
                <div className="pp-notice pp-notice--error" role="alert">
                  <span>{cap.error}</span>
                  <button type="button" className="pp-link" onClick={() => { cap.clearError(); startSession(); }}>Try again</button>
                </div>
              )}
              {loadError && <p className="pp-notice pp-notice--error" role="alert">{loadError}</p>}

              <div className="pp-actions">
                {running ? (
                  <>
                    {cap.captureState === CS.COUNTDOWN && (
                      <button type="button" className="pp-btn pp-btn--ghost" onClick={cap.skip}>Skip countdown</button>
                    )}
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={stopCapture}>Stop</button>
                  </>
                ) : (
                  photoCount > 0 && (
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={clearAll}>Retake all</button>
                  )
                )}
              </div>
              <p className="pp-note">Tap a frame to retake just that photo. The others stay.</p>
            </div>
          </section>
        )}

        {/* ── 3 · Download ── */}
        {step === 3 && (
          <section className="pp-step pp-finish" aria-labelledby="pp-final-h">
            <div className="pp-finish-grid">
              <Preview canvas={previewCanvas} label="Final strip preview" />

              <div className="pp-finish-side">
                <h2 id="pp-final-h" className="pp-h2">Your strip is ready</h2>

                <div className="pp-actions pp-actions--col">
                  <button type="button" className="pp-btn pp-btn--primary pp-btn--block"
                    onClick={download} disabled={exporting || photos.slice(0, shots).some(s => !s)}>
                    {exporting ? 'Preparing image…' : 'Download PNG'}
                  </button>
                  <button type="button" className="pp-btn pp-btn--ghost pp-btn--block" onClick={() => setStep(1)}>Change look</button>
                  <button type="button" className="pp-btn pp-btn--ghost pp-btn--block" onClick={() => setStep(2)}>Retake photos</button>
                  <button type="button" className="pp-btn pp-btn--ghost pp-btn--block" onClick={newSession}>New session</button>
                </div>

                {exportError && <p className="pp-notice pp-notice--error" role="alert">{exportError}</p>}
                <p className="pp-note">Saved at 2× resolution. Photos are processed on your device and never uploaded.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}