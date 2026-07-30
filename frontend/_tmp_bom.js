const fs = require('fs');
const buf = fs.readFileSync('./messages/ar.json');
console.log('First bytes:', buf.slice(0, 4));
console.log('Has BOM:', buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF);
