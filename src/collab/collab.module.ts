import { Module } from '@nestjs/common';
import { CollabService } from './collab.service';
import { CollabGateway } from './collab/collab.gateway';

@Module({
  providers: [CollabService, CollabGateway],
})
export class CollabModule {}
