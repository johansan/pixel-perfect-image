# Scripts

## release.js

Automates the release process for this Obsidian plugin:

- Increments versions in `manifest.json`, `package.json`, and `versions.json`
- Creates a git commit + tag
- Pushes to trigger the GitHub Actions release workflow

Usage:

```bash
npm run release
npm run release:patch
npm run release:minor
npm run release:major
node scripts/release.js patch --dry-run
```

## mdReleaseNotes.js

Converts the latest entry in `src/releaseNotes.ts` to Markdown for GitHub releases.

Usage:

```bash
npm run release:notes
node scripts/mdReleaseNotes.js
```
