// Solmar Heat — screenshot staging: puts the game into a named scene (a
// ?shot=<name>&seed=<n> URL) so the shot driver can capture it. Called from
// main.js only when a shot query is present; it drives the game through the
// same SOLMAR hooks a player would use (steal a car, set wanted, spawn Vipers).
// The driver waits for window.__shotReady, which main.js sets after staging.
export function applyShot(SOLMAR, name, seed = 1) {
  const S = SOLMAR.state;
  const spots = SOLMAR.city.parkedSpots;
  const pick = spots.length ? spots[seed % spots.length] : { x: 0, z: -40, heading: 0 };

  function face(x, z, heading) {
    S.player.x = x; S.player.z = z; S.player.heading = heading;
    S.camYaw = heading + Math.PI;
    S.camPitch = 0.32;
    S.lastDrag = S.elapsed;
  }
  function holdKey(key) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  if (name === 'bayfront') {
    // On the sand, facing the bay at sunrise; mission 1 is live.
    face(214, 60, Math.PI / 2);
    SOLMAR.setWanted(0);
  } else if (name === 'streets') {
    // Steal the nearest parked car and drive it down the street, heat on.
    S.player.x = pick.x; S.player.z = pick.z; S.player.heading = pick.heading;
    SOLMAR.stealCar();
    if (S.car) S.car.heading = pick.heading;
    face(S.player.x, S.player.z, pick.heading);
    SOLMAR.setWanted(1);
    holdKey('w');
  } else if (name === 'heat') {
    // Three stars on the plaza, Vipers closing in, mission 3 live.
    S.missionsDone = [0, 1];
    face(20, 0, Math.PI * 0.75);
    SOLMAR.setWanted(3);
    if (SOLMAR.combatSystem) {
      SOLMAR.combatSystem.spawnViper(30, 10);
      SOLMAR.combatSystem.spawnViper(10, -10);
    }
  } else if (name === 'dockside') {
    // The final deal at the dockside, Vipers waiting, mission 4 live.
    S.missionsDone = [0, 1, 2];
    face(208, -160, Math.PI / 2);
    SOLMAR.setWanted(2);
    if (SOLMAR.combatSystem) {
      SOLMAR.combatSystem.spawnViper(232, -172);
      SOLMAR.combatSystem.spawnViper(218, -188);
      SOLMAR.combatSystem.spawnViper(228, -164);
    }
  } else {
    // Unknown shot: the start of the game, on foot downtown.
    face(0, -40, 0);
    SOLMAR.setWanted(0);
  }
  return true;
}
