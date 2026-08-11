// Compiles crates/orbital to WebAssembly, if the toolchain is present.
//
// Deliberately non-fatal when Rust or wasm-pack is missing: contributors who
// only touch the React side should not need a Rust install to run the app, and
// everything the module powers degrades to simply not being shown. CI installs
// the toolchain (see .github/workflows/ci.yml), so the release build always
// includes it and a genuinely broken crate still fails the build there.
//
// Output goes to public/wasm/orbital rather than into src/, so it is a plain
// static asset that Vite copies through. That is what keeps the bundle
// resolvable when the directory does not exist: nothing imports it at build
// time, and src/utils/orbital.ts loads it by URL at runtime.

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
