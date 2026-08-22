import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        const options: any = {
          retryStrategy: (times: number) => {
            if (times > 10) {
              console.warn('[Redis] Max reconnection attempts reached, stopping retries');
              return null; // Stop retrying
            }
            return Math.min(times * 500, 5000);
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: 5000,
        };

        // Standard Redis Cloud (redislabs.com) often requires TLS
        const isTls = redisUrl?.startsWith('rediss://') || configService.get('REDIS_TLS') === 'true';
        if (isTls) {
          options.tls = { rejectUnauthorized: false }; // Common for managed cloud redis
        }

        let client: Redis;
        if (redisUrl) {
          client = new Redis(redisUrl, options);
        } else {
          client = new Redis({
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            username: configService.get('REDIS_USER'),
            password: configService.get('REDIS_PASSWORD'),
            ...options,
          });
        }

        client.on('error', (err) => {
          console.warn('[Redis] Connection error (non-fatal):', err.message);
        });

        // Attempt to connect but don't block if it fails
        client.connect().catch((err) => {
          console.warn('[Redis] Initial connection failed (non-fatal):', err.message);
        });

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
