import { Injectable, OnModuleInit } from '@nestjs/common';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { YDocManager } from './ydoc-manager';

@Injectable()
export class YWebsocketService implements OnModuleInit {
  constructor(private readonly ydocManager: YDocManager) {}

  onModuleInit() {
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('okay');
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', (conn, req) => {
      // `setupWSConnection` là hàm cốt lõi từ `y-websocket`
      // Nó sẽ xử lý tất cả các message sync và awareness.
      // Chúng ta chỉ cần cung cấp cho nó cách để lấy Y.Doc.
      setupWSConnection(conn, req, {
        docName: req.url.slice(1).split('?')[0], // Lấy docId từ URL
        gc: true,
        doc: this.ydocManager, // ydocManager của chúng ta tương thích với interface này
      });
    });

    server.listen(3001);
    console.log('y-websocket server listening on port 3001');
  }
}
