import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * ADVANCED DEV WRAPPER
 * 
 * Improvements:
 * 1. Version Drift Warning (NPM vs Local Source)
 * 2. Parallel Frontend & Base Build (Speed)
 * 3. Architecture & OS Safeguards
 * 4. Automatic Workspace Cleanup
 */

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Determine the binary name as expected by the Rust sidecar logic
const binName = isWindows ? 'wapp-base.exe' : (isMac ? 'wapp-base-mac' : 'wapp-base-linux');

const hasLocalSource = fs.existsSync('wapp-base/src-tauri/Cargo.toml');
const isCloudRequested = process.argv.includes('--cloud');
// Auto-detect: if source exists, use it unless --cloud is passed.
// Also support --local for explicit clarity if someone still wants to use it.
const isLocalMode = hasLocalSource && (process.argv.includes('--local') || !isCloudRequested);
const isBuild = process.argv.includes('--build');

const mode = isLocalMode ? 'LOCAL' : 'CLOUD';
console.log(`[MODE] ${mode}`);

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

// 2. Cleanup
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

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
    console.log('Either install Rust (https://rustup.rs/) or run with --cloud to use pre-built binaries.');
    process.exit(1);
  }

  checkVersions();

  console.log('🔨 Performing initial wapp-base build...');
  const prep = spawnSync('node', ['scripts/prepare-base.js'], { stdio: 'inherit', shell: true });
  
  if (prep.status !== 0) {
      console.error('❌ Initial base build failed.');
      process.exit(1);
  }

  startTauri();

  // Watch for changes in wapp-base for "Auto-Refresh"
  if (!isBuild) {
    console.log('👀 Watching wapp-base/src-tauri/src for changes...');
    let debounceTimer = null;
    fs.watch(path.join('wapp-base', 'src-tauri', 'src'), { recursive: true }, (event, filename) => {
        if (filename && filename.endsWith('.rs')) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`\n📝 Change detected in ${filename}. Rebuilding...`);
                const rebuild = spawnSync('node', ['scripts/prepare-base.js'], { stdio: 'inherit', shell: true });
                if (rebuild.status === 0) {
                    startTauri();
                }
            }, 1000);
        }
    });
  }
} else {
  const actualNpmPath = fs.existsSync(npmPkgPath) ? npmPkgPath : npmPkgPathFallback;

  if (!fs.existsSync(actualNpmPath)) {
    console.log('⚠️  Cloud binaries missing. Running "npm install"...');
    spawnSync('npm', ['install'], { stdio: 'inherit', shell: true });
  }
  
  if (fs.existsSync(actualNpmPath)) {
    console.log('☁️  CLOUD mode active.');
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
    console.error('❌ Could not find cloud binary. If you intended to use local source, ensure wapp-base/src-tauri/Cargo.toml exists.');
    process.exit(1);
  }
}
