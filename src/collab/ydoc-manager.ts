import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { OplogService } from './oplog.service';
import { SnapshotService } from './snapshot.service';

export interface RoomState {
  doc: Y.Doc;
  // socket.id -> awareness clientId
  clients: Map<string, number>;
  lastSeq: number; // seq của op cuối cùng đã được apply
  snapshotTimeout?: NodeJS.Timeout;
}

const SNAPSHOT_INTERVAL = 60000; // Tạo snapshot mỗi 60 giây nếu có thay đổi

@Injectable()
export class YDocManager implements OnModuleDestroy {
  private rooms = new Map<string, RoomState>();
  private awarenessSeq = 1;

  constructor(
    private readonly oplogService: OplogService,
    private readonly snapshotService: SnapshotService,
  ) {}

  async get(docId: string): Promise<RoomState> {
    const room = this.rooms.get(docId);
    if (room) {
      return room;
    }

    // Nếu room chưa tồn tại, tạo mới
    console.log(`[YDocManager] Creating new room for docId: ${docId}`);
    const doc = new Y.Doc();

    // 1. Tải snapshot (nếu có)
    const snapshot = await this.snapshotService.load(docId);
    let seq = 0;
    if (snapshot) {
      Y.applyUpdate(doc, snapshot.data, this);
      seq = snapshot.seq;
      console.log(
        `[YDocManager] Loaded snapshot for doc ${docId} at seq ${seq}`,
      );
    }

    // 2. Replay oplog từ seq của snapshot
    const ops = await this.oplogService.range(docId, seq);
    for (const op of ops) {
      Y.applyUpdate(doc, new Uint8Array(op.op as number[]), this);
      seq = op.seq;
    }
    console.log(
      `[YDocManager] Replayed ${ops.length} ops for doc ${docId}. Current seq: ${seq}`,
    );

    const newRoom: RoomState = { doc, clients: new Map(), lastSeq: seq };
    this.rooms.set(docId, newRoom);

    // Lắng nghe sự kiện update để lên lịch lưu trữ
    doc.on('update', async (update, origin) => {
      if (origin !== this) {
        const op = await this.oplogService.append(docId, Array.from(update));
        newRoom.lastSeq = op.seq;
        this.scheduleSnapshot(docId);
      }
    });

    return newRoom;
  }

  newClientId(): number {
    return this.awarenessSeq++;
  }

  scheduleSnapshot(docId: string) {
    const state = this.rooms.get(docId);
    if (!state) return;

    if (state.snapshotTimeout) {
      clearTimeout(state.snapshotTimeout);
    }

    state.snapshotTimeout = setTimeout(() => {
      this.forceSnapshot(docId);
    }, SNAPSHOT_INTERVAL);
  }

  async forceSnapshot(docId: string) {
    const state = this.rooms.get(docId);
    if (!state) return;

    if (state.snapshotTimeout) {
      clearTimeout(state.snapshotTimeout);
    }
    await this.snapshotService.save(docId, state.doc, state.lastSeq);
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
    const snapshotPromises = Array.from(this.rooms.keys()).map((docId) =>
      this.forceSnapshot(docId),
    );
    await Promise.all(snapshotPromises);
  }
}
