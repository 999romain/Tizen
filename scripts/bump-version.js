#!/usr/bin/env node
/**
 * Version bump script — updates version references for a specific platform.
 *
 * Usage:
 *   node scripts/bump-version.js <webos|tizen|all> <version>
 *
 * Examples:
 *   node scripts/bump-version.js webos 2.2.0
 *   node scripts/bump-version.js tizen 2.1.1
 *   node scripts/bump-version.js all 3.0.0
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const platform = process.argv[2];
const newVersion = process.argv[3];

if (!platform || !newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion) || !['webos', 'tizen', 'all'].includes(platform)) {
	console.error('Usage: node scripts/bump-version.js <webos|tizen|all> <major.minor.patch>');
	process.exit(1);
}

const doWebos = platform === 'webos' || platform === 'all';
const doTizen = platform === 'tizen' || platform === 'all';

/**
 * Update "version" in a JSON file, preserving its indentation style.
 */
const updateJsonVersion = (rel) => {
	const file = path.join(ROOT, rel);
	if (!fs.existsSync(file)) return;
	const raw = fs.readFileSync(file, 'utf8');
	const json = JSON.parse(raw);
	const old = json.version;
	json.version = newVersion;
	const indent = raw.match(/^{\s*\n(\s+)/)?.[1] || '\t';
	fs.writeFileSync(file, JSON.stringify(json, null, indent) + '\n');
	console.log(`  ${rel}: ${old} → ${newVersion}`);
};

// ── Shared files (always updated) ──
const sharedJsonFiles = [
	'package.json',
	'packages/app/package.json',
];

// ── Platform-specific files ──
const webosJsonFiles = [
	'packages/platform-webos/package.json',
	'packages/build-webos/package.json',
	'packages/build-webos/webos-meta/appinfo.json',
];

const tizenJsonFiles = [
	'packages/platform-tizen/package.json',
	'packages/build-tizen/package.json',
];

console.log(`Bumping ${platform} to ${newVersion}\n`);

// Shared package.json files
for (const rel of sharedJsonFiles) {
	updateJsonVersion(rel);
}

// ── webOS ──
if (doWebos) {
	for (const rel of webosJsonFiles) {
		updateJsonVersion(rel);
	}

	// webOS manifest (version + ipkUrl + clear hash)
	const manifestPath = path.join(ROOT, 'packages/build-webos/org.moonfin.webos.manifest.json');
	if (fs.existsSync(manifestPath)) {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
		const old = manifest.version;
		manifest.version = newVersion;
		manifest.ipkUrl = `org.moonfin.webos_${newVersion}_all.ipk`;
		if (manifest.ipkHash) manifest.ipkHash.sha256 = '';
		fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
		console.log(`  build-webos/org.moonfin.webos.manifest.json: ${old} → ${newVersion}`);
	}

	// README ipk references
	const readmePath = path.join(ROOT, 'README.md');
	if (fs.existsSync(readmePath)) {
		let readme = fs.readFileSync(readmePath, 'utf8');
		const ipkRe = /org\.moonfin\.webos_\d+\.\d+\.\d+_all\.ipk/g;
		const count = (readme.match(ipkRe) || []).length;
		if (count) {
			readme = readme.replace(ipkRe, `org.moonfin.webos_${newVersion}_all.ipk`);
			fs.writeFileSync(readmePath, readme);
			console.log(`  README.md: updated ${count} ipk reference(s)`);
		}
	}
}

// ── Tizen ──
if (doTizen) {
	for (const rel of tizenJsonFiles) {
		updateJsonVersion(rel);
	}

	// Tizen config.xml
	const configXmlPath = path.join(ROOT, 'packages/build-tizen/tizen/config.xml');
	if (fs.existsSync(configXmlPath)) {
		let configXml = fs.readFileSync(configXmlPath, 'utf8');
		const xmlMatch = configXml.match(/version="(\d+\.\d+\.\d+)"/);
		if (xmlMatch) {
			configXml = configXml.replace(`version="${xmlMatch[1]}"`, `version="${newVersion}"`);
			fs.writeFileSync(configXmlPath, configXml);
			console.log(`  build-tizen/tizen/config.xml: ${xmlMatch[1]} → ${newVersion}`);
		}
	}

	// README wgt references
	const readmePath = path.join(ROOT, 'README.md');
	if (fs.existsSync(readmePath)) {
		let readme = fs.readFileSync(readmePath, 'utf8');
		const wgtRe = /Moonfin-v\d+\.\d+\.\d+\.wgt/g;
		const count = (readme.match(wgtRe) || []).length;
		if (count) {
			readme = readme.replace(wgtRe, `Moonfin-v${newVersion}.wgt`);
			fs.writeFileSync(readmePath, readme);
			console.log(`  README.md: updated ${count} wgt reference(s)`);
		}
	}
}

// ── package-lock.json (root version) ──
const lockPath = path.join(ROOT, 'package-lock.json');
if (fs.existsSync(lockPath)) {
	const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
	const old = lock.version;
	lock.version = newVersion;
	if (lock.packages?.['']) {
		lock.packages[''].version = newVersion;
	}
	fs.writeFileSync(lockPath, JSON.stringify(lock, null, '\t') + '\n');
	console.log(`  package-lock.json: ${old} → ${newVersion}`);
}

console.log(`\nDone — ${platform} bumped to ${newVersion}`);
