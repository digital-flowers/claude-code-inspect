import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const distDir = resolve(root, 'apps/extension/dist');
const releasesDir = resolve(root, 'releases');

const manifest = JSON.parse(readFileSync(resolve(root, 'apps/extension/manifest.json'), 'utf8')) as {
  version: string;
  name: string;
};

const version = manifest.version;
const zipName = `claude-code-inspect-v${version}.zip`;
const zipPath = resolve(releasesDir, zipName);

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first');
  process.exit(1);
}

if (!existsSync(releasesDir)) {
  mkdirSync(releasesDir, { recursive: true });
}

console.log(`Zipping ${distDir} → releases/${zipName}`);
execSync(`zip -r "${zipPath}" .`, { cwd: distDir, stdio: 'inherit' });
console.log(`\nDone: releases/${zipName}`);