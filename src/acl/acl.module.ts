import { Module } from '@nestjs/common';
import { AclController } from './acl.controller';
import { AclService } from './acl.service';
import { DocPermissionGuard } from './doc-permission.guard';

@Module({
  controllers: [AclController],
  providers: [AclService, DocPermissionGuard],
  exports: [AclService, DocPermissionGuard],
})
export class AclModule {}
