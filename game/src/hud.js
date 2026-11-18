// Solmar Heat — HUD: bars, readouts, toasts, and the live 2D minimap.
import { CFG } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.healthFill = doc.getElementById('hud-health-fill');
    this.armorFill = doc.getElementById('hud-armor-fill');
    this.speedEl = doc.getElementById('hud-speed');
    this.moneyEl = doc.getElementById('hud-money');
    this.clockEl = doc.getElementById('hud-clock');
    this.starsEl = doc.getElementById('hud-stars');
    this.objectiveEl = doc.getElementById('hud-objective');
    this.toastEl = doc.getElementById('hud-toast');
    this.bustedTimerEl = doc.getElementById('hud-busted-timer');
    this.map = doc.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this._toastTimer = null;
  }

  setHealth(v, max) { this.healthFill.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`; }
  setArmor(v, max) { this.armorFill.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`; }
  setSpeed(kmh) { this.speedEl.textContent = `${Math.round(Math.abs(kmh))}`; }
  setMoney(n) { this.moneyEl.textContent = `$${Math.floor(n)}`; }
  setClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  setWanted(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.classList.toggle('hot', n > 0);
  }
  setObjective(text) { this.objectiveEl.textContent = text; }
  setBustedProgress(frac) {
    if (frac > 0) {
      this.bustedTimerEl.style.display = 'block';
      this.bustedTimerEl.textContent = `BUSTED IN ${Math.max(0, 2 - frac * 2).toFixed(1)}s — RUN!`;
    } else {
      this.bustedTimerEl.style.display = 'none';
    }
  }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  // snap: {player {x,z,heading}, police[], traffic[], peds[], pickups[], buildings[], bounds}
  drawMinimap(snap) {
    const ctx = this.mapCtx;
    const S = 180;
    const b = snap.bounds;
    const sx = (x) => ((x - b.minX) / (b.maxX - b.minX)) * S;
    const sz = (z) => ((z - b.minZ) / (b.maxZ - b.minZ)) * S;
    ctx.clearRect(0, 0, S, S);
    // Land, beach, water.
    ctx.fillStyle = '#3f7d3c'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(sx(CFG.world.beachX), 0, sx(CFG.world.waterX) - sx(CFG.world.beachX), S);
    ctx.fillStyle = '#2e7fb8';
    ctx.fillRect(sx(CFG.world.waterX), 0, S - sx(CFG.world.waterX), S);
    // Roads.
    ctx.fillStyle = '#2b2f36';
    for (let i = 0; i <= CFG.world.blocks; i++) {
      const s = -CFG.world.half + i * CFG.world.pitch;
      if (s > 240) continue;
      ctx.fillRect(sx(s) - 2, 0, 4, S);
      ctx.fillRect(0, sz(s) - 2, S, 4);
    }
    // Buildings.
    ctx.fillStyle = '#5a5f6a';
    for (const r of snap.buildings) ctx.fillRect(sx(r.x), sz(r.z), Math.max(1, (r.w / (b.maxX - b.minX)) * S), Math.max(1, (r.d / (b.maxZ - b.minZ)) * S));
    // Pickups.
    ctx.fillStyle = '#37d67a';
    for (const p of snap.pickups) { ctx.beginPath(); ctx.arc(sx(p.x), sz(p.z), 2.5, 0, Math.PI * 2); ctx.fill(); }
    // Traffic + peds.
    ctx.fillStyle = '#f2c14e';
    for (const t of snap.traffic) { ctx.fillRect(sx(t.x) - 1.5, sz(t.z) - 1.5, 3, 3); }
    ctx.fillStyle = '#ffffff';
    for (const p of snap.peds) { ctx.fillRect(sx(p.x) - 1, sz(p.z) - 1, 2, 2); }
    // Police.
    ctx.fillStyle = '#ff3344';
    for (const p of snap.police) { ctx.beginPath(); ctx.arc(sx(p.x), sz(p.z), 3, 0, Math.PI * 2); ctx.fill(); }
    // Player arrow.
    const px = sx(snap.player.x), pz = sz(snap.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(snap.player.heading), Math.cos(snap.player.heading)) * 0 + snap.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
