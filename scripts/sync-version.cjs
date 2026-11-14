#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const match = html.match(/\bconst\s+VERSION\s*=\s*["'](\d+\.\d+\.\d+(?:\.\d+)?)["']/);
if (!match) {
  console.error('Cannot find a literal const VERSION="x.y.z" in index.html; refusing to edit files.');
  process.exit(1);
}
const version = match[1];
function update(file, heading, pattern) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    console.error(`Required file missing: ${file}; refusing to generate it.`);
    process.exitCode = 1;
    return;
  }
  const old = fs.readFileSync(p, 'utf8');
  const lines = old.split(/\r?\n/);
  if (!pattern.test(lines[0])) {
    console.error(`Unexpected first line in ${file}; refusing to overwrite unrelated content.`);
    process.exitCode = 1;
    return;
  }
  lines[0] = heading;
  const updated = lines.join('\n');
  if (updated !== old) {
    fs.writeFileSync(p, updated);
    console.log(`Updated ${file} to ${version}`);
  } else {
    console.log(`${file} already matches ${version}`);
  }
}
update('README.md', `# ATLAS Command Center — ${version}`, /^# ATLAS Command Center\s*[—-]\s*\d+\.\d+\.\d+(?:\.\d+)?\s*$/);
update('.gitignore', `# ATLAS ${version} — Git Ignore Configuration`, /^# ATLAS\s+\d+\.\d+\.\d+(?:\.\d+)?\s*[—-]\s*Git Ignore Configuration\s*$/);
