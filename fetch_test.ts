import axios from 'axios';

async function test() {
  try {
    const login = await axios.post('http://localhost:3005/api/v1/auth/login', {
      email: 'admin@erranders.org',
      password: 'password123' // assuming standard dummy pass, or I can just check the db
    });
    const token = login.data.token || login.data.data.token;
    
    console.time('fetchDispatchers');
    const res = await axios.get('http://localhost:3005/api/v1/admin/dispatchers?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.timeEnd('fetchDispatchers');
    console.log(res.data.dispatchers?.length || res.data.data?.dispatchers?.length || res.data);
  } catch (e: any) {
    console.error(e.response?.data || e.message);
  }
}
test();
