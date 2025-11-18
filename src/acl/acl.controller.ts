import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth/jwt-auth.guard';
import { AclService } from './acl.service';
import { DocPermission } from './doc-permission.decorator';
import { DocPermissionGuard } from './doc-permission.guard';

@UseGuards(JwtAuthGuard, DocPermissionGuard)
@Controller('acl')
export class AclController {
  constructor(private readonly acl: AclService) {}

  @DocPermission('admin')
  @Post('documents/:id/collaborators')
  addCollaborator(
    @Param('id') docId: string,
    @Body() body: { email: string; role: 'viewer' | 'commenter' | 'editor' },
  ) {
    return this.acl.addCollaboratorByEmail(docId, body.email, body.role);
  }

  @DocPermission('admin')
  @Patch('documents/:id/collaborators/:userId')
  updateCollaborator(
    @Param('id') docId: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'viewer' | 'commenter' | 'editor' },
  ) {
    return this.acl.updateCollaboratorRole(docId, userId, body.role);
  }

  @DocPermission('admin')
  @Delete('documents/:id/collaborators/:userId')
  removeCollaborator(
    @Param('id') docId: string,
    @Param('userId') userId: string,
  ) {
    return this.acl.removeCollaborator(docId, userId);
  }
}
