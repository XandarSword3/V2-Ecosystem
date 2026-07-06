import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

console.log('Testing Redis connection...');

// Try loading .env from multiple locations
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../.env'),
  path.join(process.cwd(), '../../.env'),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    console.log('Loading .env from:', envPath);
    dotenv.config({ path: envPath });
    break;
  }
}

console.log('REDIS_ENABLED:', process.env.REDIS_ENABLED);
console.log('REDIS_URL:', process.env.REDIS_URL);

const testRedis = async () => {
  const { getRedis, closeSessionStore } = await import('./src/config/session-store.js');
  try {
    const redis = getRedis();
    if (!redis) {
      console.log('❌ Redis not enabled! Set REDIS_ENABLED=true in .env');
      return;
    }

    console.log('Testing Redis ping...');
    const pong = await redis.ping();
    console.log('✅ Redis ping:', pong);

    console.log('Testing set key...');
    await redis.set('test:key', 'Hello, Upstash Redis!');
    const value = await redis.get('test:key');
    console.log('✅ Got test value:', value);

    console.log('✅ All Redis tests passed!');
  } catch (err) {
    console.error('❌ Redis test failed:', err);
  } finally {
    await closeSessionStore();
  }
};

testRedis();
