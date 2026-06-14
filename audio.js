class AudioManager {
  constructor() {
    this._ac = null;
    this._master = null;
  }

  _init() {
    if (this._ac) return;
    this._ac = new (window.AudioContext || window.webkitAudioContext)();
    this._master = this._ac.createGain();
    this._master.gain.value = 0.5;
    this._master.connect(this._ac.destination);
  }

  _resume() {
    if (this._ac && this._ac.state === 'suspended') this._ac.resume();
  }

  _tone(freq, t, dur, type = 'sine', vol = 0.15) {
    const ac = this._ac;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(this._master);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(dur, 0.02));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, lowpass) {
    const ac = this._ac;
    const size = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, size, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = lowpass;
    f.Q.value = 1.5;
    const g = ac.createGain();
    src.connect(f); f.connect(g); g.connect(this._master);
    const t = ac.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Bullet fired
  shoot() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    this._tone(880, t, 0.06, 'square', 0.10);
    this._tone(660, t + 0.03, 0.04, 'square', 0.06);
  }

  // Bullet bounces off wall
  bounce() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    this._tone(1200, t, 0.05, 'sine', 0.08);
  }

  // Target hit (takes damage but not destroyed)
  hit() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    this._tone(440, t, 0.08, 'square', 0.12);
    this._tone(330, t + 0.04, 0.06, 'square', 0.08);
  }

  // Target destroyed
  destroy() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    this._tone(880, t, 0.05, 'square', 0.15);
    this._tone(660, t + 0.04, 0.05, 'square', 0.12);
    this._tone(440, t + 0.08, 0.08, 'square', 0.10);
    this._noise(0.18, 0.20, 800);
  }

  // Stage clear
  stageClear() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => this._tone(f, t + i * 0.12, 0.18, 'sine', 0.18));
  }

  // Stage failed (no shots left)
  stageFail() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    this._tone(440, t, 0.12, 'sawtooth', 0.15);
    this._tone(330, t + 0.1, 0.12, 'sawtooth', 0.12);
    this._tone(220, t + 0.2, 0.20, 'sawtooth', 0.10);
  }

  // Direct hit miss (buzzer)
  miss() {
    this._init(); this._resume();
    const ac = this._ac, t = ac.currentTime;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(this._master);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t); osc.stop(t + 0.3);
  }

  // All stages cleared
  allClear() {
    this._init(); this._resume();
    const t = this._ac.currentTime;
    const melody = [523, 659, 784, 1047, 1047, 784, 1047];
    melody.forEach((f, i) => this._tone(f, t + i * 0.1, 0.18, 'sine', 0.18));
  }
}

window.audioManager = new AudioManager();
