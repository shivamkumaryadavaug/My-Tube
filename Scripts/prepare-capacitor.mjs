import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

function copy(source, destination = source) {
  const src = path.join(ROOT, source);
  const dest = path.join(WWW, destination);

  if (!fs.existsSync(src)) {
    console.warn(`Skipping missing: ${source}`);
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  fs.cpSync(src, dest, {
    recursive: true,
    force: true
  });

  console.log(`Copied: ${source}`);
}

function cleanWww() {
  if (fs.existsSync(WWW)) {
    fs.rmSync(WWW, { recursive: true, force: true });
  }

  fs.mkdirSync(WWW, { recursive: true });
}

cleanWww();

// Copy the existing MyTube frontend only.
// Do not copy the backend into the Capacitor web bundle.
for (const file of fs.readdirSync(ROOT)) {
  if (file.endsWith('.html')) {
    copy(file);
  }
}

for (const item of [
  'assets',
  'css',
  'js',
  'manifest.json',
  'sw.js',
  'favicon.ico',
  'robots.txt'
]) {
  copy(item);
}

console.log('');
console.log('MYTUBE Capacitor web build prepared successfully.');
console.log(`Frontend copied to: ${WWW}`);
