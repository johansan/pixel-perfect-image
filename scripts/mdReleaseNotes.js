#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read the TypeScript release notes file
const releaseNotesPath = path.join(__dirname, '..', 'src', 'releaseNotes.ts');
const content = fs.readFileSync(releaseNotesPath, 'utf8');

// Find the RELEASE_NOTES array declaration
const releaseNotesMatch = content.match(/const RELEASE_NOTES.*?=\s*(\[[\s\S]*?\n\]);/);
if (!releaseNotesMatch) {
	console.error('Could not find RELEASE_NOTES in file');
	process.exit(1);
}

// Evaluate the array in a sandbox to get actual JavaScript objects
let releases;
try {
	const sandbox = {};
	const arrayCode = `(${releaseNotesMatch[1]})`;
	releases = vm.runInNewContext(arrayCode, sandbox);
} catch (error) {
	console.error('Could not parse release notes:', error.message);
	process.exit(1);
}

if (!releases || releases.length === 0) {
	console.error('No release notes found');
	process.exit(1);
}

// Get the first (latest) release
const release = releases[0];

// Helper function to convert == to **
const convertMarkdown = text => text.replace(/==/g, '**');

// Print optional info section if present
if (release.info) {
	console.log(`${convertMarkdown(release.info)}\n`);
}

// Print each section if it has content
if (release.new && release.new.length > 0) {
	console.log('### New\n');
	release.new.forEach(item => console.log(`- ${convertMarkdown(item)}`));
	console.log();
}

if (release.improved && release.improved.length > 0) {
	console.log('### Improved\n');
	release.improved.forEach(item => console.log(`- ${convertMarkdown(item)}`));
	console.log();
}

if (release.changed && release.changed.length > 0) {
	console.log('### Changed\n');
	release.changed.forEach(item => console.log(`- ${convertMarkdown(item)}`));
	console.log();
}

if (release.fixed && release.fixed.length > 0) {
	console.log('### Fixed\n');
	release.fixed.forEach(item => console.log(`- ${convertMarkdown(item)}`));
	console.log();
}
