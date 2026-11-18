// Solmar Heat — the gta6-01 entry program (Node 22, standard library only).
// It hands the game in: copies game/ (the playable three.js open world) and
// screenshots/ (four real renders of the game) from beside this file into the
// output directory, then writes /output/dossier.json with the vendored make.fun
// library, the summary the AI judge reads. Run it yourself to check the entry:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// Refuse to hand in an entry the sealed gate would refuse: more than four
// screenshots, one over 256 KiB, or a game/ over the file and byte caps. The
// caps are the gate's own (reference/gate.json); only text_max_bytes shapes
// the dossier bytes, the rest are checked here so a bad build fails loudly.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countGameEntries(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    files += 1;
    const st = statSync(p);
    if (name.isDirectory()) {
      const sub = countGameEntries(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      bytes += st.size;
      if (Buffer.byteLength(p, 'utf8') - Buffer.byteLength(gameDir, 'utf8') > GATE.game_path_max_bytes) {
        throw new Error(`game path too long: ${p}`);
      }
    }
  }
  return { files, bytes };
}

const gameCount = countGameEntries(gameDir);
if (gameCount.files > GATE.game_max_files) throw new Error(`game/ has ${gameCount.files} entries, over the ${GATE.game_max_files} cap`);
if (gameCount.bytes > GATE.game_max_bytes) throw new Error(`game/ is ${gameCount.bytes} bytes, over the ${GATE.game_max_bytes} cap`);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  if (shots.length > GATE.screenshots.max) throw new Error(`${shots.length} screenshots, over the ${GATE.screenshots.max} cap`);
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > GATE.screenshots.max_bytes) throw new Error(`screenshot ${shot} is ${size} bytes, over the ${GATE.screenshots.max_bytes} cap`);
  }
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, GATE));
console.log(`Solmar Heat handed in: ${gameCount.files} game entries (${gameCount.bytes} bytes) + dossier.json -> ${out}`);
