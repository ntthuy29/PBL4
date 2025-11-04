declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';

  export interface SetupWSConnectionOptions {
    docName?: string;
    gc?: boolean;
    /**
     * Additional configuration accepted by y-websocket's utility.
     * This keeps the declaration flexible while providing core hints.
     */
    [key: string]: unknown;
  }

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: SetupWSConnectionOptions
  ): void;
}
