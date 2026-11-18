// Solmar Heat — story missions: Jax Rook pays off his $5,000 debt to Mara Quinn
// one job at a time. Four missions, run in order; each step is a checkpoint the
// player reaches (on foot or by car), and each finished mission pays out cash.
// Wired into the game through window.SOLMAR (see main.js).
import * as THREE from 'three';

// Open ground the player can always reach: street intersections, the plaza and
// the beach. (Street centres sit on the 60 m grid; the beach is clear of buildings.)
const SPOTS = {
  bayfront: { x: 225, z: 30, r: 9 },
  plaza: { x: 20, z: 0, r: 8 },
  southwest: { x: -210, z: 180, r: 9 },
  hideout: { x: -210, z: -210, r: 9 },
  dockside: { x: 225, z: -180, r: 9 },
};

function distTo(state, spot) {
  return Math.hypot(state.player.x - spot.x, state.player.z - spot.z);
}

const MISSION_DEFS = [
  {
    id: 0,
    title: 'Wheels Up',
    pay: 300,
    intro: "Mara: 'Wheels up, Jax. Steal a car, bring it to the bayfront — my buyer is waiting.'",
    steps: [
      {
        objective: 'MISSION 1 — Wheels Up: steal a car (press E near one).',
        done: (S) => S.state.inCar,
        hint: 'Car stolen. Now drive it to the bayfront marker.',
      },
      {
        objective: 'MISSION 1 — Wheels Up: drive to the bayfront marker.',
        done: (S) => distTo(S.state, SPOTS.bayfront) < SPOTS.bayfront.r,
        hint: '',
      },
    ],
    doneLine: "Mara: 'Clean. $300. Don't spend it all at once.'",
  },
  {
    id: 1,
    title: 'The Pickup',
    pay: 500,
    intro: "Mara: 'A package is waiting at the plaza fountain. Pick it up, then run it southwest. No cops.'",
    steps: [
      {
        objective: 'MISSION 2 — The Pickup: meet the contact at the plaza.',
        done: (S) => distTo(S.state, SPOTS.plaza) < SPOTS.plaza.r,
        hint: 'Package in hand. Now deliver it to the southwest corner.',
      },
      {
        objective: 'MISSION 2 — The Pickup: deliver the package southwest.',
        done: (S) => distTo(S.state, SPOTS.southwest) < SPOTS.southwest.r,
        hint: '',
      },
    ],
    doneLine: "Mara: '$500. The buyer says you drive like his grandmother — but you deliver.'",
  },
  {
    id: 2,
    title: 'Heat',
    pay: 400,
    intro: "Mara: 'The Vipers tipped off the PD. Get to 2 stars, then lose them at the hideout.'",
    steps: [
      {
        objective: 'MISSION 3 — Heat: raise your wanted level to 2 stars.',
        done: (S) => S.state.wanted >= 2,
        hint: 'The heat is on. Now reach the hideout in the northwest.',
      },
      {
        objective: 'MISSION 3 — Heat: reach the hideout while the heat is on.',
        done: (S) => S.state.wanted >= 1 && distTo(S.state, SPOTS.hideout) < SPOTS.hideout.r,
        hint: '',
      },
    ],
    doneLine: "Mara: 'You shook them. $400 — and the Vipers still owe me for the tip.'",
  },
  {
    id: 3,
    title: 'Dockside Deal',
    pay: 800,
    intro: "Mara: 'Last job. Meet my buyer at the dockside — and the Vipers will be there. Bring a gun.'",
    steps: [
      {
        objective: 'MISSION 4 — Dockside Deal: meet the buyer at the dockside.',
        done: (S) => distTo(S.state, SPOTS.dockside) < SPOTS.dockside.r,
        hint: 'Ambush! Take down all 3 Vipers.',
      },
      {
        objective: 'MISSION 4 — Dockside Deal: take down all 3 Vipers.',
        done: (S) => (S.combatSystem ? S.combatSystem.kills >= 3 : S._ambushTimer >= 20),
        hint: '',
      },
    ],
    doneLine: "Mara: 'Debt paid, Jax. $800 — and Solmar City is yours now.'",
  },
];

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd23b, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 26, 16, 1, true), beamMat);
  beam.position.y = 13;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return { group, beamMat, ringMat, ring };
}

export function createMissions(SOLMAR) {
  const beacon = makeBeacon(SOLMAR.scene);
  // Runtime copy of the definitions, so step progress is per session.
  const missions = MISSION_DEFS.map((d) => ({ ...d, step: 0, started: false }));
  let activeId = -1;
  let lastObjective = '';

  function currentStep(m) { return m.steps[Math.min(m.step, m.steps.length - 1)]; }
  function stepSpot(m) {
    if (m.id === 0) return m.step === 0 ? null : SPOTS.bayfront;
    if (m.id === 1) return m.step === 0 ? SPOTS.plaza : SPOTS.southwest;
    if (m.id === 2) return m.step === 0 ? null : SPOTS.hideout;
    return m.step === 0 ? SPOTS.dockside : SPOTS.dockside;
  }

  function startMission(m) {
    m.started = true;
    m.step = 0;
    SOLMAR.addMission({ title: m.title, objective: currentStep(m).objective });
    SOLMAR.toast(m.intro);
    if (m.id === 3) SOLMAR.hud.setObjective(currentStep(m).objective);
  }

  function completeMission(m) {
    SOLMAR.state.missionsDone.push(m.id);
    SOLMAR.addMoney(m.pay);
    SOLMAR.toast(`${m.doneLine} (+$${m.pay})`);
    SOLMAR.hud.setObjective('Debt: $5,000 — keep working for Mara Quinn.');
  }

  function update(dt) {
    if (SOLMAR.state.mode !== 'playing') return;
    const done = SOLMAR.state.missionsDone || [];
    const next = missions.find((m) => !done.includes(m.id));
    if (!next) {
      beacon.group.visible = false;
      const finalText = 'All missions complete — Solmar City is yours.';
      if (lastObjective !== finalText) { lastObjective = finalText; SOLMAR.hud.setObjective(finalText); }
      return;
    }
    if (next.id !== activeId) {
      activeId = next.id;
      startMission(next);
    }
    // Mission 4's ambush: spawn the Vipers the first frame its last step starts.
    if (next.id === 3 && next.step === 1 && !next._vipersSpawned) {
      next._vipersSpawned = true;
      SOLMAR._ambushTimer = 0;
      if (SOLMAR.combatSystem) {
        SOLMAR.combatSystem.spawnViper(232, -172);
        SOLMAR.combatSystem.spawnViper(218, -188);
        SOLMAR.combatSystem.spawnViper(228, -164);
      }
    }
    if (next.id === 3 && next.step === 1 && !SOLMAR.combatSystem) {
      SOLMAR._ambushTimer = (SOLMAR._ambushTimer || 0) + dt;
    }
    // Advance the current step.
    const step = currentStep(next);
    if (step.done(SOLMAR)) {
      if (next.step < next.steps.length - 1) {
        next.step += 1;
        const nextStep = currentStep(next);
        SOLMAR.hud.setObjective(nextStep.objective);
        if (step.hint) SOLMAR.toast(step.hint);
        if (next.id === 3 && next.step === 1) SOLMAR.toast('Ambush! Take down all 3 Vipers.');
      } else {
        completeMission(next);
        activeId = -1;
        beacon.group.visible = false;
        return;
      }
    }
    // Objective text + beacon follow the current step.
    const shown = currentStep(next).objective;
    if (shown !== lastObjective) { lastObjective = shown; SOLMAR.hud.setObjective(shown); }
    const spot = stepSpot(next);
    if (spot) {
      beacon.group.visible = true;
      beacon.group.position.set(spot.x, 0, spot.z);
      const pulse = 0.55 + Math.sin(SOLMAR.state.elapsed * 3) * 0.3;
      beacon.ringMat.opacity = pulse;
      beacon.beamMat.opacity = 0.2 + Math.sin(SOLMAR.state.elapsed * 3) * 0.08;
      beacon.ring.scale.setScalar(1 + Math.sin(SOLMAR.state.elapsed * 3) * 0.12);
    } else {
      beacon.group.visible = false;
    }
  }

  return {
    missions,
    update,
    get active() {
      const done = SOLMAR.state.missionsDone || [];
      return missions.find((m) => !done.includes(m.id)) || null;
    },
    get doneCount() { return (SOLMAR.state.missionsDone || []).length; },
  };
}
