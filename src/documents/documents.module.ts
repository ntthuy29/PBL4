import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { CollabModule } from '../collab/collab.module'; // Đảm bảo CollabModule export các service cần thiết
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CollabModule, CommonModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
