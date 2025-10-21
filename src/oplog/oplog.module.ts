import { Module } from '@nestjs/common';
import { OplogService } from './oplog.service';

@Module({
  providers: [OplogService],
})
export class OplogModule {}
