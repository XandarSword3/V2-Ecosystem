const en = require('./messages/en.json');
const ar = require('./messages/ar.json');

function flatten(obj, prefix) {
  prefix = prefix || '';
  let out = {};
  for (const k in obj) {
    const key = prefix ? prefix + '.' + k : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      Object.assign(out, flatten(obj[k], key));
    } else {
      out[key] = obj[k];
    }
  }
  return out;
}

const enFlat = flatten(en);
const arFlat = flatten(ar);
const missing = Object.keys(enFlat).filter(k => !(k in arFlat));
console.log('missing home.* keys now:', missing.filter(k => k.startsWith('home.')).length);
console.log('total missing (all namespaces):', missing.length);
