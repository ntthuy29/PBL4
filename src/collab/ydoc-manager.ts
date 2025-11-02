import * as Y from 'yjs';

export interface RoomState {
  doc: Y.Doc;
  // socket.id -> awareness clientId
  clients: Map<string, number>;
}

export class YDocManager {
  private rooms = new Map<string, RoomState>();
  private awarenessSeq = 1;

  getOrCreate(docId: string): RoomState {
    let state = this.rooms.get(docId);
    if (!state) {
      const doc = new Y.Doc();
      state = { doc, clients: new Map() };
      this.rooms.set(docId, state);
    }
    return state;
  }

  newClientId(): number {
    return this.awarenessSeq++;
  }

  destroyIfEmpty(docId: string) {
    const s = this.rooms.get(docId);
    if (s && s.clients.size === 0) {
      s.doc.destroy();
      this.rooms.delete(docId);
    }
  }

  count(docId: string) {
    return this.rooms.get(docId)?.clients.size ?? 0;
  }
}
