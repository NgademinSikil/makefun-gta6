// Solmar Heat — wanted level and police cruisers: chase, ram, bust.
import { CFG } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';

export class Police {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.wanted = 0;
    this.cruisers = [];
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.flashTimer = 0;
    this.onBusted = null;
    this.onRam = null;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.decayTimer = 0;
    this.bustTimer = 0;
  }

  addHeat(n) { this.setWanted(this.wanted + n); }

  spawnCruiserNear(x, z) {
    const mesh = makeCarMesh(0xf2f2f2, true);
    this.scene.add(mesh);
    const a = Math.random() * Math.PI * 2;
    const sx = x + Math.cos(a) * 45, sz = z + Math.sin(a) * 45;
    const car = new Car(mesh, sx, sz, 0);
    this.cruisers.push({ car, cooldown: 0 });
  }

  update(dt, player) {
    // Keep cruiser count in line with the wanted level.
    const want = this.wanted === 0 ? 0 : Math.min(CFG.police.maxCruisers, this.wanted + 1);
    while (this.cruisers.length < want) this.spawnCruiserNear(player.x, player.z);
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.car.mesh);
    }

    // Flashing light bars.
    this.flashTimer += dt;
    const redOn = Math.floor(this.flashTimer * 4) % 2 === 0;
    for (const c of this.cruisers) {
      const m = c.car.mesh.userData;
      if (m.lightRed) m.lightRed.material.emissive.setHex(redOn ? 0xff0000 : 0x220000);
      if (m.lightBlue) m.lightBlue.material.emissive.setHex(redOn ? 0x000022 : 0x0000ff);
    }

    let nearest = Infinity;
    for (const c of this.cruisers) {
      const car = c.car;
      const dx = player.x - car.x, dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const speedTarget = dist > 60 ? CFG.police.chaseSpeed : CFG.police.chaseSpeed * 0.85;
      car.speed += (speedTarget - car.speed) * Math.min(1, 1.5 * dt);
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.36;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
      c.cooldown -= dt;
      // Ram: contact with the player's car hurts and shoves.
      if (dist < 3.4 && c.cooldown <= 0) {
        c.cooldown = 1.2;
        if (player.inCar) {
          if (this.onRam) this.onRam(CFG.police.ramDamage);
        } else if (player.speed < 1.5) {
          this.bustTimer += 1; // standing still next to a cruiser counts fast
        }
      }
    }

    // Busted: on foot, a cruiser sits on top of you.
    if (!player.inCar && this.cruisers.length > 0 && nearest < 3.2 && player.speed < 1.5) {
      this.bustTimer += dt;
      if (this.bustTimer >= CFG.police.bustSeconds) {
        this.bustTimer = 0;
        if (this.onBusted) this.onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // Wanted decays when no cruiser is close.
    if (this.wanted > 0 && nearest > 30) {
      this.decayTimer += dt;
      if (this.decayTimer >= CFG.police.decaySeconds) {
        this.decayTimer = 0;
        this.setWanted(this.wanted - 1);
      }
    } else {
      this.decayTimer = 0;
    }
  }

  dots() { return this.cruisers.map((c) => ({ x: c.car.x, z: c.car.z })); }
}
