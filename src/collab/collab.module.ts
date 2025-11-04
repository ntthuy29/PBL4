import { Module } from '@nestjs/common';
import { YDocManager } from './ydoc-manager';
import { PresenceModule } from '../presence/presence.module';
import { CacheModule } from '../cache/cache.module';
import { DocumentsModule } from '../documents/documents.module';
import { YWebsocketService } from './y-websocket.service';

@Module({
  imports: [PresenceModule, CacheModule, DocumentsModule], // Giữ lại các module cần thiết cho YDocManager
  providers: [YDocManager, YWebsocketService],
})
export class CollabModule {}
