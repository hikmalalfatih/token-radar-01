// Token launch radar — entry point.
//
// Reads the sealed DefiLlama snapshot, scores every pre-token protocol with the
// comps model in lib/model.ts, and writes the four deliverables into the output
// directory: board.json (the ranked board), dashboard/ (the static page plus the
// data.js it renders from), screenshots/ (copied through), and dossier.json
// (built with the kit's own vendor library, byte for byte what the scorer
// rebuilds). The program is deterministic: same snapshot in, same bytes out.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, type Snapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = dirname(fileURLToPath(import.meta.url));

function flagValue(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const at = args.indexOf('--' + name);
  if (at !== -1 && at + 1 < args.length) return args[at + 1]!;
  const joined = args.find((a) => a.startsWith('--' + name + '='));
  if (joined) return joined.slice(name.length + 3);
  return fallback;
}

const inputPath = flagValue('input', '/input');
const outputDir = flagValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshotFile = inputPath.endsWith('.json') ? inputPath : join(inputPath, 'snapshot.json');
if (!existsSync(snapshotFile)) {
  process.stderr.write('radar: snapshot not found at ' + snapshotFile + '\n');
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')) as Snapshot;
const { rows, summary } = buildBoard(snapshot);

mkdirSync(outputDir, { recursive: true });

// 1. The board itself.
writeFileSync(join(outputDir, 'board.json'), JSON.stringify({ as_of: summary.as_of, rows }, null, 2) + '\n');

// 2. The dashboard: copy the page files, then write the data it renders from
//    out of the same rows, so the page and the board can never disagree.
const outDash = join(outputDir, 'dashboard');
mkdirSync(outDash, { recursive: true });
for (const name of readdirSync(join(root, 'dashboard'))) {
  const from = join(root, 'dashboard', name);
  if (statSync(from).isFile()) copyFileSync(from, join(outDash, name));
}
const dataPayload = { summary, rows };
writeFileSync(join(outDash, 'data.js'), 'window.RADAR_DATA = ' + JSON.stringify(dataPayload) + ';\n');

// 3. Screenshots ride along unchanged.
const outShots = join(outputDir, 'screenshots');
mkdirSync(outShots, { recursive: true });
for (const name of readdirSync(join(root, 'screenshots'))) {
  const from = join(root, 'screenshots', name);
  if (statSync(from).isFile()) copyFileSync(from, join(outShots, name));
}

// 4. The dossier goes last: it is built from everything written above.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

process.stdout.write(
  'radar: ' + rows.length + ' rows, watchlist ' + summary.watchlist_covered + '/' + summary.watchlist_total +
  ', global multiple ' + summary.global_multiple + ', dossier ' + dossier.length + ' bytes\n',
);
