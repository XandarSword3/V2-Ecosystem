import { generate } from 'otplib';
const secret = 'AL4WCBCG6AI5TPBYHHKBUSJAEXLWKJEX';
console.log('Current OTP:', await generate({ secret }));
