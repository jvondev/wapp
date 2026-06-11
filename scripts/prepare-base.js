import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * LOCAL BUILDER
 * Builds wapp-base from source and places it in src-tauri/bin
 */

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Final name in src-tauri/bin (as sidecar)
const sidecarName = isWindows ? 'wapp-base.exe' : (isMac ? 'wapp-base-mac' : 'wapp-base-linux');
// Original name from cargo build
const cargoBinName = isWindows ? 'wapp-base.exe' : 'wapp-base';

if (process.env.CI) {
  console.log('⏭️  Skipping local wapp-base build in CI.');
  process.exit(0);
}

console.log('🏗️  Preparing LOCAL wapp-base...');

// 1. Sync version with root package.json
try {
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const targetVersion = rootPkg.devDependencies['@jvondev/wapp-base']?.replace(/[\^~]/, '');
  
  if (targetVersion) {
    const cargoPath = path.join('wapp-base', 'src-tauri', 'Cargo.toml');
    let cargoContent = fs.readFileSync(cargoPath, 'utf8');
    
    // Update version in [package] section
    const updatedCargo = cargoContent.replace(
      /(^\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m,
      `$1${targetVersion}$3`
    );
    
    if (cargoContent !== updatedCargo) {
      console.log(`🏷️  Syncing Cargo.toml version to ${targetVersion}...`);
      fs.writeFileSync(cargoPath, updatedCargo);
    }
  }
} catch (e) {
  console.warn('⚠️  Could not sync versions:', e.message);
}

// 2. Sync icons
const iconSource = path.join('src-tauri', 'icons');
const iconDest = path.join('wapp-base', 'src-tauri', 'icons');
if (!fs.existsSync(iconDest)) fs.mkdirSync(iconDest, { recursive: true });
fs.cpSync(iconSource, iconDest, { recursive: true });

// 3. Build local Rust
const isDebug = process.argv.includes('--debug');
const profile = isDebug ? 'debug' : 'release';
const buildFlag = isDebug ? [] : ['--release'];

console.log(`🔨 Starting Rust compilation (${profile})...`);
console.log('\x1b[90m(Note: The first build may take a few minutes. Subsequent builds will be nearly instant.)\x1b[0m');

const cargo = spawnSync('cargo', ['build', ...buildFlag], {
  cwd: path.join('wapp-base', 'src-tauri'),
  stdio: 'inherit',
  shell: true 
});

if (cargo.status !== 0) {
  console.error('❌ Build failed!');
  process.exit(1);
}

// 4. Copy to proxy bin folder
const source = path.join('wapp-base', 'src-tauri', 'target', profile, cargoBinName);
const destDir = path.join('src-tauri', 'bin');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

fs.copyFileSync(source, path.join(destDir, sidecarName));
console.log(`✅ Local binary ready in: ${destDir}/${sidecarName}`);
