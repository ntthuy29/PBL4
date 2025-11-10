import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const DEMO_USER_EMAIL = 'demo@docwave.local';
const DEMO_WORKSPACE_SLUG = 'demo-workspace';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentDto) {
    const documentId = await this.prisma.$transaction(async (tx) => {
      const owner = await this.ensureDemoUser(tx);
      const workspace = await this.ensureDemoWorkspace(tx, owner.id);

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

    return this.findOne(documentId);
  }

  async findAll() {
    const documents = await this.prisma.document.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { content: true, createdBy: true },
    });
    return documents.map((doc) => this.toResponse(doc));
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { content: true, createdBy: true },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return this.toResponse(document);
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.prisma.$transaction(async (tx) => {
      const owner = await this.ensureDemoUser(tx);

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

    return this.findOne(id);
  }

  async remove(id: string) {
    const document = await this.prisma.document.delete({
      where: { id },
      include: { content: true, createdBy: true },
    });
    return this.toResponse(document);
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

  private async ensureDemoUser(tx: Prisma.TransactionClient) {
    const existing = await tx.user.findUnique({
      where: { email: DEMO_USER_EMAIL },
    });
    if (existing) return existing;

    return tx.user.create({
      data: {
        email: DEMO_USER_EMAIL,
        name: 'Demo User',
        password: null,
        avatarUrl: null,
      },
    });
  }

  private async ensureDemoWorkspace(
    tx: Prisma.TransactionClient,
    ownerId: string,
  ) {
    const existing = await tx.workspace.findUnique({
      where: { slug: DEMO_WORKSPACE_SLUG },
    });
    if (existing) return existing;

    return tx.workspace.create({
      data: {
        name: 'Demo Workspace',
        slug: DEMO_WORKSPACE_SLUG,
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
