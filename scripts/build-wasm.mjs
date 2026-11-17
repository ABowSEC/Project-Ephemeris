// Builds crates/orbital to WebAssembly if Rust and wasm-pack are installed.
// Skips quietly otherwise so frontend-only work doesn't need Rust; CI always
// builds it. Output goes to public/wasm/orbital and is loaded by URL at
// runtime, so the bundle builds fine without it.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const crate = resolve(root, 'crates/orbital');
const outDir = resolve(root, 'public/wasm/orbital');

const has = (command) =>
  spawnSync(command, ['--version'], { stdio: 'ignore', shell: true }).status === 0;

if (!has('wasm-pack') || !has('cargo')) {
  console.warn(
    'build-wasm: wasm-pack or cargo not found — skipping the orbital module.\n' +
      '            Launch-lighting details will be hidden in this build.\n' +
      '            Install with: https://rustwasm.github.io/wasm-pack/installer/'
  );
  process.exit(0);
}

// Stale output would silently ship if the build below failed partway
rmSync(outDir, { recursive: true, force: true });

const result = spawnSync(
  'wasm-pack',
  ['build', '--release', '--target', 'web', '--out-dir', outDir, '--out-name', 'orbital', crate],
  { stdio: 'inherit', shell: true }
);

if (result.status !== 0) {
  // The toolchain exists, so a failure here is a real compile error worth failing on
  console.error('build-wasm: wasm-pack build failed');
  process.exit(result.status ?? 1);
}

// wasm-pack writes a package.json and .gitignore into the output directory
// that only make sense for publishing to npm; they would be copied into dist.
for (const extra of ['package.json', '.gitignore', 'README.md']) {
  rmSync(resolve(outDir, extra), { force: true });
}

console.log('build-wasm: orbital module built into public/wasm/orbital');
