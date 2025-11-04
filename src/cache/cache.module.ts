import { Module } from '@nestjs/common';
import { RedisPubSub } from './redis-pubsub.service';

@Module({
  providers: [RedisPubSub],
  exports: [RedisPubSub],
})
export class CacheModule {}
