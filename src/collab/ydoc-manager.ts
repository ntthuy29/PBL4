import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface RoomState {
  doc: Y.Doc;
  // socket.id -> awareness clientId
  clients: Map<string, number>;
  saveTimeout?: NodeJS.Timeout;
}

const SAVE_DEBOUNCE_TIME = 2000; // Lưu sau 2 giây không có thay đổi

@Injectable()
export class YDocManager implements OnModuleDestroy {
  private rooms = new Map<string, RoomState>();
  private awarenessSeq = 1;

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  async get(docId: string): Promise<Y.Doc> {
    const room = this.rooms.get(docId);
    if (room) {
      return room.doc;
    }

    // Nếu room chưa tồn tại, tạo mới
    const doc = new Y.Doc();
    const newRoom: RoomState = { doc, clients: new Map() };
    this.rooms.set(docId, newRoom);

    // Lắng nghe sự kiện update để lên lịch lưu trữ
    doc.on('update', (update, origin) => {
      this.scheduleSave(docId);
    });

    // Tải snapshot từ database
    const snapshot = await this.documentsService.getDocumentSnapshot(docId);
    if (snapshot) {
      Y.applyUpdate(doc, snapshot, this); // Thêm origin để tránh vòng lặp không cần thiết
    }

    return doc;
  }

  newClientId(): number {
    return this.awarenessSeq++;
  }

  scheduleSave(docId: string) {
    const state = this.rooms.get(docId);
    if (!state) return;

    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }

    state.saveTimeout = setTimeout(async () => {
      await this.saveDoc(docId);
    }, SAVE_DEBOUNCE_TIME);
  }

  async saveDoc(docId: string) {
    const state = this.rooms.get(docId);
    if (!state) return;

    const snapshot = Y.encodeStateAsUpdate(state.doc);
    const snapshotJson = JSON.stringify(Array.from(snapshot));

    await this.prisma.documentContent.upsert({
      where: { docId },
      create: {
        docId,
        snapshot: snapshotJson,
        version: 1, // Cần logic version phức tạp hơn nếu muốn
      },
      update: {
        snapshot: snapshotJson,
        version: { increment: 1 },
      },
    });
    console.log(`[YDocManager] Saved document ${docId}`);
  }

  destroy(docId: string) {
    const s = this.rooms.get(docId);
    if (s) {
      s.doc.destroy();
      this.rooms.delete(docId);
      console.log(`[YDocManager] Destroyed document ${docId}`);
    }
  }

  count(docId: string) {
    return this.rooms.get(docId)?.clients.size ?? 0;
  }

  async onModuleDestroy() {
    // Lưu tất cả các document đang mở trước khi ứng dụng tắt
    console.log('[YDocManager] Saving all documents before shutdown...');
    const savePromises = Array.from(this.rooms.keys()).map((docId) =>
      this.saveDoc(docId),
    );
    await Promise.all(savePromises);
  }
}
