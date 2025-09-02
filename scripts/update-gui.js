#!/usr/bin/env node

/**
 * Script to update the GUI submodule after publishing a new version to npm
 * Run this after `npm publish` to automatically update the GUI
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command, options = {}) {
  console.log(`> ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf8', ...options });
    if (output) console.log(output.trim());
    return output;
  } catch (error) {
    console.error(`Error executing: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

async function updateGui() {
  console.log('🔄 Starting GUI update process...\n');

  // Get current version from package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  console.log(`📦 Current ban-chess.ts version: ${version}\n`);

  // Check if gui directory exists
  if (!fs.existsSync('gui')) {
    console.error('❌ GUI submodule not found. Please run: git submodule update --init --recursive');
    process.exit(1);
  }

  // Navigate to GUI directory
  process.chdir('gui');
  console.log('📂 Switched to GUI directory\n');

  // Check current GUI version
  const guiPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const currentGuiVersion = guiPackageJson.dependencies?.['ban-chess.ts'] || 'not installed';
  console.log(`📊 GUI currently using: ban-chess.ts@${currentGuiVersion}`);

  // Update ban-chess.ts in GUI
  console.log(`\n📥 Updating GUI to use ban-chess.ts@${version}...`);
  exec(`npm install ban-chess.ts@${version} --save`);

  // Check if there are changes
  const gitStatus = exec('git status --porcelain');
  if (!gitStatus) {
    console.log('✅ GUI already up to date!');
    return;
  }

  // Commit changes in GUI submodule
  console.log('\n📝 Committing changes in GUI submodule...');
  exec('git add package.json package-lock.json');
  exec(`git commit -m "chore: Update ban-chess.ts to v${version}"`);

  // Push to GUI repository
  console.log('\n🚀 Pushing to GUI repository...');
  try {
    exec('git push origin HEAD:main');
  } catch {
    // Try master if main fails
    exec('git push origin HEAD:master');
  }

  // Go back to main repository
  process.chdir('..');
  console.log('\n📂 Switched back to main repository');

  // Update submodule reference
  const mainGitStatus = exec('git status --porcelain gui');
  if (mainGitStatus) {
    console.log('\n🔗 Updating submodule reference in main repository...');
    exec('git add gui');
    exec(`git commit -m "chore: Update GUI submodule with ban-chess.ts v${version}"`);
    
    // Push main repository
    console.log('\n🚀 Pushing to main repository...');
    try {
      exec('git push origin main');
    } catch {
      exec('git push origin master');
    }
  }

  console.log('\n✅ GUI update complete!');
  console.log('🌐 The GUI will automatically redeploy via GitHub Pages');
}

// Run the update
updateGui().catch(error => {
  console.error('❌ Update failed:', error);
  process.exit(1);
});