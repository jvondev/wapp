import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'jvondev/wapp';
const BASE_BIN_DIR = path.join(process.cwd(), 'src-tauri', 'base-bin');

// Because GitHub Actions Artifact API requires authentication (even for public repos),
// it's highly recommended to just use Cargo to compile it locally for development,
// OR use GitHub CLI which uses your existing auth.
async function fetchArtifact() {
  console.log("Checking base binaries...");

  if (!fs.existsSync(BASE_BIN_DIR)) {
    fs.mkdirSync(BASE_BIN_DIR, { recursive: true });
  }

  // Determine which binary this OS needs
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const exeName = isWin ? 'wapp-base.exe' : 'wapp-base';
  const localPath = path.join(BASE_BIN_DIR, exeName);

  if (fs.existsSync(localPath)) {
    console.log(`✅ Base binary already exists at ${localPath}`);
    return;
  }

  console.log("Base binary not found in base-bin/.");
  
  if (GITHUB_TOKEN) {
    console.log("GITHUB_TOKEN found. You could fetch via API here.");
    console.log("However, compiling locally is more reliable for development.");
  }

  console.log("Compiling wapp-base locally for development...");
  try {
    // Compile it locally automatically! 
    // This is 100x easier than dealing with GitHub API tokens for local developers.
    execSync('cargo build --release', { 
      cwd: path.join(process.cwd(), 'wapp-base', 'src-tauri'),
      stdio: 'inherit'
    });
    
    const compiledPath = path.join(process.cwd(), 'wapp-base', 'src-tauri', 'target', 'release', exeName);
    fs.copyFileSync(compiledPath, localPath);
    console.log(`✅ Successfully compiled and copied wapp-base to ${localPath}`);
  } catch (error) {
    console.error("❌ Failed to compile wapp-base locally.");
    console.error("Please run: cd wapp-base/src-tauri && cargo build --release");
    process.exit(1);
  }
}

fetchArtifact();
