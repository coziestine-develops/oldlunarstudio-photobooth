/**
 * OldLunar — Web Audio API Sound Engine
 * All sounds are synthesised. AudioContext is created lazily after user gesture.
 * Every function accepts an `enabled` boolean — pass `false` to silence.
 */

let _ctx = null;
const MASTER = 0.20;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(()=>{});
  return _ctx;
}
function gain(c, val) {
  const g = c.createGain(); g.gain.value = val * MASTER; g.connect(c.destination); return g;
}

/** Call once on first user interaction to unlock autoplay. */
export function initAudio() {
  try { ctx(); } catch(_) {}
}

/** Countdown beep — short sine. Higher pitch at count=1. */
export function playBeep(count = 3, enabled = true) {
  if (!enabled) return;
  try {
    const c = ctx(), freq = count === 1 ? 1200 : 860;
    const osc = c.createOscillator();
    const g   = gain(c, 0.5);
    osc.type = 'sine'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.5*MASTER, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.11);
    osc.connect(g); osc.start(); osc.stop(c.currentTime+0.13);
  } catch(_) {}
}

/** Camera shutter — noise burst + click tone. */
export function playShutter(enabled = true) {
  if (!enabled) return;
  try {
    const c = ctx();
    // noise burst
    const len = Math.round(c.sampleRate * 0.055);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(c.sampleRate*0.016));
    const src = c.createBufferSource(); src.buffer = buf;
    const g1  = gain(c, 0.65); src.connect(g1); src.start();
    // click tone
    const osc = c.createOscillator();
    const g2  = gain(c, 0.30);
    osc.type = 'square';
    osc.frequency.setValueAtTime(2200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, c.currentTime+0.045);
    g2.gain.setValueAtTime(0.30*MASTER, c.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.055);
    osc.connect(g2); osc.start(); osc.stop(c.currentTime+0.06);
  } catch(_) {}
}

/** Success chime — ascending triad. */
export function playSuccess(enabled = true) {
  if (!enabled) return;
  try {
    const c = ctx();
    [[880,0],[1100,0.08],[1320,0.16]].forEach(([freq,delay]) => {
      const osc=c.createOscillator(), g=gain(c,0.38);
      osc.type='sine'; osc.frequency.value=freq;
      g.gain.setValueAtTime(0,c.currentTime+delay);
      g.gain.linearRampToValueAtTime(0.38*MASTER,c.currentTime+delay+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+0.32);
      osc.connect(g); osc.start(c.currentTime+delay); osc.stop(c.currentTime+delay+0.36);
    });
  } catch(_) {}
}

/** Subtle UI click. */
export function playClick(enabled = true) {
  if (!enabled) return;
  try {
    const c=ctx(), osc=c.createOscillator(), g=gain(c,0.18);
    osc.type='sine'; osc.frequency.value=560;
    g.gain.setValueAtTime(0.18*MASTER,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.04);
    osc.connect(g); osc.start(); osc.stop(c.currentTime+0.05);
  } catch(_) {}
}

/** Filter select blip. */
export function playFilterBlip(enabled = true) {
  if (!enabled) return;
  try {
    const c=ctx(), osc=c.createOscillator(), g=gain(c,0.15);
    osc.type='sine';
    osc.frequency.setValueAtTime(860,c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1080,c.currentTime+0.055);
    g.gain.setValueAtTime(0.15*MASTER,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.07);
    osc.connect(g); osc.start(); osc.stop(c.currentTime+0.08);
  } catch(_) {}
}

/** Download confirmation. */
export function playDownload(enabled = true) {
  if (!enabled) return;
  try {
    const c=ctx();
    [[660,0],[990,0.09]].forEach(([freq,delay]) => {
      const osc=c.createOscillator(), g=gain(c,0.28);
      osc.type='sine'; osc.frequency.value=freq;
      g.gain.setValueAtTime(0.28*MASTER,c.currentTime+delay);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+0.20);
      osc.connect(g); osc.start(c.currentTime+delay); osc.stop(c.currentTime+delay+0.22);
    });
  } catch(_) {}
}
