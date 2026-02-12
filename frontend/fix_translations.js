const fs = require('fs');
const enJson = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const poolSection = enJson.pool;
const adminNavSection = enJson.admin.nav;

['fr', 'de', 'it'].forEach(lang => {
  const filePath = `messages/${lang}.json`;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Add missing pool keys
  if (!json.pool.bookNow) json.pool.bookNow = poolSection.bookNow;
  if (!json.pool.guests) json.pool.guests = poolSection.guests;
  if (!json.pool.gender) json.pool.gender = poolSection.gender;
  if (!json.pool.bookSession) json.pool.bookSession = poolSection.bookSession;
  if (!json.pool.customerName) json.pool.customerName = poolSection.customerName;
  if (!json.pool.enterName) json.pool.enterName = poolSection.enterName;
  if (!json.pool.enterPhone) json.pool.enterPhone = poolSection.enterPhone;
  if (!json.pool.total) json.pool.total = poolSection.total;
  if (!json.pool.processing) json.pool.processing = poolSection.processing;
  if (!json.pool.confirmBooking) json.pool.confirmBooking = poolSection.confirmBooking;
  
  // Add missing admin.nav.navbar key
  if (json.admin && json.admin.nav && !json.admin.nav.navbar) {
    json.admin.nav.navbar = adminNavSection.navbar || 'Navigation';
  }
  
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log('Fixed ' + filePath);
});
console.log('Done!');
