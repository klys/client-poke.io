#!/usr/bin/env node

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/next-version.js <major.minor.patch>');
  process.exit(1);
}

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);

if (minor > 99 || patch > 99) {
  console.error(`Invalid base-100 version: ${version}`);
  process.exit(1);
}

patch += 1;

if (patch > 99) {
  patch = 0;
  minor += 1;
}

if (minor > 99) {
  minor = 0;
  major += 1;
}

process.stdout.write(`${major}.${minor}.${patch}`);
