import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocRole } from '@prisma/client';

@Injectable()
export class AclService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoleForUser(docId: string, userId: string): Promise<DocRole | null> {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { createdById: true },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${docId} not found`);
    }
    if (doc.createdById === userId) return DocRole.OWNER;

    const collab = await this.prisma.documentCollaborator.findUnique({
      where: { docId_userId: { docId, userId } },
      select: { role: true },
    });
    return collab?.role ?? null;
  }

  async canRead(docId: string, userId: string): Promise<boolean> {
    const role = await this.getRoleForUser(docId, userId);
    return role !== null;
  }

  async canWrite(docId: string, userId: string): Promise<boolean> {
    const role = await this.getRoleForUser(docId, userId);
    return role === DocRole.OWNER || role === DocRole.EDIT;
  }

  async canAdmin(docId: string, userId: string): Promise<boolean> {
    const role = await this.getRoleForUser(docId, userId);
    return role === DocRole.OWNER;
  }

  private mapRoleInput(role: string): DocRole {
    switch (role) {
      case 'editor':
        return DocRole.EDIT;
      case 'commenter':
        return DocRole.COMMENT;
      case 'viewer':
      default:
        return DocRole.VIEW;
    }
  }

  async addCollaboratorByEmail(
    docId: string,
    email: string,
    role: 'viewer' | 'commenter' | 'editor',
  ) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    const mapped = this.mapRoleInput(role);
    await this.prisma.documentCollaborator.upsert({
      where: { docId_userId: { docId, userId: user.id } },
      create: { docId, userId: user.id, role: mapped },
      update: { role: mapped },
    });
    return {
      userId: user.id,
      role: mapped,
      email: user.email,
      name: user.name,
      avatar: user.avatarUrl,
    };
  }

  async updateCollaboratorRole(
    docId: string,
    userId: string,
    role: 'viewer' | 'commenter' | 'editor',
  ) {
    const mapped = this.mapRoleInput(role);
    const updated = await this.prisma.documentCollaborator.update({
      where: { docId_userId: { docId, userId } },
      data: { role: mapped },
    });
    const user = await this.prisma.user.findUnique({ where: { id: updated.userId } });
    return {
      userId: updated.userId,
      role: mapped,
      email: user?.email,
      name: user?.name,
      avatar: user?.avatarUrl,
    };
  }

  async removeCollaborator(docId: string, userId: string) {
    await this.prisma.documentCollaborator.delete({
      where: { docId_userId: { docId, userId } },
    });
    return { removed: true };
  }
}
