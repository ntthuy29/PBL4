import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocPermission, DOC_PERMISSION_KEY } from './doc-permission.decorator';
import { AclService } from './acl.service';

@Injectable()
export class DocPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly acl: AclService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<DocPermission>(
      DOC_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const docId =
      request.params?.id ||
      request.body?.docId ||
      request.query?.docId ||
      request.params?.docId;

    if (!userId || !docId) {
      throw new ForbiddenException('Missing user or doc context');
    }

    switch (required) {
      case 'read':
        if (await this.acl.canRead(docId, userId)) return true;
        break;
      case 'write':
        if (await this.acl.canWrite(docId, userId)) return true;
        break;
      case 'admin':
        if (await this.acl.canAdmin(docId, userId)) return true;
        break;
      default:
        break;
    }

    throw new ForbiddenException('Insufficient permission for document');
  }
}
