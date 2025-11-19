import { Injectable, OnModuleInit } from '@nestjs/common';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from './y-websocket-utils';
import { YDocManager } from './ydoc-manager';
import { JwtService } from '@nestjs/jwt';
import { AclService } from '../acl/acl.service';

@Injectable()
export class YWebsocketService implements OnModuleInit {
  constructor(
    private readonly ydocManager: YDocManager,
    private readonly jwtService: JwtService,
    private readonly aclService: AclService,
  ) {}

  onModuleInit() {
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('okay');
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', async (conn, req) => {
      // `setupWSConnection` là hàm cốt lõi từ `y-websocket`
      // Nó sẽ xử lý tất cả các message sync và awareness.
      // Chúng ta chỉ cần cung cấp cho nó cách để lấy Y.Doc và quyền.
      try {
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token') || req.headers['authorization']?.toString()?.replace('Bearer ', '');
        let userId: string | null = null;
        if (token) {
          try {
            const payload = this.jwtService.verify(token, {
              secret: process.env.JWT_ACCESS_SECRET,
            });
            userId = payload?.sub ?? null;
          } catch {
            // invalid token
          }
        }

        if (!userId) {
          conn.close(4401, 'unauthorized');
          return;
        }

        const docId = req.url.slice(1).split('?')[0];
        const canRead = await this.aclService.canRead(docId, userId);
        const canWrite = () => this.aclService.canWrite(docId, userId);
        if (!canRead) {
          conn.close(4403, 'forbidden');
          return;
        }

        await setupWSConnection(conn, req, {
          docName: docId, // Lấy docId từ URL
          gc: true,
          manager: this.ydocManager,
          userId,
          canWrite,
        });
      } catch (error) {
        console.error('[YWebsocketService] Failed to setup connection', error);
        conn.close();
      }
    });

    server.listen(3001);
    console.log('y-websocket server listening on port 3001');
  }
}
