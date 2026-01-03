
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

// Run every 14 minutes (Render spins down after 15 mins of inactivity)
setInterval(ping, 14 * 60 * 1000);
