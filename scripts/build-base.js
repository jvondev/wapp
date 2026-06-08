import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * REUSABLE BUILD SCRIPT FOR WAPP-BASE
 * 
 * This script builds the local Rust 'wapp-base' and places it in the
 * main app's resource folder so you can test changes immediately.
 */

const isWindows = process.platform === 'win32';
const binName = isWindows ? 'wapp-base.exe' : 'wapp-base';

// 1. Ensure icons exist for the build (Rust needs them)
console.log('📦 Syncing icons...');
const iconSource = path.join('src-tauri', 'icons');
const iconDest = path.join('wapp-base', 'src-tauri', 'icons');
if (!fs.existsSync(iconDest)) fs.mkdirSync(iconDest, { recursive: true });
fs.cpSync(iconSource, iconDest, { recursive: true });

// 2. Build the Rust project
console.log('🔨 Building wapp-base (release)...');
const cargo = spawnSync('cargo', ['build', '--release'], { 
  cwd: path.join('wapp-base', 'src-tauri'),
  stdio: 'inherit',
  shell: true 
});

if (cargo.status !== 0) {
  console.error('❌ Build failed!');
  process.exit(1);
}

// 3. Inject the binary into the main app's search path
// We put it in node_modules so tauri.conf.json picks it up automatically
console.log('🚀 Injecting local build...');
const targetBin = path.join('wapp-base', 'src-tauri', 'target', 'release', binName);
const nodeModulesBinDir = path.join('node_modules', '@jvondev', 'wapp-base', 'bin');

if (!fs.existsSync(nodeModulesBinDir)) {
  fs.mkdirSync(nodeModulesBinDir, { recursive: true });
}

fs.copyFileSync(targetBin, path.join(nodeModulesBinDir, binName));

console.log('✅ DONE! Your local wapp-base is now active.');
console.log('👉 Run "npm run dev" to test.');
