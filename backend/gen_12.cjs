const bcrypt = require('./node_modules/bcryptjs/dist/bcrypt.js');

async function gen() {
  const password = 'staff123';
  for (let i = 0; i < 12; i++) {
    const hash = await bcrypt.hash(password, 12);
    console.log(hash);
  }
}

gen();
