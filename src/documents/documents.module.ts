import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService], // สำคัญ: Export DocumentsService เพื่อให้ module อื่น có thể sử dụng
})
export class DocumentsModule {}
