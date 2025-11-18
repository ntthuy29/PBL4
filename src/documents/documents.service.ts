import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      where: { createdById: userId },
      orderBy: { updatedAt: 'desc' },
      include: { content: true, createdBy: true },
    });
    return documents.map((doc) => this.toResponse(doc));
  }

  async findOne(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, createdById: userId },
      include: { content: true, createdBy: true },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return this.toResponse(document);
  }

  async update(id: string, dto: UpdateDocumentDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const owner = await this.ensureUserExists(tx, userId);
      const existing = await tx.document.findFirst({
        where: { id, createdById: userId },
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
      include: { content: true, createdBy: true },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const deleted = await this.prisma.document.delete({
      where: { id: document.id },
      include: { content: true, createdBy: true },
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
        ? JSON.parse(content.snapshot)
        : content.snapshot;

    if (Array.isArray(snapshotValue)) {
      return Buffer.from(snapshotValue);
    }
    return Buffer.from(JSON.stringify(snapshotValue));
  }

  private toResponse(
    document: Prisma.DocumentGetPayload<{
      include: { content: true; createdBy: true };
    }>,
  ) {
    const { content, createdBy, ...rest } = document;
    return {
      ...rest,
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
