import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';

type Handler = (docId: string, payload: Uint8Array) => void;

@Injectable()
export class RedisPubSub implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSub.name);
  private pub?: Redis;
  private sub?: Redis;
  private handlers: Handler[] = [];
  private subscribedDocs = new Set<string>();
  private enabled = false;

  onModuleInit(): void {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn(
        'REDIS_URL not set → Redis Pub/Sub disabled (Phase-1 mode).',
      );
      return;
    }

    this.pub = new IORedis(url); // OK cho publisher
    this.sub = new IORedis(url); // ⬅️ CHỈ 1 THAM SỐ, KHÔNG DÙNG returnBuffers
    this.enabled = true;

    // ioredis sẽ phát 'messageBuffer' tự động dưới dạng Buffer
    this.sub.on('messageBuffer', (channelBuf: Buffer, messageBuf: Buffer) => {
      const channel = channelBuf.toString(); // e.g. "doc:update:<docId>"
      const update = new Uint8Array(messageBuf);
      const docId = channel.replace('doc:update:', '');
      for (const h of this.handlers) h(docId, update);
    });

    this.logger.log('Redis Pub/Sub enabled.');
  }

  onModuleDestroy(): void {
    this.pub?.disconnect();
    this.sub?.disconnect();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onUpdate(handler: Handler): void {
    this.handlers.push(handler);
  }

  private channel(docId: string): string {
    return `doc:update:${docId}`;
  }

  async subscribeDoc(docId: string): Promise<void> {
    if (!this.enabled || !this.sub) return;
    if (this.subscribedDocs.has(docId)) return;
    await this.sub.subscribe(this.channel(docId)); // vẫn dùng subscribe(string)
    this.subscribedDocs.add(docId);
  }

  async publishDoc(docId: string, update: Uint8Array): Promise<void> {
    if (!this.enabled || !this.pub) return;
    await this.pub.publish(this.channel(docId), Buffer.from(update));
  }
}
