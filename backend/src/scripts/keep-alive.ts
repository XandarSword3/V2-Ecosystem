
import axios from 'axios';

const BACKEND_URL = 'https://v2-resort-backend.onrender.com';

async function ping() {
  try {
    console.log(`Pinging ${BACKEND_URL}/health...`);
    const response = await axios.get(`${BACKEND_URL}/health`);
    console.log('Ping successful:', response.data);
  } catch (error: any) {
    console.error('Ping failed:', error.message);
  }
}

// Run immediately
ping();

// Run every 30 seconds as requested
setInterval(ping, 30 * 1000);
