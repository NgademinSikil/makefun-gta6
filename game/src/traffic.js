// Solmar Heat — ambient traffic: cars looping the streets around blocks,
// slowing when the player blocks the road ahead.
import { CFG } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { makeCarMesh, Car } from './vehicles.js';

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    const rng = mulberry32(4242);
    const colors = [0xc23b3b, 0x3b6fc2, 0xe0b13b, 0x4a4f55, 0x7ab648, 0xd8d8d8, 0x8a4fc2, 0xe08a3b];
    const W = CFG.world;
    for (let i = 0; i < CFG.traffic.count; i++) {
      // A loop is the rectangle of street centrelines around one block.
      const bi = 1 + Math.floor(rng() * (W.blocks - 2));
      const bj = 1 + Math.floor(rng() * (W.blocks - 2));
      const cx = -W.half + W.pitch / 2 + bi * W.pitch;
      const cz = -W.half + W.pitch / 2 + bj * W.pitch;
      const loop = {
        minX: cx - W.pitch / 2, maxX: cx + W.pitch / 2,
        minZ: cz - W.pitch / 2, maxZ: cz + W.pitch / 2,
      };
      const mesh = makeCarMesh(pick(rng, colors));
      scene.add(mesh);
      const car = new Car(mesh, loop.minX, loop.minZ, 0);
      // Start at a random point on the loop perimeter.
      const per = 2 * (loop.maxX - loop.minX) + 2 * (loop.maxZ - loop.minZ);
      let d = rng() * per;
      const w = loop.maxX - loop.minX, h = loop.maxZ - loop.minZ;
      if (d < w) { car.x = loop.minX + d; car.z = loop.minZ; car.heading = Math.PI / 2; }
      else if (d < w + h) { car.x = loop.maxX; car.z = loop.minZ + (d - w); car.heading = 0; }
      else if (d < 2 * w + h) { car.x = loop.maxX - (d - w - h); car.z = loop.maxZ; car.heading = -Math.PI / 2; }
      else { car.x = loop.minX; car.z = loop.maxZ - (d - 2 * w - h); car.heading = Math.PI; }
      this.cars.push({
        car, loop,
        speed: range(rng, CFG.traffic.speedMin, CFG.traffic.speedMax),
        cruise: range(rng, CFG.traffic.speedMin, CFG.traffic.speedMax),
      });
    }
  }

  update(dt, playerPos) {
    for (const t of this.cars) {
      const c = t.car, L = t.loop;
      // Yield if the player is close ahead of this car.
      let blocked = false;
      if (playerPos) {
        const dx = playerPos.x - c.x, dz = playerPos.z - c.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 9) {
          const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
          if (dx * fx + dz * fz > 0) blocked = true;
        }
      }
      const target = blocked ? 0 : t.cruise;
      c.speed += (target - c.speed) * Math.min(1, 2.5 * dt);
      // Follow the rectangle: steer toward the next corner.
      const corners = [
        { x: L.maxX, z: L.minZ }, { x: L.maxX, z: L.maxZ },
        { x: L.minX, z: L.maxZ }, { x: L.minX, z: L.minZ },
      ];
      // Find the corner we are heading for: the next one after our position.
      let targetCorner = corners[0];
      let best = Infinity;
      for (const corner of corners) {
        const dx = corner.x - c.x, dz = corner.z - c.z;
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        const ahead = dx * fx + dz * fz;
        const d = Math.hypot(dx, dz);
        if (ahead > -2 && d < best) { best = d; targetCorner = corner; }
      }
      const want = Math.atan2(targetCorner.x - c.x, targetCorner.z - c.z);
      let dh = want - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const spin = c.speed * dt / 0.36;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }
  }

  dots() { return this.cars.map((t) => ({ x: t.car.x, z: t.car.z })); }
}
