// Solmar Heat — combat: a pistol (F key or mouse click) and a punch (Q key),
// and the Viper crew who shoot back. Vipers are spawned by the missions; a hit
// on one raises the wanted level. Wired in through window.SOLMAR (see main.js).
import * as THREE from 'three';
import { resolveCircleAABB } from './city.js';

const PISTOL_DAMAGE = 15;
const PUNCH_DAMAGE = 10;
const VIPER_HEALTH = 30;
const VIPER_RANGE = 45;
const VIPER_SHOOT_RANGE = 18;
const VIPER_HIT_CHANCE = 0.45;
const VIPER_HIT_DAMAGE = 6;

function makeViperMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.85, 0.36), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.68; g.add(head);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 10),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  band.position.y = 1.86; g.add(band);
  const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.geometry = legGeo.clone(); legL.geometry.translate(0, -0.36, 0);
  legL.position.set(-0.15, 0.72, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.geometry = legGeo.clone(); legR.geometry.translate(0, -0.36, 0);
  legR.position.set(0.15, 0.72, 0); g.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.38, 1.15, 0.3); g.add(gun);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function createCombat(SOLMAR) {
  const scene = SOLMAR.scene;
  const vipers = [];
  let kills = 0;
  let shootCooldown = 0;
  let punchCooldown = 0;
  let tracer = null;
  let tracerTimer = 0;

  // Crosshair: a small dot in the middle of the screen, made here so the
  // slice A HTML needs no change.
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid rgba(255,255,255,0.9);border-radius:50%;pointer-events:none;z-index:6;display:none;';
  document.body.appendChild(cross);

  // A click (press and release without dragging) fires the pistol.
  let downAt = null;
  window.addEventListener('mousedown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  window.addEventListener('mouseup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const held = performance.now() - downAt.t;
    downAt = null;
    if (moved < 6 && held < 400 && SOLMAR.state.mode === 'playing') shoot();
  });

  function aimDir() {
    const dir = new THREE.Vector3();
    SOLMAR.camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    return dir.normalize();
  }

  function gunPos() {
    const p = SOLMAR.state.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    return new THREE.Vector3(p.x + fx * 0.6, 1.45, p.z + fz * 0.6);
  }

  function showTracer(from, to) {
    if (tracer) { scene.remove(tracer); tracer.geometry.dispose(); tracer = null; }
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    scene.add(tracer);
    tracerTimer = 0.09;
  }

  function hurtViper(v, dmg, fromX, fromZ) {
    v.health -= dmg;
    v.mesh.userData.bodyMat.emissive.setHex(0x661111);
    setTimeout(() => { if (v.mesh.userData.bodyMat) v.mesh.userData.bodyMat.emissive.setHex(0x000000); }, 120);
    // Knockback away from the shooter.
    const dx = v.x - fromX, dz = v.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    const fixed = resolveCircleAABB(v.x + (dx / d) * 0.7, v.z + (dz / d) * 0.7, 0.55, SOLMAR.city.colliders);
    v.x = fixed.x; v.z = fixed.z;
    if (v.health <= 0 && !v.dead) {
      v.dead = true;
      v.deadTimer = 0;
      kills += 1;
      SOLMAR.addMoney(25);
      SOLMAR.toast('Viper down. +$25 in loose cash.');
      SOLMAR.audio.blip(520, 0.25, 'triangle', 0.2);
    }
  }

  function shoot() {
    if (shootCooldown > 0 || SOLMAR.state.mode !== 'playing') return;
    shootCooldown = 0.35;
    const from = gunPos();
    const dir = aimDir();
    SOLMAR.audio.blip(1250, 0.07, 'square', 0.22);
    SOLMAR.audio.blip(300, 0.1, 'sawtooth', 0.12);
    // Nearest Viper inside a narrow cone in front of the camera.
    let best = null, bestScore = Infinity;
    for (const v of vipers) {
      if (v.dead) continue;
      const dx = v.x - from.x, dz = v.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > VIPER_RANGE) continue;
      const dot = (dx * dir.x + dz * dir.z) / (d || 1);
      if (dot < 0.985) continue; // about 10 degrees off axis
      const score = d + (1 - dot) * 40;
      if (score < bestScore) { best = v; bestScore = score; }
    }
    const end = best
      ? new THREE.Vector3(best.x, 1.2, best.z)
      : from.clone().add(dir.clone().multiplyScalar(38));
    showTracer(from, end);
    if (best) {
      hurtViper(best, PISTOL_DAMAGE, from.x, from.z);
      SOLMAR.setWanted(SOLMAR.state.wanted + 1);
    }
  }

  function punch() {
    if (punchCooldown > 0 || SOLMAR.state.mode !== 'playing') return;
    punchCooldown = 0.45;
    const p = SOLMAR.state.player;
    SOLMAR.audio.blip(180, 0.09, 'sine', 0.2);
    for (const v of vipers) {
      if (v.dead) continue;
      if (Math.hypot(v.x - p.x, v.z - p.z) < 2.6) {
        hurtViper(v, PUNCH_DAMAGE, p.x, p.z);
        SOLMAR.setWanted(SOLMAR.state.wanted + 1);
        SOLMAR.toast('You decked a Viper.');
        return;
      }
    }
  }

  function spawnViper(x, z) {
    const mesh = makeViperMesh();
    const bodyMat = mesh.children[0].material.clone();
    mesh.children[0].material = bodyMat;
    mesh.userData.bodyMat = bodyMat;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const v = { mesh, x, z, heading: 0, health: VIPER_HEALTH, attackCooldown: 0.8 + Math.random() * 0.8, dead: false, deadTimer: 0 };
    vipers.push(v);
    return v;
  }

  function update(dt) {
    if (SOLMAR.state.mode !== 'playing') {
      cross.style.display = 'none';
      return;
    }
    cross.style.display = 'block';
    shootCooldown = Math.max(0, shootCooldown - dt);
    punchCooldown = Math.max(0, punchCooldown - dt);
    if (SOLMAR.input.pressed('f')) shoot();
    if (SOLMAR.input.pressed('q')) punch();
    if (tracer) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) { scene.remove(tracer); tracer.geometry.dispose(); tracer = null; }
    }
    const p = SOLMAR.state.player;
    for (let i = vipers.length - 1; i >= 0; i--) {
      const v = vipers[i];
      if (v.dead) {
        v.deadTimer += dt;
        v.mesh.rotation.z = Math.min(Math.PI / 2, v.mesh.rotation.z + dt * 4);
        v.mesh.position.y = -Math.min(0.4, v.deadTimer * 0.3);
        if (v.deadTimer > 2.5) { scene.remove(v.mesh); vipers.splice(i, 1); }
        continue;
      }
      const dx = p.x - v.x, dz = p.z - v.z;
      const d = Math.hypot(dx, dz);
      v.heading = Math.atan2(dx, dz);
      v.mesh.rotation.y = v.heading;
      // Walk toward the player, hold at shooting range, never through walls.
      if (d > 9) {
        const nx = v.x + Math.sin(v.heading) * 3.2 * dt;
        const nz = v.z + Math.cos(v.heading) * 3.2 * dt;
        const fixed = resolveCircleAABB(nx, nz, 0.55, SOLMAR.city.colliders);
        v.x = fixed.x; v.z = fixed.z;
        const swing = Math.sin(SOLMAR.state.elapsed * 9) * 0.5;
        v.mesh.userData.legL.rotation.x = swing;
        v.mesh.userData.legR.rotation.x = -swing;
      } else {
        v.mesh.userData.legL.rotation.x *= 0.8;
        v.mesh.userData.legR.rotation.x *= 0.8;
      }
      v.mesh.position.set(v.x, 0, v.z);
      // Shoot back when close enough.
      v.attackCooldown -= dt;
      if (d < VIPER_SHOOT_RANGE && v.attackCooldown <= 0) {
        v.attackCooldown = 1.2;
        SOLMAR.audio.blip(900, 0.06, 'square', 0.1);
        if (Math.random() < VIPER_HIT_CHANCE) {
          SOLMAR.damagePlayer(VIPER_HIT_DAMAGE);
          SOLMAR.toast('A Viper shot you!');
        }
      }
    }
  }

  return {
    update, shoot, punch, spawnViper,
    get kills() { return kills; },
    viperCount() { return vipers.filter((v) => !v.dead).length; },
    get vipers() { return vipers; },
  };
}
