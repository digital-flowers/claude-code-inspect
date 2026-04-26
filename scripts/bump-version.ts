import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(fileURLToPath(import.meta.url), '../..');

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run version <version>');
  console.error('Example: npm run version 1.0.1');
  process.exit(1);
}

const files = [
  resolve(root, 'apps/extension/manifest.json'),
  resolve(root, 'apps/extension/package.json'),
  resolve(root, 'apps/plugin/package.json'),
];

for (const path of files) {
  const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`✓ ${path.replace(root + '/', '')} → ${version}`);
}

console.log(`\nAll files updated to ${version}`);
