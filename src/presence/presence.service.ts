import { Injectable } from '@nestjs/common';

export type AwarenessPayload = {
  cursor?: { x: number; y: number; anchor?: number; head?: number };
  name?: string;
  color?: string;
  // cho phép field mở rộng, nhưng không phải any
  [k: string]: unknown;
};

export interface AwarenessEntry {
  clientId: number;
  payload: AwarenessPayload | null;
}

@Injectable()
export class PresenceService {
  // docId -> (clientId -> payload)
  private store = new Map<string, Map<number, AwarenessPayload>>();

  private ensure(docId: string): Map<number, AwarenessPayload> {
    let m = this.store.get(docId);
    if (!m) {
      m = new Map<number, AwarenessPayload>();
      this.store.set(docId, m);
    }
    return m;
  }

  set(docId: string, clientId: number, payload: AwarenessPayload): void {
    this.ensure(docId).set(clientId, payload);
  }

  delete(docId: string, clientId: number): void {
    this.ensure(docId).delete(clientId);
  }

  snapshot(docId: string): AwarenessEntry[] {
    const m = this.ensure(docId);
    return Array.from(m.entries()).map(([clientId, payload]) => ({ clientId, payload }));
  }

  clearIfEmpty(docId: string): void {
    const m = this.store.get(docId);
    if (m && m.size === 0) this.store.delete(docId);
  }
}
