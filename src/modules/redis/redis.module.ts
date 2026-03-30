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
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        };

        // Standard Redis Cloud (redislabs.com) often requires TLS
        const isTls = redisUrl?.startsWith('rediss://') || configService.get('REDIS_TLS') === 'true';
        if (isTls) {
          options.tls = { rejectUnauthorized: false }; // Common for managed cloud redis
        }

        if (redisUrl) {
          return new Redis(redisUrl, options);
        }

        return new Redis({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          username: configService.get('REDIS_USER'),
          password: configService.get('REDIS_PASSWORD'),
          ...options,
        });
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
