// Solmar Heat — localStorage save / continue. Plain JSON, versioned key.
import { CFG } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: state.money,
      health: state.health,
      armor: state.armor,
      wanted: state.wanted,
      clockMinutes: state.clockMinutes,
      player: { x: state.player.x, z: state.player.z, heading: state.player.heading },
      missionsDone: state.missionsDone || [],
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() { return loadGame() !== null; }
export function clearSave() { try { localStorage.removeItem(CFG.saveKey); } catch (err) {} }
