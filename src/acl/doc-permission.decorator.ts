import { SetMetadata } from '@nestjs/common';

export type DocPermission = 'read' | 'write' | 'admin';

export const DOC_PERMISSION_KEY = 'doc_permission';
export const DocPermission = (permission: DocPermission) =>
  SetMetadata(DOC_PERMISSION_KEY, permission);
