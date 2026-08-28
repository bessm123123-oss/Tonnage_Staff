'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
function joinParts(sourceDir, target) {
  const dir = path.join(root, sourceDir);
  const content = fs.readdirSync(dir)
    .filter(name => /^part-\d+\.txt$/.test(name))
    .sort()
    .map(name => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('');
  fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
  fs.writeFileSync(path.join(root, target), content, 'utf8');
}
joinParts('source-parts/index', 'src/index.html');
joinParts('source-parts/analytics', 'src/analytics-core.js');
console.log('Materialized generated renderer sources.');
