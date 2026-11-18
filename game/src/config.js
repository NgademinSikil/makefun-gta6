// Solmar Heat — central tuning. All numbers live here so slice B can tune
// missions/combat without hunting through the world code.
export const CFG = {
  world: {
    // City grid: 9 x 9 blocks. Block 46 m, street 14 m -> pitch 60 m.
    blocks: 9,
    block: 46,
    street: 14,
    get pitch() { return this.block + this.street; },
    get half() { return (this.blocks * this.pitch) / 2; },
    // East edge is the bay: water starts here, beach strip just west of it.
    waterX: 250,
    beachX: 218,
  },
  player: {
    walkSpeed: 4.2,
    runSpeed: 7.5,
    radius: 0.55,
    maxHealth: 100,
    maxArmor: 100,
  },
  car: {
    accel: 22,
    brake: 34,
    reverseMax: 9,
    maxSpeed: 38,        // m/s ~ 137 km/h
    steerMax: 0.55,      // radians at low speed
    grip: 6.5,           // lateral damping
    handbrakeGrip: 1.4,
    radius: 1.7,
  },
  traffic: { count: 14, speedMin: 7, speedMax: 11 },
  peds: { count: 26, speedMin: 0.8, speedMax: 1.6 },
  police: {
    maxCruisers: 5,
    chaseSpeed: 30,
    ramDamage: 8,
    bustSeconds: 2.0,
    // Wanted decays one star per this many seconds while no cruiser is close.
    decaySeconds: 22,
    stealHeat: 1,
  },
  clock: {
    startHour: 9,
    startMinute: 0,
    // One real second = this many game minutes.
    minutesPerSecond: 1,
  },
  saveKey: 'solmar-heat-save-v1',
  palette: {
    sky: 0x8ec9ee,
    grass: 0x4f9e4d,
    sand: 0xe8d29a,
    water: 0x2e7fb8,
    road: 0x2b2f36,
    sidewalk: 0x9aa0a8,
    line: 0xf2c14e,
    buildingA: 0xd8cfc4,
    buildingB: 0xb8c4d8,
    buildingC: 0xe0b8a0,
    buildingD: 0xc4d8b8,
    palm: 0x2f8f4e,
    trunk: 0x8a6b48,
  },
};
