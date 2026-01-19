
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const https = require('http'); // Use http for localhost

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
const BACKEND_URL = 'http://127.0.0.1:3005/api/payments/webhook/stripe';
const ORDER_ID = 'c1e5b48e-60b4-46f3-8df2-f2383d55b4f1';

const payload = {
  id: 'evt_test_webhook_' + Date.now(),
  object: 'event',
  type: 'payment_intent.succeeded',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'pi_test_' + Date.now(),
      amount: 2098, // $20.98
      currency: 'usd',
      status: 'succeeded',
      metadata: {
        referenceType: 'restaurant_order',
        referenceId: ORDER_ID,
        userId: 'some-user-id'
      },
      latest_charge: 'ch_test_' + Date.now()
    }
  }
};

const payloadString = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000);

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(`${timestamp}.${payloadString}`)
  .digest('hex');

const stripeSignature = `t=${timestamp},v1=${signature}`;

console.log('🚀 Sending Webhook...');
console.log(`Target: ${BACKEND_URL}`);
console.log(`Order ID: ${ORDER_ID}`);

const url = new URL(BACKEND_URL);
const options = {
  hostname: url.hostname,
  port: url.port,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': stripeSignature,
    'Content-Length': Buffer.byteLength(payloadString)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Success! Payment processed.');
    } else {
      console.log(`❌ Failed! Status: ${res.statusCode}`);
      console.log(`Response: ${data}`);
    }
  });
});

req.on('error', (e) => {
  console.log(`❌ Network Error: ${e.message}`);
  console.log('Is the backend server running on port 3005?');
});

req.write(payloadString);
req.end();
