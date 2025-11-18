import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as Y from 'yjs';

export interface Snapshot {
  data: Buffer;
  seq: number;
}

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lưu snapshot của một Y.Doc vào database.
   * @param docId ID của document
   * @param ydoc Instance của Y.Doc
   * @param seq Sequence number của operation cuối cùng trong snapshot
   */
  async save(docId: string, ydoc: Y.Doc, seq: number): Promise<void> {
    const snapshot = Y.encodeStateAsUpdate(ydoc);
    const snapshotBase64 = Buffer.from(snapshot).toString('base64');

    await this.prisma.documentContent.upsert({
      where: { docId },
      create: {
        docId,
        snapshot: snapshotBase64,
        seqAtSnapshot: seq,
        version: 1,
      },
      update: {
        snapshot: snapshotBase64,
        seqAtSnapshot: seq,
        version: { increment: 1 },
      },
    });
    console.log(
      `[SnapshotService] Saved snapshot for doc ${docId} at seq ${seq}`,
    );
  }

  /**
   * Tải snapshot mới nhất từ database.
   * @param docId ID của document
   */
  async load(docId: string): Promise<Snapshot | null> {
    const content = await this.prisma.documentContent.findUnique({
      where: { docId },
    });
    if (content?.snapshot && content.seqAtSnapshot != null) {
      const rawSnapshot = content.snapshot as unknown;
      if (typeof rawSnapshot === 'string') {
        if (rawSnapshot.trim().startsWith('[')) {
          const bytes = JSON.parse(rawSnapshot) as number[];
          return { data: Buffer.from(bytes), seq: content.seqAtSnapshot };
        }
        return {
          data: Buffer.from(rawSnapshot, 'base64'),
          seq: content.seqAtSnapshot,
        };
      }

      if (Array.isArray(rawSnapshot)) {
        return {
          data: Buffer.from(rawSnapshot as number[]),
          seq: content.seqAtSnapshot,
        };
      }
    }
    return null;
  }
}
