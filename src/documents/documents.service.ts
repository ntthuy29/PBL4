import { Injectable, NotFoundException } from '@nestjs/common';
import { DocRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentDto, userId: string) {
    const documentId = await this.prisma.$transaction(async (tx) => {
      const owner = await this.ensureUserExists(tx, userId);
      const workspace = await this.ensureUserWorkspace(tx, owner.id);

      const document = await tx.document.create({
        data: {
          title: dto.title,
          workspaceId: workspace.id,
          folderId: null,
          createdById: owner.id,
          updatedById: owner.id,
          isArchived: dto.isArchived ?? false,
          slug: null,
        },
      });

      await this.saveContentIfProvided(tx, document.id, dto.content);
      return document.id;
    });

    return this.findOne(documentId, userId);
  }

  async findAll(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        OR: [{ createdById: userId }, { collaborators: { some: { userId } } }],
        isArchived: false,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        content: true,
        createdBy: true,
        collaborators: {
          include: {
            user: true,
          },
        },
      },
    });
    return documents.map((doc) => this.toResponse(doc, userId));
  }

  async findMyDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        createdById: userId,
        isArchived: false,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        content: true,
        createdBy: true,
        collaborators: {
          include: {
            user: true,
          },
        },
      },
    });
    return documents.map((doc) => this.toResponse(doc, userId));
  }

  async findSharedDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        collaborators: { some: { userId } },
        createdById: { not: userId },
        isArchived: false,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        content: true,
        createdBy: true,
        collaborators: {
          include: {
            user: true,
          },
        },
      },
    });
    return documents.map((doc) => this.toResponse(doc, userId));
  }

  async findRecentDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        OR: [{ createdById: userId }, { collaborators: { some: { userId } } }],
        isArchived: false,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10, // Chỉ lấy 10 documents gần đây nhất
      include: {
        content: true,
        createdBy: true,
        collaborators: {
          include: {
            user: true,
          },
        },
      },
    });
    return documents.map((doc) => this.toResponse(doc, userId));
  }

  async findStarredDocuments(userId: string) {
    // Tạm thời trả về empty array vì chưa có bảng starred
    // Trong tương lai sẽ implement bảng user_document_stars
    await Promise.resolve(); // Để tránh lỗi no await
    return [];
  }

  async findOne(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        OR: [{ createdById: userId }, { collaborators: { some: { userId } } }],
      },
      include: {
        content: true,
        createdBy: true,
        collaborators: {
          include: { user: true },
        },
      },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return this.toResponse(document, userId);
  }

  async update(id: string, dto: UpdateDocumentDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const owner = await this.ensureUserExists(tx, userId);
      const existing = await tx.document.findFirst({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(`Document ${id} not found`);
      }

      const data: Prisma.DocumentUncheckedUpdateInput = {
        updatedAt: new Date(),
        updatedById: owner.id,
      };

      if (dto.title !== undefined) data.title = dto.title;
      if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

      await tx.document.update({
        where: { id },
        data,
      });

      await this.saveContentIfProvided(tx, id, dto.content);
    });

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, createdById: userId },
      include: {
        content: true,
        createdBy: true,
        collaborators: { include: { user: true } },
      },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const deleted = await this.prisma.document.delete({
      where: { id: document.id },
      include: {
        content: true,
        createdBy: true,
        collaborators: { include: { user: true } },
      },
    });
    return this.toResponse(deleted);
  }

  async getDocumentSnapshot(docId: string): Promise<Buffer | null> {
    const content = await this.prisma.documentContent.findUnique({
      where: { docId },
    });
    if (!content?.snapshot) {
      return null;
    }

    const snapshotValue =
      typeof content.snapshot === 'string'
        ? (JSON.parse(content.snapshot) as unknown)
        : content.snapshot;

    if (Array.isArray(snapshotValue)) {
      return Buffer.from(snapshotValue);
    }
    return Buffer.from(JSON.stringify(snapshotValue));
  }

  private mapRole(role: DocRole): 'owner' | 'editor' | 'commenter' | 'viewer' {
    switch (role) {
      case DocRole.OWNER:
        return 'owner';
      case DocRole.EDIT:
        return 'editor';
      case DocRole.COMMENT:
        return 'commenter';
      case DocRole.VIEW:
      default:
        return 'viewer';
    }
  }

  private toResponse(
    document: Prisma.DocumentGetPayload<{
      include: {
        content: true;
        createdBy: true;
        collaborators: { include: { user: true } };
      };
    }>,
    currentUserId?: string,
  ) {
    const { content, createdBy, collaborators = [], ...rest } = document;
    const permissions = [
      { userId: document.createdById, role: 'owner' as const },
      ...collaborators.map((c) => ({
        userId: c.userId,
        role: this.mapRole(c.role),
        email: c.user?.email ?? null,
        name: c.user?.name ?? null,
        avatar: c.user?.avatarUrl ?? null,
      })),
    ];
    const currentUserRole =
      currentUserId === document.createdById
        ? ('owner' as const)
        : (permissions.find((p) => p.userId === currentUserId)?.role ??
          ('viewer' as const));

    return {
      ...rest,
      currentUserRole,
      permissions,
      content: content?.snapshot ?? null,
      seqAtSnapshot: content?.seqAtSnapshot ?? null,
      version: content?.version ?? null,
      createdBy: createdBy
        ? {
            id: createdBy.id,
            name: createdBy.name ?? 'Demo User',
            avatarUrl: createdBy.avatarUrl ?? null,
          }
        : null,
    };
  }

  private async ensureUserExists(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user;
  }

  private async ensureUserWorkspace(
    tx: Prisma.TransactionClient,
    ownerId: string,
  ) {
    const existing = await tx.workspace.findFirst({
      where: { ownerId },
    });
    if (existing) return existing;

    const owner = await this.ensureUserExists(tx, ownerId);
    const slug = `ws-${ownerId}`;

    return tx.workspace.create({
      data: {
        name: owner.name ? `${owner.name}'s Workspace` : 'My Workspace',
        slug,
        ownerId,
      },
    });
  }

  private saveContentIfProvided(
    tx: Prisma.TransactionClient,
    docId: string,
    content?: unknown,
  ) {
    if (content === undefined) {
      return;
    }

    const snapshot =
      typeof content === 'string'
        ? content
        : (content as Prisma.InputJsonValue);

    return tx.documentContent
      .upsert({
        where: { docId },
        create: {
          docId,
          snapshot,
          seqAtSnapshot: 0,
        },
        update: {
          snapshot,
          version: { increment: 1 },
        },
      })
      .then(() => undefined);
  }
}
