import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const headers = { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' };

async function executeTransfer() {
  try {
    console.log('1. Checking Balance...');
    const balanceRes = await axios.get('https://api.paystack.co/balance', { headers });
    const balance = (balanceRes.data as any).data[0].balance;
    console.log(`Current Balance: ${(balance / 100).toFixed(2)} NGN`);

    if (balance < 35000) {
        console.error('Error: Insufficient balance. Please top up at least 350 NGN (plus 10 NGN fee).');
        return;
    }

    console.log('2. Fetching Banks to find OPay...');
    const banksRes = await axios.get('https://api.paystack.co/bank?currency=NGN', { headers });
    const opayBank = (banksRes.data as any).data.find((b: any) => b.name.toLowerCase().includes('opay') || b.name.toLowerCase().includes('paycom'));
    
    if (!opayBank) {
        console.error('Could not find OPay in bank list');
        return;
    }
    console.log(`Found OPay: ${opayBank.name} (Code: ${opayBank.code})`);

    console.log('3. Creating Transfer Recipient...');
    const recipientPayload = {
      type: "nuban",
      name: "Abah Joseph Oyame",
      account_number: "9045026174",
      bank_code: opayBank.code,
      currency: "NGN"
    };
    const recipientRes = await axios.post('https://api.paystack.co/transferrecipient', recipientPayload, { headers });
    const recipientCode = (recipientRes.data as any).data.recipient_code;
    console.log(`Recipient Created! Code: ${recipientCode}`);

    console.log('4. Initiating Transfer of 350 NGN...');
    const transferPayload = {
      source: "balance",
      amount: 35000, // Amount in kobo
      recipient: recipientCode,
      reason: "Erranders Test Transfer"
    };
    const transferRes = await axios.post('https://api.paystack.co/transfer', transferPayload, { headers });
    console.log('Transfer Initiated Successfully!');
    console.log(JSON.stringify(transferRes.data, null, 2));

  } catch (error: any) {
    console.error('\nAPI Error:', error.response?.data || error.message);
  }
}

executeTransfer();
