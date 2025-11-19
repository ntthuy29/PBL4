import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { CollabModule } from '../collab/collab.module'; // Đảm bảo CollabModule export các service cần thiết
import { CommonModule } from '../common/common.module';
import { AclModule } from '../acl/acl.module';
import { DocPermissionGuard } from '../acl/doc-permission.guard';

@Module({
  imports: [CollabModule, CommonModule, AclModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocPermissionGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
