import { Module } from '@nestjs/common';
import { YDocManager } from './ydoc-manager';
import { PresenceModule } from '../presence/presence.module';
import { CacheModule } from '../cache/cache.module';
import { OplogService } from './oplog.service';
import { SnapshotService } from './snapshot.service';
import { CollabGateway } from './collab/collab.gateway';
import { YWebsocketService } from './y-websocket.service';
import { AclModule } from '../acl/acl.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PresenceModule,
    CacheModule,
    AclModule,
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
  ], // Không cần import PrismaModule vì nó là Global
  providers: [
    CollabGateway,
    YDocManager,
    OplogService,
    SnapshotService,
    YWebsocketService,
  ],
  exports: [YDocManager, OplogService], // Export để DocumentsController có thể dùng
})
export class CollabModule {}
