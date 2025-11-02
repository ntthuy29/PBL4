import { Module } from '@nestjs/common';
import { CollabGateway } from './collab/collab.gateway';
import { YDocManager } from './ydoc-manager';
import { PresenceModule } from '../presence/presence.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PresenceModule, CacheModule],
  providers: [CollabGateway, YDocManager],
  exports: [CollabGateway],
})
export class CollabModule {}
