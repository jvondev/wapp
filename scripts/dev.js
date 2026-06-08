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
const binName = isWindows ? 'wapp-base.exe' : 'wapp-base';
// Direct detection from package.json scripts
const isLocalFlag = process.argv.includes('--local');
const isBuild = process.argv.includes('--build');

const mode = isLocalFlag ? 'LOCAL' : 'CLOUD';
console.log(`[MODE] ${mode}`);

// Set terminal tab title
process.stdout.write(`\u001b]0;Wapp [${mode}]\u0007`);

const destDir = path.join('src-tauri', 'bin');
const npmPkgPath = path.join('node_modules', '@jvondev', 'wapp-base', 'bin', binName);

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

if (isLocalFlag) {
  console.log('🏗️  LOCAL mode active.');
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
