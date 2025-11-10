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
    const snapshotJson = JSON.stringify(Array.from(snapshot));

    await this.prisma.documentContent.upsert({
      where: { docId },
      create: {
        docId,
        snapshot: snapshotJson,
        seqAtSnapshot: seq,
        version: 1,
      },
      update: {
        snapshot: snapshotJson,
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
      const snapshotArray = JSON.parse(content.snapshot as string);
      return { data: Buffer.from(snapshotArray), seq: content.seqAtSnapshot };
    }
    return null;
  }
}
