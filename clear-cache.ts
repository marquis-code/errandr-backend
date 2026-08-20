import { Redis } from 'ioredis';

async function clearCache() {
  const redis = new Redis('redis://default:DHVTJNgd3jrvEmc4VDhevlDRvuamckJS@redis-10564.c114.us-east-1-4.ec2.cloud.redislabs.com:10564');
  try {
    console.log('Clearing cache...');
    await redis.flushall();
    console.log('Cache cleared successfully!');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  } finally {
    redis.disconnect();
  }
}
clearCache();
