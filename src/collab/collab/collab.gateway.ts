import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import * as Y from 'yjs';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { YDocManager } from '../ydoc-manager';
import {
  PresenceService,
  AwarenessPayload,
} from '../../presence/presence.service';
import { RedisPubSub } from '../../cache/redis-pubsub.service';

type JoinPayload = { docId: string };

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  transports: ['websocket'],
})
export class CollabGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private io?: Server;

  constructor(
    private readonly ydocs: YDocManager,
    private readonly presence: PresenceService,
    private readonly redis: RedisPubSub,
  ) {}

  // Lấy server instance hợp lệ (tránh dùng client.server)
  afterInit(server: Server): void {
    this.io = server;

    // Redis inbound: apply + broadcast
    this.redis.onUpdate(async (docId, update) => {
      const state = await this.ydocs.get(docId);
      applyUpdate(state.doc, update, this);
      this.broadcastFromRedis(docId, update);
    });
  }

  handleConnection(_client: Socket): void {
    // TODO: verify JWT nếu cần
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const { docId, clientId } = client.data || {};
    if (!docId || !clientId) return;

    this.presence.delete(docId as string, clientId as number);
    client.to(docId as string).emit('awareness', [{ clientId, payload: null }]);

    const state = await this.ydocs.get(docId as string);
    state.clients.delete(client.id);
    if (state.clients.size === 0) {
      // Save before destroying
      await this.ydocs.forceSnapshot(docId as string);
      this.ydocs.destroy(docId as string);
      this.presence.clearIfEmpty(docId as string);
    }
  }

  @SubscribeMessage('join')
  async onJoin(
    @MessageBody() body: JoinPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean; clientId?: number; error?: string }> {
    const { docId } = body || ({} as JoinPayload);
    if (!docId) return { ok: false, error: 'docId required' };

    client.join(docId);
    client.data.docId = docId;

    // Phase 2: subscribe redis channel 1 lần/process
    await this.redis.subscribeDoc(docId);

    const clientId = this.ydocs.newClientId();
    client.data.clientId = clientId;

    const state = await this.ydocs.get(docId); // state is RoomState
    state.clients.set(client.id, clientId);

    client.emit('awareness', this.presence.snapshot(docId));

    const u8 = encodeStateAsUpdate(state.doc);
    client.emit('sync', u8);

    return { ok: true, clientId };
  }

  @SubscribeMessage('update')
  async onUpdate(
    @MessageBody() encoded: ArrayBuffer,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { docId } = client.data || {};
    if (!docId) return;

    const update = new Uint8Array(encoded);
    const state = await this.ydocs.get(docId as string); // state is RoomState

    applyUpdate(state.doc, update, this);

    // Oplog đã được ghi trong YDocManager, chỉ cần broadcast
    client.to(docId as string).emit('update', update);

    this.redis.publishDoc(docId as string, update);
  }

  @SubscribeMessage('awareness')
  onAwareness(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): void {
    const { docId, clientId } = client.data || {};
    if (!docId || !clientId) return;

    // narrow unknown -> AwarenessPayload an toàn
    const safe: AwarenessPayload =
      typeof payload === 'object' && payload !== null
        ? (payload as AwarenessPayload)
        : {};

    this.presence.set(docId as string, clientId as number, safe);
    client.to(docId as string).emit('awareness', [{ clientId, payload: safe }]);
  }

  private broadcastFromRedis(docId: string, update: Uint8Array): void {
    if (!this.io) return;
    this.io.to(docId).except('redis').emit('update', update);
  }
}
