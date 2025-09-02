# GitHub Actions Workflows

This directory contains automated workflows for the ban-chess.ts project.

## Workflows

### 1. Update GUI After NPM (`update-gui-after-npm.yml`)

**Purpose**: Automatically updates the GUI submodule when a new version is published to npm.

**Triggers**:
- Manual dispatch via GitHub Actions UI
- Hourly schedule (checks for updates)

**What it does**:
1. Checks the latest version on npm
2. Compares with GUI's current dependency version
3. Updates GUI's package.json if needed
4. Commits and pushes changes to both repositories
5. GUI automatically redeploys via GitHub Pages

### 2. Update GUI on Publish (`update-gui-on-publish.yml`)

**Purpose**: Updates GUI when a GitHub release is created.

**Triggers**:
- GitHub release publication
- Manual dispatch with optional version parameter

## Local Scripts

### `npm run update-gui`

Manually update the GUI after publishing:
```bash
npm publish
npm run update-gui  # Automatically runs after publish via postpublish hook
```

### `npm run release`

One-command release process:
```bash
npm run release  # Bumps version, publishes, updates GUI, pushes tags
```

## Setup Requirements

### GitHub Secrets

To enable automatic GUI updates, you need to set up a GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a token with `repo` and `workflow` permissions
3. Add it as a secret named `GUI_UPDATE_TOKEN` in your repository settings

### Permissions

The workflows need write access to:
- The main repository (for updating submodule references)
- The GUI submodule repository (for updating dependencies)

## How It Works

1. **After npm publish**: The `postpublish` hook triggers `update-gui.js`
2. **In GUI repo**: Updates `package.json` to use the new version
3. **Commits changes**: Both in GUI repo and main repo's submodule reference
4. **GitHub Pages**: Automatically rebuilds and deploys the GUI

## Manual Update

If automatic updates fail, you can manually update:

```bash
cd gui
npm install ban-chess.ts@latest --save
git add .
git commit -m "chore: Update ban-chess.ts"
git push
cd ..
git add gui
git commit -m "chore: Update GUI submodule"
git push
```