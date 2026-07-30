const fs = require('fs');

const path = './messages/ar.json';
let raw = fs.readFileSync(path, 'utf8');

const oldServices = '"services": "الخدمات",';
const oldFeatures = '"features": "المميزات",';

if (!raw.includes(oldServices)) throw new Error('services anchor not found');
if (!raw.includes(oldFeatures)) throw new Error('features anchor not found');

const newServices =
'"services": {\r\n' +
'      "title": "خدماتنا",\r\n' +
'      "subtitle": "اكتشف كل ما يقدمه Iron Paradise Gym لتجربة لا تُنسى",\r\n' +
'      "whatWeOffer": "ما نقدمه",\r\n' +
'      "restaurant": {\r\n' +
'        "title": "المطعم",\r\n' +
'        "description": "أطباق فاخرة من المطبخ اللبناني والعالمي"\r\n' +
'      },\r\n' +
'      "snackBar": {\r\n' +
'        "title": "سناك بار",\r\n' +
'        "description": "وجبات خفيفة ومرطبات بجانب المسبح"\r\n' +
'      },\r\n' +
'      "chalets": {\r\n' +
'        "title": "الشاليهات",\r\n' +
'        "description": "شاليهات مريحة تطل على مناظر جبلية خلابة"\r\n' +
'      },\r\n' +
'      "pool": {\r\n' +
'        "title": "المسبح",\r\n' +
'        "description": "جلسات مسبح منعشة لجميع أفراد العائلة"\r\n' +
'      }\r\n' +
'    },';

const newFeatures =
'"features": {\r\n' +
'      "title": "لماذا تختار Iron Paradise Gym؟",\r\n' +
'      "subtitle": "لماذا نحن؟",\r\n' +
'      "primeLocation": {\r\n' +
'        "title": "موقع مميز",\r\n' +
'        "description": "يقع في موقع جميل يتمتع بإطلالات خلابة"\r\n' +
'      },\r\n' +
'      "authenticCuisine": {\r\n' +
'        "title": "مأكولات استثنائية",\r\n' +
'        "description": "أطباق عالمية يُعدّها طهاة محترفون"\r\n' +
'      },\r\n' +
'      "modernAmenities": {\r\n' +
'        "title": "مرافق عصرية",\r\n' +
'        "description": "جميع الشاليهات مجهزة بواي فاي وتكييف ومطبخ وأكثر"\r\n' +
'      },\r\n' +
'      "familyFriendly": {\r\n' +
'        "title": "مناسب للعائلات",\r\n' +
'        "description": "مثالي للتجمعات العائلية والاحتفالات"\r\n' +
'      },\r\n' +
'      "restaurant": {\r\n' +
'        "title": "أطباق فاخرة",\r\n' +
'        "description": "استمتع بأشهى الأطباق اللبنانية والعالمية"\r\n' +
'      },\r\n' +
'      "chalets": {\r\n' +
'        "title": "شاليهات فاخرة",\r\n' +
'        "description": "ملاذات جبلية مريحة بإطلالات خلابة"\r\n' +
'      },\r\n' +
'      "pool": {\r\n' +
'        "title": "المسبح والترفيه",\r\n' +
'        "description": "مسابح منعشة وأنشطة مثيرة لجميع أفراد العائلة"\r\n' +
'      },\r\n' +
'      "snackBar": {\r\n' +
'        "title": "سناك بار",\r\n' +
'        "description": "وجبات خفيفة ومرطبات بجانب المسبح"\r\n' +
'      }\r\n' +
'    },';

raw = raw.replace(oldServices, newServices);
raw = raw.replace(oldFeatures, newFeatures);

// Validate JSON is still parseable
JSON.parse(raw);

fs.writeFileSync(path, raw, 'utf8');
console.log('OK — ar.json updated and re-validated as parseable JSON');
