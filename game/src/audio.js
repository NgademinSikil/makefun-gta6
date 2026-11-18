// Solmar Heat — all sound is synthesized with WebAudio. No audio files.
// Created lazily on the first user gesture so browsers allow it.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // Engine: low sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Siren: square wave alternating two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.06 : 0.0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
  }

  setSiren(on, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0.0, t, 0.1);
    if (!on) return;
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.45) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 660, t, 0.05);
    }
  }

  blip(freq = 660, dur = 0.12, type = 'sine', vol = 0.18) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  pickup() { this.blip(880, 0.15); setTimeout(() => this.blip(1320, 0.18), 90); }
  steal() { this.blip(220, 0.2, 'square', 0.15); }
  crash() { this.blip(90, 0.25, 'sawtooth', 0.25); }
  busted() { this.blip(440, 0.4, 'triangle', 0.2); setTimeout(() => this.blip(330, 0.5, 'triangle', 0.2), 200); }
}
