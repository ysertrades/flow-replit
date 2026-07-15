const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');

function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function readJson(fileName, defaultValue = {}) {
    ensureDataDir();
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        return defaultValue;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return defaultValue;
    }
}

function writeJson(fileName, data) {
    ensureDataDir();
    const filePath = path.join(dataDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readJson, writeJson };
