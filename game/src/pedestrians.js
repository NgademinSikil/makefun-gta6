// Solmar Heat — pedestrians strolling the sidewalks with a simple leg swing.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, range, pick } from './random.js';

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.walkers = [];
    const rng = mulberry32(777);
    const shirts = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe8e8e8, 0x333333];
    const W = CFG.world;
    for (let i = 0; i < CFG.peds.count; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, shirts) });
      const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
      const pants = new THREE.MeshLambertMaterial({ color: 0x2c3a4a });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
      body.position.y = 1.05; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
      head.position.y = 1.6; g.add(head);
      const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
      const legL = new THREE.Mesh(legGeo, pants);
      legL.geometry = legGeo.clone(); legL.geometry.translate(0, -0.35, 0);
      legL.position.set(-0.14, 0.7, 0); g.add(legL);
      const legR = new THREE.Mesh(legGeo, pants);
      legR.geometry = legGeo.clone(); legR.geometry.translate(0, -0.35, 0);
      legR.position.set(0.14, 0.7, 0); g.add(legR);
      scene.add(g);
      const x = range(rng, -W.half + 20, 200);
      const z = range(rng, -W.half + 20, W.half - 20);
      this.walkers.push({
        mesh: g, legL, legR,
        x, z,
        heading: rng() * Math.PI * 2,
        speed: range(rng, CFG.peds.speedMin, CFG.peds.speedMax),
        target: this.randomTarget(rng),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  randomTarget(rng) {
    const W = CFG.world;
    return { x: range(rng, -W.half + 20, 200), z: range(rng, -W.half + 20, W.half - 20) };
  }

  update(dt) {
    const rng = Math.random;
    for (const w of this.walkers) {
      const dx = w.target.x - w.x, dz = w.target.z - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { w.target = this.randomTarget(rng); continue; }
      const want = Math.atan2(dx, dz);
      let dh = want - w.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      w.heading += Math.max(-2.5 * dt, Math.min(2.5 * dt, dh));
      w.x += Math.sin(w.heading) * w.speed * dt;
      w.z += Math.cos(w.heading) * w.speed * dt;
      w.phase += dt * w.speed * 5;
      w.legL.rotation.x = Math.sin(w.phase) * 0.5;
      w.legR.rotation.x = -Math.sin(w.phase) * 0.5;
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.rotation.y = w.heading;
    }
  }

  dots() { return this.walkers.map((w) => ({ x: w.x, z: w.z })); }
}
