import bcrypt from 'bcryptjs';

async function generateHashes() {
  const password = 'staff123';
  const saltRounds = 12;
  
  const staffCount = 15;
  for (let i = 0; i < staffCount; i++) {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(hash);
  }
}

generateHashes();
