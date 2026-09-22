const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const vendorSchema = new mongoose.Schema({
  storeName: String,
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
  }
}, { collection: 'vendors' }); 

const Vendor = mongoose.model('Vendor', vendorSchema);

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);

    const vendorNames = [
      'MUM-JAY ABULA',
      'MUM JAY',
      'ABULA'
    ];

    const regexes = vendorNames.map(name => new RegExp(name, 'i'));

    const vendors = await Vendor.find({
      storeName: { $in: regexes }
    }, 'storeName bankDetails').lean();

    console.log('\n--- Vendor Account Details ---\n');
    
    if (vendors.length === 0) {
      console.log('No vendors found.');
    } else {
      vendors.forEach(v => {
        console.log(`Store Name: ${v.storeName}`);
        if (v.bankDetails) {
          console.log(`Bank Name: ${v.bankDetails.bankName || 'N/A'}`);
          console.log(`Account Name: ${v.bankDetails.accountName || 'N/A'}`);
          console.log(`Account Number: ${v.bankDetails.accountNumber || 'N/A'}`);
        } else {
          console.log('Bank Details: Not Provided');
        }
        console.log('------------------------------\n');
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
