const bcrypt = require('./node_modules/bcryptjs/dist/bcrypt.js');

async function test() {
  const password = 'staff123';
  const hash = await bcrypt.hash(password, 12);
  console.log('Generated Hash:', hash);
  const match = await bcrypt.compare(password, hash);
  console.log('Match:', match);
}

test();
