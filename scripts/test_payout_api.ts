import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function testPayout() {
  console.log('Testing Paystack Payout API...');
  console.log(`Using Key: ${SECRET_KEY?.substring(0, 8)}...`);

  try {
    // 1. Get Balance
    const balanceRes = await axios.get('https://api.paystack.co/balance', {
      headers: { Authorization: `Bearer ${SECRET_KEY}` }
    });
    console.log('\n--- Paystack Balance ---');
    console.log(JSON.stringify(balanceRes.data, null, 2));

    // 2. Fetch Banks
    const bankRes = await axios.get('https://api.paystack.co/bank', {
        headers: { Authorization: `Bearer ${SECRET_KEY}` }
    });
    // Just find a popular bank code, like GTBank (058) or Wema (035)
    
  } catch (error: any) {
    console.error('\nAPI Error:', error.response?.data || error.message);
  }
}

testPayout();
