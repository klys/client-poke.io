#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const configPath = path.resolve(process.argv[2] || 'app.json');
const appNames = ['web', 'android', 'desktop'];

let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read app build configuration at ${configPath}: ${error.message}`);
  process.exit(1);
}

if (!config.apps || typeof config.apps !== 'object' || Array.isArray(config.apps)) {
  console.error('Invalid app.json: "apps" must be an object.');
  process.exit(1);
}

for (const appName of appNames) {
  if (typeof config.apps[appName] !== 'boolean') {
    console.error(`Invalid app.json: "apps.${appName}" must be true or false.`);
    process.exit(1);
  }

  process.stdout.write(`${appName}=${config.apps[appName]}\n`);
}
