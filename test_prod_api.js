const https = require('https');

https.get('https://api.erranders.org/api/v1/vendors', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const vendors = json.vendors || json.data?.vendors || json.data || json;
    const iyabo = vendors.find(v => v.storeName.toLowerCase().includes('iyabo'));
    if (iyabo) {
      console.log('Prod API says Iyabo is:', iyabo.isOpen, iyabo.statusMessage);
    } else {
      console.log('Iyabo not found in Prod API response');
    }
  });
});
