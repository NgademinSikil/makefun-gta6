// Solmar Heat — the city: road grid, buildings, beach + bay, palms, lamps,
// central plaza. Returns colliders and spawn spots for the other systems.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, range, pick } from './random.js';

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 28) {
    for (let x = 10; x < 118; x += 24) {
      g.fillStyle = Math.random() < 0.45 ? '#ffd98a' : '#20242e';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildCity(scene) {
  const rng = mulberry32(1337);
  const W = CFG.world;
  const half = W.half;
  const colliders = [];
  const parkedSpots = [];
  const pickupSpots = [];
  const buildingRects = [];

  const facadeTex = windowTexture();

  // --- ground: grass west, sand strip, bay water east ---
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(half + W.beachX, half * 2),
    new THREE.MeshLambertMaterial({ color: CFG.palette.grass })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set((W.beachX - half) / 2, 0, 0);
  scene.add(grass);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half - W.beachX, half * 2),
    new THREE.MeshLambertMaterial({ color: CFG.palette.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((W.beachX + half) / 2, 0.01, 0);
  scene.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(260, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: CFG.palette.water })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(W.waterX + 130, 0.06, 0);
  scene.add(water);

  // --- roads: one dark strip per street line, plus centre dashes ---
  const streetCenters = [];
  for (let i = 0; i <= W.blocks; i++) streetCenters.push(-half + i * W.pitch);
  const roadMat = new THREE.MeshLambertMaterial({ color: CFG.palette.road });
  const dashMat = new THREE.MeshLambertMaterial({ color: CFG.palette.line });
  for (const s of streetCenters) {
    if (s > 240) continue; // eastmost street is under the beach
    const v = new THREE.Mesh(new THREE.PlaneGeometry(W.street, half * 2), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(s, 0.02, 0); scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, W.street), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, s); scene.add(h);
    // dashes down the middle of each street
    for (let d = -half + 20; d < half; d += 24) {
      const dv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      dv.rotation.x = -Math.PI / 2; dv.position.set(s, 0.03, d); scene.add(dv);
      const dh = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
      dh.rotation.x = -Math.PI / 2; dh.position.set(d, 0.03, s); scene.add(dh);
    }
  }

  // --- buildings: 1-3 per block, skipped on the plaza block and the beach ---
  const facadeColors = [CFG.palette.buildingA, CFG.palette.buildingB, CFG.palette.buildingC, CFG.palette.buildingD];
  for (let bi = 0; bi < W.blocks; bi++) {
    for (let bj = 0; bj < W.blocks; bj++) {
      const cx = -half + W.pitch / 2 + bi * W.pitch;
      const cz = -half + W.pitch / 2 + bj * W.pitch;
      if (cx > 180) continue;               // beach blocks stay open
      if (bi === 4 && bj === 4) continue;   // central plaza
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 12, 20);
        const d = range(rng, 12, 20);
        const h = range(rng, 9, 42);
        const ox = range(rng, -9, 9);
        const oz = range(rng, -9, 9);
        const x = cx + ox, z = cz + oz;
        const tex = facadeTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const mat = new THREE.MeshLambertMaterial({ color: pick(rng, facadeColors), map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z);
        scene.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x5a5f6a })
        );
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        buildingRects.push({ x: x - w / 2, z: z - d / 2, w, d });
      }
    }
  }

  // --- central plaza with fountain ---
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshLambertMaterial({ color: 0xcfc8b8 })
  );
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.04, 0);
  scene.add(plaza);
  const fountainBase = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x9aa0a8 })
  );
  fountainBase.position.set(0, 0.6, 0); scene.add(fountainBase);
  const fountainWater = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 24),
    new THREE.MeshLambertMaterial({ color: CFG.palette.water })
  );
  fountainWater.rotation.x = -Math.PI / 2; fountainWater.position.set(0, 1.25, 0);
  scene.add(fountainWater);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });

  // --- palms along the beach and a few inland ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: CFG.palette.trunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: CFG.palette.palm });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.y = 3; g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 5), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 6.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let z = -250; z <= 250; z += 28) { palm(W.beachX + 6, z + range(rng, -6, 6)); }
  for (let i = 0; i < 14; i++) palm(range(rng, -200, 180), range(rng, -250, 250));

  // --- street lamps ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (const s of streetCenters) {
    if (s > 240) continue;
    for (let d = -240; d <= 240; d += 120) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), poleMat);
      pole.position.set(s + 6.5, 2.75, d); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(s + 6.5, 5.6, d); scene.add(bulb);
    }
  }

  // --- parked cars (stealable) along street edges ---
  const carColors = [0xc23b3b, 0x3b6fc2, 0xe0b13b, 0x4a4f55, 0x7ab648, 0xd8d8d8, 0x8a4fc2];
  const spotStreets = [-210, -150, -90, -30, 30, 90, 150, 210];
  for (let i = 0; i < 12; i++) {
    const vertical = rng() < 0.5;
    const s = pick(rng, spotStreets);
    const along = range(rng, -230, 230);
    const x = vertical ? s + 4.5 : along;
    const z = vertical ? along : s + 4.5;
    const heading = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    parkedSpots.push({ x, z, heading, color: pick(rng, carColors) });
  }

  // --- pickups: glowing cash/health markers on sidewalks ---
  const pickupDefs = [
    { x: 40, z: 40, kind: 'cash' }, { x: -120, z: 80, kind: 'cash' },
    { x: 150, z: -140, kind: 'cash' }, { x: -60, z: -180, kind: 'health' },
    { x: 90, z: 190, kind: 'health' }, { x: -190, z: -60, kind: 'cash' },
  ];
  for (const p of pickupDefs) pickupSpots.push(p);

  return {
    colliders, parkedSpots, pickupSpots, buildingRects,
    bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
  };
}

// Circle (x,z,r) vs AABB push-out. Returns corrected {x,z} or null if free.
export function resolveCircleAABB(x, z, r, colliders) {
  let px = x, pz = z;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx, dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * r;
        pz = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushL = px - c.minX + r, pushR = c.maxX - px + r;
        const pushT = pz - c.minZ + r, pushB = c.maxZ - pz + r;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) px = c.minX - r;
        else if (m === pushR) px = c.maxX + r;
        else if (m === pushT) pz = c.minZ - r;
        else pz = c.maxZ + r;
      }
    }
  }
  return { x: px, z: pz };
}
