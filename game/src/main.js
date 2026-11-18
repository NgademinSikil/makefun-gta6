// Solmar Heat — main loop: player on foot / driving, stealing, wanted,
// pickups, clock, save, and the window.SOLMAR hook points for slice B.
import * as THREE from 'three';
import { CFG } from './config.js';
import { buildCity, resolveCircleAABB } from './city.js';
import { makeCarMesh, Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { applyShot } from './shots.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.palette.sky);
scene.fog = new THREE.Fog(CFG.palette.sky, 180, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 6, -12);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a5a34, 1.15));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(120, 180, 60);
scene.add(sun);

const input = new Input();
input.attach(renderer.domElement);
const audio = new AudioSys();
const hud = new HUD(document);
const city = buildCity(scene);
const traffic = new Traffic(scene, city);
const peds = new Pedestrians(scene, city);
const police = new Police(scene, city, audio);

// --- parked cars + pickups ---
const parked = [];
for (const s of city.parkedSpots) {
  const mesh = makeCarMesh(s.color);
  scene.add(mesh);
  parked.push({ car: new Car(mesh, s.x, s.z, s.heading), taken: false });
}
const pickupMeshes = [];
const pickupMat = {
  cash: new THREE.MeshLambertMaterial({ color: 0x37d67a, emissive: 0x1a7a3a }),
  health: new THREE.MeshLambertMaterial({ color: 0xff5566, emissive: 0x7a1a22 }),
};
for (const p of city.pickupSpots) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 16), pickupMat[p.kind]);
  m.position.set(p.x, 0.5, p.z);
  scene.add(m);
  pickupMeshes.push({ mesh: m, kind: p.kind, x: p.x, z: p.z, taken: false, respawn: 0 });
}

// --- player ---
function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x27364f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2c34 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.66; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0xc23b3b }));
  cap.position.y = 1.86; g.add(cap);
  const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.geometry = legGeo.clone(); legL.geometry.translate(0, -0.36, 0);
  legL.position.set(-0.15, 0.72, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.geometry = legGeo.clone(); legR.geometry.translate(0, -0.36, 0);
  legR.position.set(0.15, 0.72, 0); g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

const state = {
  mode: 'menu', // menu | playing | paused | busted | wasted
  money: 120,
  health: CFG.player.maxHealth,
  armor: 0,
  wanted: 0,
  clockMinutes: CFG.clock.startHour * 60 + CFG.clock.startMinute,
  missionsDone: [],
  objective: 'Explore Solmar City. Find a car and press E to take it.',
  player: { x: 0, z: -40, heading: 0, speed: 0 },
  inCar: false,
  car: null,
  camYaw: Math.PI,
  camPitch: 0.32,
  lastDrag: -10,
  elapsed: 0,
  autosaveTimer: 0,
};
const playerMesh = makePlayerMesh();
scene.add(playerMesh);

// --- slice B hook points: missions register here, combat plugs in here ---
const SOLMAR = {
  state,
  city,
  hud,
  police,
  traffic,
  peds,
  missions: [],
  combat: null,
  addMission(m) { this.missions.push(m); if (m && m.objective) hud.setObjective(m.objective); },
  setCombat(api) { this.combat = api; },
  toast(msg) { hud.toast(msg); },
  addMoney(n) { state.money = Math.max(0, state.money + n); hud.setMoney(state.money); },
  setWanted(n) { police.setWanted(n); state.wanted = police.wanted; hud.setWanted(state.wanted); },
};
window.SOLMAR = SOLMAR;

// Slice B: expose the pieces missions/combat/shots need, then build them.
SOLMAR.scene = scene;
SOLMAR.camera = camera;
SOLMAR.input = input;
SOLMAR.audio = audio;
SOLMAR.damagePlayer = damagePlayer;
SOLMAR.stealCar = () => { const near = nearestParked(6); if (near) enterCar(near); };
SOLMAR.missionSystem = createMissions(SOLMAR);
SOLMAR.combatSystem = createCombat(SOLMAR);
SOLMAR.setCombat(SOLMAR.combatSystem);
SOLMAR.applyShot = (name, seed) => applyShot(SOLMAR, name, seed);

// Slice B: screenshot mode — a ?shot=<name> URL auto-starts the game, stages
// the scene and raises window.__shotReady for the shot driver. Deferred past
// the module's initial showScreen('screen-start') below, so the start screen
// does not come back over the staged scene.
const shotQuery = new URLSearchParams(location.search);
const shotName = shotQuery.get('shot');
if (shotName) {
  setTimeout(() => {
    startGame(false);
    setTimeout(() => {
      try { SOLMAR.applyShot(shotName, Number(shotQuery.get('seed') || 1)); } catch (err) { /* stage what we can */ }
      setTimeout(() => { window.__shotReady = true; }, 2200);
    }, 600);
  }, 50);
}

function showScreen(id) {
  for (const s of ['screen-start', 'screen-pause', 'screen-busted', 'screen-wasted']) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  // HUD visible during play and pause only.
  const hudVisible = id === null || id === 'screen-pause';
  document.getElementById('hud').classList.toggle('hidden', !hudVisible);
}

function startGame(fromSave) {
  const save = fromSave ? loadGame() : null;
  state.money = save ? save.money : 120;
  state.health = save ? save.health : CFG.player.maxHealth;
  state.armor = save ? save.armor : 0;
  state.wanted = save ? save.wanted : 0;
  state.clockMinutes = save ? save.clockMinutes : CFG.clock.startHour * 60 + CFG.clock.startMinute;
  state.missionsDone = save ? (save.missionsDone || []) : [];
  state.player.x = save ? save.player.x : 0;
  state.player.z = save ? save.player.z : -40;
  state.player.heading = save ? save.player.heading : 0;
  state.inCar = false;
  state.car = null;
  state.camYaw = state.player.heading + Math.PI;
  police.setWanted(state.wanted);
  hud.setMoney(state.money);
  hud.setHealth(state.health, CFG.player.maxHealth);
  hud.setArmor(state.armor, CFG.player.maxArmor);
  hud.setWanted(state.wanted);
  hud.setObjective(state.objective);
  hud.setClock(state.clockMinutes);
  playerMesh.visible = true;
  state.mode = 'playing';
  showScreen(null);
  audio.ensure();
  hud.toast(save ? 'Welcome back to Solmar City.' : 'Solmar City. Jax Rook owes Mara Quinn $5,000.');
}

function respawn(after) {
  if (after === 'busted') {
    state.money = Math.max(0, state.money - 150);
    hud.toast('Busted! Mara\'s people posted bail — $150 gone.');
  } else {
    state.money = Math.max(0, state.money - 100);
    hud.toast('Wasted! You wake up at the clinic — $100 gone.');
  }
  state.health = CFG.player.maxHealth;
  state.armor = 0;
  state.wanted = 0;
  police.setWanted(0);
  state.player.x = 0; state.player.z = -40; state.player.heading = 0;
  state.inCar = false; state.car = null;
  playerMesh.visible = true;
  hud.setMoney(state.money);
  hud.setHealth(state.health, CFG.player.maxHealth);
  hud.setArmor(state.armor, CFG.player.maxArmor);
  hud.setWanted(0);
  state.mode = 'playing';
  showScreen(null);
}

police.onBusted = () => {
  audio.busted();
  state.mode = 'busted';
  showScreen('screen-busted');
};
police.onRam = (dmg) => {
  audio.crash();
  damagePlayer(dmg);
};

function damagePlayer(dmg) {
  let rest = dmg;
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, rest);
    state.armor -= absorbed; rest -= absorbed;
  }
  state.health -= rest;
  hud.setArmor(state.armor, CFG.player.maxArmor);
  hud.setHealth(state.health, CFG.player.maxHealth);
  if (state.health <= 0) {
    state.mode = 'wasted';
    showScreen('screen-wasted');
  }
}

function nearestParked(maxD) {
  let best = null, bestD = maxD;
  for (const p of parked) {
    if (p.taken) continue;
    const d = Math.hypot(p.car.x - state.player.x, p.car.z - state.player.z);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

function enterCar(p) {
  p.taken = true;
  state.car = p.car;
  state.inCar = true;
  playerMesh.visible = false;
  state.player.heading = p.car.heading;
  audio.steal();
  police.addHeat(CFG.police.stealHeat);
  state.wanted = police.wanted;
  hud.setWanted(state.wanted);
  hud.toast('You stole a car! The heat is on — 1 star.');
}

function exitCar() {
  const c = state.car;
  const px = c.x - Math.sin(c.heading + Math.PI / 2) * 2.6;
  const pz = c.z - Math.cos(c.heading + Math.PI / 2) * 2.6;
  const fixed = resolveCircleAABB(px, pz, CFG.player.radius, city.colliders);
  state.player.x = fixed.x; state.player.z = fixed.z;
  state.player.heading = c.heading;
  state.inCar = false;
  state.car = null;
  playerMesh.visible = true;
}

function updatePlayer(dt) {
  const p = state.player;
  const cam = input.takeCameraDelta();
  if (cam.yaw !== 0 || cam.pitch !== 0) {
    state.camYaw -= cam.yaw;
    state.camPitch = Math.max(0.08, Math.min(1.0, state.camPitch + cam.pitch));
    state.lastDrag = state.elapsed;
  }
  const f = input.moveF, s = input.moveS;
  const moving = f !== 0 || s !== 0;
  const speed = input.run ? CFG.player.runSpeed : CFG.player.walkSpeed;
  // Movement is relative to the camera yaw.
  const fx = Math.sin(state.camYaw + Math.PI), fz = Math.cos(state.camYaw + Math.PI);
  const rx = Math.sin(state.camYaw + Math.PI / 2), rz = Math.cos(state.camYaw + Math.PI / 2);
  let mx = fx * f + rx * s, mz = fz * f + rz * s;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) {
    mx /= ml; mz /= ml;
    const wantHeading = Math.atan2(mx, mz);
    let dh = wantHeading - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    const fixed = resolveCircleAABB(nx, nz, CFG.player.radius, city.colliders);
    p.x = Math.max(city.bounds.minX + 1, Math.min(248, fixed.x));
    p.z = Math.max(city.bounds.minZ + 1, Math.min(city.bounds.maxZ - 1, fixed.z));
    p.speed = speed;
    const swing = Math.sin(state.elapsed * 11) * 0.55;
    playerMesh.userData.legL.rotation.x = swing;
    playerMesh.userData.legR.rotation.x = -swing;
  } else {
    p.speed = 0;
    playerMesh.userData.legL.rotation.x *= 0.8;
    playerMesh.userData.legR.rotation.x *= 0.8;
  }
  playerMesh.position.set(p.x, 0, p.z);
  playerMesh.rotation.y = p.heading;
  // Auto-align the camera behind the player when the mouse is idle.
  if (state.elapsed - state.lastDrag > 1.5) {
    const target = p.heading + Math.PI;
    let dh = target - state.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    state.camYaw += dh * Math.min(1, 1.8 * dt);
  }
  if (input.consume('e')) {
    const near = nearestParked(3.6);
    if (near) enterCar(near);
  }
}

function updateCar(dt) {
  const c = state.car;
  const cam = input.takeCameraDelta();
  if (cam.yaw !== 0 || cam.pitch !== 0) {
    state.camYaw -= cam.yaw;
    state.camPitch = Math.max(0.08, Math.min(1.0, state.camPitch + cam.pitch));
    state.lastDrag = state.elapsed;
  }
  c.drive(dt, {
    throttle: input.moveF,
    steer: -input.moveS,
    handbrake: input.handbrake,
  }, city.colliders, city.bounds, (spd) => { audio.crash(); damagePlayer(Math.round(spd * 0.4)); });
  state.player.x = c.x; state.player.z = c.z; state.player.heading = c.heading;
  state.player.speed = Math.abs(c.speed);
  if (state.elapsed - state.lastDrag > 1.5) {
    const target = c.heading + Math.PI;
    let dh = target - state.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    state.camYaw += dh * Math.min(1, 2.2 * dt);
  }
  if (input.consume('e')) exitCar();
}

function updateCamera(dt) {
  const p = state.player;
  const dist = state.inCar ? 11.5 : 8;
  const height = dist * Math.tan(state.camPitch) + (state.inCar ? 2.2 : 1.8);
  const cx = p.x + Math.sin(state.camYaw) * dist;
  const cz = p.z + Math.cos(state.camYaw) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(p.x, state.inCar ? 1.6 : 1.4, p.z);
}

function updatePickups(dt) {
  for (const pk of pickupMeshes) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        pk.taken = false;
        pk.mesh.visible = true;
      }
      continue;
    }
    pk.mesh.rotation.y += dt * 1.5;
    pk.mesh.position.y = 0.5 + Math.sin(state.elapsed * 2.5) * 0.12;
    const d = Math.hypot(pk.x - state.player.x, pk.z - state.player.z);
    if (d < 2.2) {
      pk.taken = true;
      pk.mesh.visible = false;
      pk.respawn = 40;
      audio.pickup();
      if (pk.kind === 'cash') {
        state.money += 50;
        hud.setMoney(state.money);
        hud.toast('Picked up $50 in loose cash.');
      } else {
        state.health = Math.min(CFG.player.maxHealth, state.health + 25);
        hud.setHealth(state.health, CFG.player.maxHealth);
        hud.toast('Health +25.');
      }
    }
  }
}

// --- buttons ---
document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => { state.mode = 'playing'; showScreen(null); });
document.getElementById('btn-quit').addEventListener('click', () => { state.mode = 'menu'; showScreen('screen-start'); });
document.getElementById('btn-busted-restart').addEventListener('click', () => respawn('busted'));
document.getElementById('btn-busted-menu').addEventListener('click', () => { state.mode = 'menu'; showScreen('screen-start'); });
document.getElementById('btn-wasted-restart').addEventListener('click', () => respawn('wasted'));
document.getElementById('btn-wasted-menu').addEventListener('click', () => { state.mode = 'menu'; showScreen('screen-start'); });
if (!hasSave()) document.getElementById('btn-continue').disabled = true;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- main loop ---
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.mode === 'playing') {
    state.elapsed += dt;
    if (input.consume('Escape')) { state.mode = 'paused'; showScreen('screen-pause'); }
    if (state.inCar) updateCar(dt); else updatePlayer(dt);
    traffic.update(dt, state.player);
    peds.update(dt);
    police.update(dt, {
      x: state.player.x, z: state.player.z,
      inCar: state.inCar, speed: state.player.speed || 0,
    });
    if (SOLMAR.missionSystem) SOLMAR.missionSystem.update(dt);
    if (SOLMAR.combatSystem) SOLMAR.combatSystem.update(dt);
    state.wanted = police.wanted;
    updatePickups(dt);
    // Clock advances.
    state.clockMinutes += CFG.clock.minutesPerSecond * dt;
    // HUD.
    hud.setHealth(state.health, CFG.player.maxHealth);
    hud.setArmor(state.armor, CFG.player.maxArmor);
    hud.setMoney(state.money);
    hud.setClock(state.clockMinutes);
    hud.setWanted(state.wanted);
    const kmh = state.inCar && state.car ? state.car.speed * 3.6 : (state.player.speed || 0) * 3.6;
    hud.setSpeed(kmh);
    hud.setBustedProgress(police.bustTimer / CFG.police.bustSeconds);
    audio.setEngine(state.inCar && state.car ? Math.abs(state.car.speed) / CFG.car.maxSpeed : 0, state.inCar);
    audio.setSiren(state.wanted > 0, dt);
    hud.drawMinimap({
      player: state.player,
      police: police.dots(),
      traffic: traffic.dots(),
      peds: peds.dots(),
      pickups: pickupMeshes.filter((p) => !p.taken),
      buildings: city.buildingRects,
      bounds: city.bounds,
    });
    // Autosave.
    state.autosaveTimer += dt;
    if (state.autosaveTimer > 20) {
      state.autosaveTimer = 0;
      saveGame(state);
    }
    updateCamera(dt);
  }
  input.endFrame();
  renderer.render(scene, camera);
}
showScreen('screen-start');
frame();
