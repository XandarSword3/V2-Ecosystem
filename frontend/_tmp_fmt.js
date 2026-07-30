const fs = require('fs');
const raw = fs.readFileSync('./messages/ar.json', 'utf8');
const idx = raw.indexOf('"services"');
console.log(JSON.stringify(raw.slice(idx - 20, idx + 60)));
