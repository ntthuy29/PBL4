import { Module } from '@nestjs/common';
import { YDocManager } from './ydoc-manager';
import { PresenceModule } from '../presence/presence.module';
import { CacheModule } from '../cache/cache.module';
import { OplogService } from './oplog.service';
import { SnapshotService } from './snapshot.service';
import { CollabGateway } from './collab/collab.gateway';

@Module({
  imports: [PresenceModule, CacheModule], // Không cần import PrismaModule vì nó là Global
  providers: [CollabGateway, YDocManager, OplogService, SnapshotService],
  exports: [YDocManager, OplogService], // Export để DocumentsController có thể dùng
})
export class CollabModule {}
