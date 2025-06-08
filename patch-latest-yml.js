const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const version = require('./package.json').version;
const outputDir = path.join(__dirname, 'electron', 'output');
const exePath = path.join(outputDir, `EQ-Nag-Setup-${version}.exe`);
const latestYmlPath = path.join(outputDir, 'latest.yml');

if (!fs.existsSync(exePath) || !fs.existsSync(latestYmlPath)) {
    console.error('❌ Cannot patch latest.yml – missing files.');
    process.exit(1);
}

console.log('🔧 Recalculating SHA512 for signed .exe…');
const buffer = fs.readFileSync(exePath);
const hash = crypto.createHash('sha512').update(buffer).digest('base64');

const yml = yaml.load(fs.readFileSync(latestYmlPath, 'utf8'));
yml.sha512 = hash;
if (Array.isArray(yml.files)) {
    for (const file of yml.files) {
        if (file.url.endsWith('.exe')) {
            file.sha512 = hash;
        }
    }
}

fs.writeFileSync(latestYmlPath, yaml.dump(yml));
console.log('✅ Patched latest.yml with correct hash.');
