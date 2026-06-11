import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * WAPP SMART DEVELOPER WORKFLOW
 * 
 * This script automates the development environment by choosing between:
 * 1. LOCAL MODE: Uses source code in wapp-base/ (Ideal for contributors).
 *    - Automatically detects local source.
 *    - Rebuilds base binary on changes (Watch Mode).
 *    - Ensures Rust (cargo) is installed.
 *
 * 2. NPM MODE: Uses pre-built binaries from registry (Ideal for rapid UI work).
 *    - Triggered via --npm flag or if source is missing.
 *    - Automatically runs 'npm install' if binaries are missing.
 *
 * Features:
 * - Version Drift Warning: Alerts if local base version != package.json requirement.
 * - Auto-Cleanup: Manages sidecar directories to prevent stale builds.
 */

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Determine the binary name as expected by the Rust sidecar logic
const binName = isWindows ? 'wapp-base.exe' : (isMac ? 'wapp-base-mac' : 'wapp-base-linux');

const hasLocalSource = fs.existsSync('wapp-base/src-tauri/Cargo.toml');
const isNpmRequested = process.argv.includes('--npm') || process.argv.includes('--cloud') || process.argv.includes('--prebuilt');
// Auto-detect: if source exists, use it unless --npm is passed.
// Also support --local for explicit clarity if someone still wants to use it.
const isLocalMode = hasLocalSource && (process.argv.includes('--local') || !isNpmRequested);
const isBuild = process.argv.includes('--build');

const mode = isLocalMode ? 'LOCAL' : 'NPM';

// Informative logging for the "Smart" workflow
if (isLocalMode) {
  if (process.argv.includes('--local')) {
    console.log(`[MODE] ${mode} (Explicitly requested via --local)`);
  } else {
    console.log(`[MODE] ${mode} (Auto-detected local source in wapp-base/)`);
  }
} else {
  if (isNpmRequested) {
    console.log(`[MODE] ${mode} (Explicitly requested via --npm)`);
  } else {
    console.log(`[MODE] ${mode} (Using pre-built binaries from npm)`);
  }
}

// Set terminal tab title
process.stdout.write(`\u001b]0;Wapp [${mode}]\u0007`);

const destDir = path.join('src-tauri', 'bin');
// Try to find the binary in NPM package - it might have different names or be in a flat structure
const npmPkgPath = path.join('node_modules', '@jvondev', 'wapp-base', 'bin', binName);
const npmPkgPathFallback = path.join('node_modules', '@jvondev', 'wapp-base', 'bin', isWindows ? 'wapp-base.exe' : 'wapp-base');

// 1. Version Check
function checkVersions() {
  try {
    const mainPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const targetVersion = mainPkg.devDependencies['@jvondev/wapp-base'];
    
    // Check local source version
    if (fs.existsSync('wapp-base/src-tauri/Cargo.toml')) {
        const cargo = fs.readFileSync('wapp-base/src-tauri/Cargo.toml', 'utf8');
        const match = cargo.match(/version\s*=\s*"([^"]+)"/);
        if (match && match[1] !== targetVersion.replace(/[\^~]/, '')) {
            console.log(`\x1b[33m⚠️  Warning: Local source version (${match[1]}) differs from package.json requirement (${targetVersion})\x1b[0m`);
        }
    }
  } catch (e) {}
}

// 2. Base binary setup
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// 3. Selection & Parallel Execution
let tauriProcess = null;
let isRestarting = false;

function startTauri() {
    if (isBuild) {
        console.log('🚀 Starting Tauri build...');
        spawnSync('npx', ['tauri', 'build'], { stdio: 'inherit', shell: true });
        return;
    }

    if (tauriProcess) {
        isRestarting = true;
        console.log('\n♻️  Restarting Tauri to pick up new base binary...');
        tauriProcess.kill();
    }

    console.log(`🚀 Starting Tauri dev...`);
    tauriProcess = spawn('npx', ['tauri', 'dev'], { 
        stdio: 'inherit', 
        shell: true 
    });

    tauriProcess.on('close', (code) => {
        tauriProcess = null;
        if (!isRestarting && code !== null) process.exit(code);
        isRestarting = false;
    });
}

if (isLocalMode) {
  console.log('🏗️  LOCAL mode active (found local source).');

  // Robustness: Check if cargo is installed
  const hasCargo = spawnSync('cargo', ['--version']).status === 0;
  if (!hasCargo) {
    console.error('\x1b[31m❌ Error: Local source found but "cargo" is not installed.\x1b[0m');
    console.log('Either install Rust (https://rustup.rs/) or run with --npm to use pre-built binaries.');
    process.exit(1);
  }

  checkVersions();

  const localBinPath = path.join(destDir, binName);
  const shouldBuild = !fs.existsSync(localBinPath);

  if (shouldBuild) {
    console.log('🔨 Performing initial wapp-base build...');
    console.log('\x1b[90m(Note: Using debug build for speed. First build takes time, subsequent starts are instant.)\x1b[0m');
    const prep = spawnSync('node', ['scripts/prepare-base.js', '--debug'], { stdio: 'inherit', shell: true });

    if (prep.status !== 0) {
        console.error('❌ Initial base build failed.');
        process.exit(1);
    }
  } else {
    console.log('⚡ Using existing local binary (skipping initial build).');
  }

  startTauri();

  // Watch for changes in wapp-base for "Auto-Refresh"
  if (!isBuild) {
    const watchDir = path.join('wapp-base', 'src-tauri');
    console.log(`👀 Watching for changes in ${watchDir}...`);

    let debounceTimer = null;
    try {
      fs.watch(watchDir, { recursive: true }, (event, filename) => {
          // Only trigger rebuild for Rust files or Cargo.toml
          if (filename && (filename.endsWith('.rs') || filename.endsWith('Cargo.toml'))) {
              if (debounceTimer) clearTimeout(debounceTimer);

              debounceTimer = setTimeout(() => {
                  console.log(`\n📝 Change detected: ${filename}. Rebuilding wapp-base...`);

                  // Show a clear visual separator in the logs
                  console.log('--------------------------------------------------');
                  const rebuild = spawnSync('node', ['scripts/prepare-base.js', '--debug'], { stdio: 'inherit', shell: true });
                  console.log('--------------------------------------------------');

                  if (rebuild.status === 0) {
                      console.log('✅ Rebuild successful. Restarting app...');
                      startTauri();
                  } else {
                      console.error('❌ Rebuild failed. Fix the errors above to resume.');
                  }
              }, 500); // Faster debounce for snappier DX
          }
      });
    } catch (e) {
      console.warn(`⚠️  Recursive watch failed: ${e.message}`);
      console.log('Falling back to non-recursive watch (Cargo.toml changes only). Please check your OS limits.');
      // Basic fallback for non-recursive systems
      fs.watch(watchDir, (event, filename) => {
          if (filename === 'Cargo.toml') {
            // Trigger rebuild for Cargo.toml only in root
             console.log(`\n📝 Root config change: ${filename}. Rebuilding...`);
             spawnSync('node', ['scripts/prepare-base.js', '--debug'], { stdio: 'inherit', shell: true });
             startTauri();
          }
      });
    }
  }
} else {
  let actualNpmPath = fs.existsSync(npmPkgPath) ? npmPkgPath : npmPkgPathFallback;

  if (!fs.existsSync(actualNpmPath)) {
    console.log('⚠️  NPM binaries missing. Running "npm install"...');
    spawnSync('npm', ['install'], { stdio: 'inherit', shell: true });
    // Re-compute path after install
    actualNpmPath = fs.existsSync(npmPkgPath) ? npmPkgPath : npmPkgPathFallback;
  }
  
  if (fs.existsSync(actualNpmPath)) {
    console.log('☁️  NPM mode active.');
    // Architecture check
    const isExeFound = actualNpmPath.endsWith('.exe');
    if (isWindows && !isExeFound) {
        console.error('❌ Error: Expected .exe for Windows but found ' + actualNpmPath);
        process.exit(1);
    } else if (!isWindows && isExeFound) {
        console.error('❌ Error: Found .exe on non-Windows platform: ' + actualNpmPath);
        process.exit(1);
    }
    fs.copyFileSync(actualNpmPath, path.join(destDir, binName));
    startTauri();
  } else {
    console.error('❌ Could not find pre-built binary in npm package. If you intended to use local source, ensure wapp-base/src-tauri/Cargo.toml exists.');
    process.exit(1);
  }
}
