const path = require('node:path');
const root = path.join(__dirname, '..');
const FILES = [
  'assets/kk.js',
  'data/scales.js',
  'data/drugs/classes.js',
  'data/drugs/aviandr.js',
  'data/rules/core.js',
  'data/scenarios.js',
  'data/materials.js',
  'assets/scales.js',
  'assets/therapy.js',
  'assets/adherence.js',
  'assets/rules.js',
  'assets/parser.js',
  'assets/store.js',
  'assets/ui.js',
  'assets/tiles.js',
  'assets/patient.js',
  'assets/doctor.js',
];
const fs = require('node:fs');
for (const f of FILES) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) require(p);
}
module.exports = { FILES };
