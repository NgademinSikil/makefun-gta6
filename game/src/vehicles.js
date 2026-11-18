// Solmar Heat — car meshes and arcade driving physics.
import * as THREE from 'three';
import { CFG } from './config.js';
import { resolveCircleAABB } from './city.js';

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.25); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.2), bodyMat);
  roof.position.set(0, 1.4, -0.25); g.add(roof);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w); wheels.push(w);
  }
  // Headlights + taillights.
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x776622 }));
  hl.position.set(0, 0.62, 2.21); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x551111 }));
  tl.position.set(0, 0.62, -2.21); g.add(tl);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.5, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.set(-0.28, 1.5, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.set(0.28, 1.5, -0.25); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  get pos() { return { x: this.x, z: this.z }; }
  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  // Arcade drive. input: {throttle -1..1, steer -1..1, handbrake bool}.
  // onCrash(speed) fires when the car slams into a building.
  drive(dt, input, colliders, bounds, onCrash) {
    const C = CFG.car;
    const targetSteer = input.steer * C.steerMax * (this.speed >= 0 ? 1 : -1);
    const steerRate = input.handbrake ? 6 : 4;
    this.steer += (targetSteer - this.steer) * Math.min(1, steerRate * dt);
    if (input.throttle > 0) this.speed += C.accel * input.throttle * dt;
    else if (input.throttle < 0) {
      if (this.speed > 0.5) this.speed -= C.brake * dt;
      else this.speed += C.accel * 0.45 * input.throttle * dt; // reverse
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    }
    if (input.handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 18 * dt);
    this.speed = Math.max(-C.reverseMax, Math.min(C.maxSpeed, this.speed));
    const grip = input.handbrake ? 2.2 : 5.5;
    this.heading += this.steer * (this.speed / C.maxSpeed) * grip * dt * (this.speed >= 0 ? 1 : -1) * 0.9;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const nx = this.x + fx * this.speed * dt;
    const nz = this.z + fz * this.speed * dt;
    const hit = resolveCircleAABB(nx, nz, C.radius, colliders);
    const crashed = Math.abs(hit.x - nx) > 0.01 || Math.abs(hit.z - nz) > 0.01;
    this.x = Math.max(bounds.minX + 2, Math.min(bounds.maxX - 2, hit.x));
    this.z = Math.max(bounds.minZ + 2, Math.min(bounds.maxZ - 2, hit.z));
    if (crashed && Math.abs(this.speed) > 6 && onCrash) onCrash(Math.abs(this.speed));
    if (crashed) this.speed *= 0.45;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}
