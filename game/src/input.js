// Solmar Heat — keyboard + mouse-drag camera input. Edge-triggered actions
// (interact, pause) are consumed once by the main loop via consume().
export class Input {
  constructor() {
    this.keys = new Set();
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this._pressed = new Set();
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this._pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMouseDown = (e) => { this._dragging = true; this._lastX = e.clientX; this._lastY = e.clientY; };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      this.yawDelta += (e.clientX - this._lastX) * 0.005;
      this.pitchDelta += (e.clientY - this._lastY) * 0.004;
      this._lastX = e.clientX; this._lastY = e.clientY;
    };
    this._onMouseUp = () => { this._dragging = false; };
    this._onBlur = () => { this.keys.clear(); this._dragging = false; };
  }

  attach(target) {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    target.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  down(k) { return this.keys.has(k); }
  // True once per physical press.
  pressed(k) { return this._pressed.has(k); }
  consume(k) { const hit = this._pressed.has(k); this._pressed.delete(k); return hit; }

  get moveF() { return (this.down('w') || this.down('ArrowUp') ? 1 : 0) - (this.down('s') || this.down('ArrowDown') ? 1 : 0); }
  get moveS() { return (this.down('d') || this.down('ArrowRight') ? 1 : 0) - (this.down('a') || this.down('ArrowLeft') ? 1 : 0); }
  get run() { return this.down('Shift'); }
  get handbrake() { return this.down(' '); }

  // Camera deltas since last frame; call once per frame.
  takeCameraDelta() {
    const d = { yaw: this.yawDelta, pitch: this.pitchDelta };
    this.yawDelta = 0; this.pitchDelta = 0;
    return d;
  }

  endFrame() { this._pressed.clear(); }
}
