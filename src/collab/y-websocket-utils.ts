import type { IncomingMessage } from 'http';
import type { RawData } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as authProtocol from 'y-protocols/auth';
import { WebSocket as WsImpl } from 'ws';
import { YDocManager } from './ydoc-manager';

type WS = InstanceType<typeof WsImpl>;

const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;
const messageQueryAwareness = 3;
const pingIntervalMs = 30_000;

interface DocEntry {
  id: string;
  connections: Set<WS>;
  awareness: awarenessProtocol.Awareness;
  updateListener: (update: Uint8Array, origin: unknown) => void;
  destroy: () => void;
}

interface SetupWSConnectionOptions {
  docName?: string;
  gc?: boolean;
  manager: YDocManager;
  userId?: string;
  canWrite?: boolean;
}

const docEntries = new Map<string, DocEntry>();
const pendingEntries = new Map<string, Promise<DocEntry>>();
const awarenessStatesByConnection = new Map<WS, Set<number>>();

const parseDocName = (req?: IncomingMessage, explicit?: string): string => {
  if (explicit) return explicit;
  const url = req?.url ?? '';
  const normalized = url.startsWith('/') ? url.slice(1) : url;
  return normalized.split('?')[0] || 'default';
};

const toUint8Array = (data: RawData): Uint8Array => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(Buffer.from(data));
};

const sendEncoded = (conn: WS, encoder: encoding.Encoder) => {
  if (conn.readyState !== WsImpl.OPEN) return;
  const message = encoding.toUint8Array(encoder);
  if (message.length === 0) return;
  try {
    conn.send(message, { binary: true });
  } catch {
    // ignore broken pipe
  }
};

const broadcast = (
  entry: DocEntry,
  origin: WS | null,
  payload: Uint8Array,
) => {
  entry.connections.forEach((client) => {
    if (client === origin || client.readyState !== WsImpl.OPEN) return;
    try {
      client.send(payload, { binary: true });
    } catch {
      // ignore send failures
    }
  });
};

const encodeAwarenessSnapshot = (awareness: awarenessProtocol.Awareness) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      Array.from(awareness.getStates().keys()),
    ),
  );
  return encoding.toUint8Array(encoder);
};

const readClientsFromAwarenessUpdate = (update: Uint8Array) => {
  const clients = new Map<number, boolean>();
  const decoder = decoding.createDecoder(update);
  const len = decoding.readVarUint(decoder);
  for (let i = 0; i < len; i++) {
    const clientId = decoding.readVarUint(decoder);
    decoding.readVarUint(decoder); // clock
    const state = JSON.parse(decoding.readVarString(decoder));
    clients.set(clientId, state !== null);
  }
  return clients;
};

const ensureDocEntry = async (
  docName: string,
  manager: YDocManager,
): Promise<DocEntry> => {
  const existing = docEntries.get(docName);
  if (existing) return existing;

  const pending = pendingEntries.get(docName);
  if (pending) return pending;

  const creation = (async () => {
    const room = await manager.get(docName);
    const awareness = new awarenessProtocol.Awareness(room.doc);
    const connections = new Set<WS>();

    const updateListener = (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const payload = encoding.toUint8Array(encoder);
      const originConn =
        origin && typeof origin === 'object' && origin instanceof WsImpl
          ? (origin as WS)
          : null;
      broadcast(entry, originConn, payload);
    };

    const entry: DocEntry = {
      id: docName,
      connections,
      awareness,
      updateListener,
      destroy: () => {
        room.doc.off('update', updateListener);
        awareness.destroy();
        docEntries.delete(docName);
      },
    };

    room.doc.on('update', updateListener);

    docEntries.set(docName, entry);
    pendingEntries.delete(docName);
    return entry;
  })();

  pendingEntries.set(docName, creation);
  return creation;
};

const cleanupConnection = (conn: WS, entry: DocEntry) => {
  entry.connections.delete(conn);
  const controlled = awarenessStatesByConnection.get(conn);
  if (controlled && controlled.size > 0) {
    awarenessProtocol.removeAwarenessStates(
      entry.awareness,
      Array.from(controlled),
      conn,
    );
    awarenessStatesByConnection.delete(conn);
  }

  if (entry.connections.size === 0) {
    entry.destroy();
  }
};

const handleAwarenessMessage = (
  entry: DocEntry,
  conn: WS,
  update: Uint8Array,
) => {
  const clients = readClientsFromAwarenessUpdate(update);
  const controlled =
    awarenessStatesByConnection.get(conn) ?? new Set<number>();
  clients.forEach((hasState, clientId) => {
    if (hasState) {
      controlled.add(clientId);
    } else {
      controlled.delete(clientId);
    }
  });
  awarenessStatesByConnection.set(conn, controlled);
  awarenessProtocol.applyAwarenessUpdate(entry.awareness, update, conn);

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, update);
  const payload = encoding.toUint8Array(encoder);
  broadcast(entry, conn, payload);
};

const respondWithAwareness = (entry: DocEntry, conn: WS) => {
  const payload = encodeAwarenessSnapshot(entry.awareness);
  if (conn.readyState === WsImpl.OPEN) {
    conn.send(payload, { binary: true });
  }
};

const handleSyncMessage = (
  entry: DocEntry,
  conn: WS,
  decoder: decoding.Decoder,
  canWrite: boolean,
) => {
  const currentPos = decoder.pos;
  const innerType = decoding.readVarUint(decoder);
  decoder.pos = currentPos;
  if (
    innerType === syncProtocol.messageYjsUpdate &&
    !canWrite
  ) {
    // Skip applying updates if user cannot write
    return;
  }

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.readSyncMessage(decoder, encoder, entry.awareness.doc, conn);
  if (encoding.length(encoder) > 1) {
    sendEncoded(conn, encoder);
  }
};

const handleAuthMessage = (
  entry: DocEntry,
  conn: WS,
  decoder: decoding.Decoder,
) => {
  authProtocol.readAuthMessage(decoder, entry.awareness.doc, (_ydoc, reason) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAuth);
    encoding.writeVarString(encoder, reason || 'permission-denied');
    sendEncoded(conn, encoder);
  });
};

const registerMessageListener = (
  entry: DocEntry,
  conn: WS,
  canWrite: boolean,
) => (data: RawData) => {
  const decoder = decoding.createDecoder(toUint8Array(data));
  const messageType = decoding.readVarUint(decoder);
  switch (messageType) {
    case messageSync:
      handleSyncMessage(entry, conn, decoder, canWrite);
      break;
    case messageAwareness:
      handleAwarenessMessage(entry, conn, decoding.readVarUint8Array(decoder));
      break;
    case messageQueryAwareness:
      respondWithAwareness(entry, conn);
      break;
    case messageAuth:
      handleAuthMessage(entry, conn, decoder);
      break;
    default:
      // unsupported message type; ignore
      break;
  }
};

export const setupWSConnection = async (
  conn: WS,
  req: IncomingMessage,
  opts: SetupWSConnectionOptions,
): Promise<void> => {
  if (!opts?.manager) {
    throw new Error('setupWSConnection requires a YDocManager instance');
  }

  const docName = parseDocName(req, opts.docName);
  const entry = await ensureDocEntry(docName, opts.manager);

  entry.awareness.doc.gc = opts.gc ?? true;
  entry.connections.add(conn);

  const pingInterval = setInterval(() => {
    if (conn.readyState !== WsImpl.OPEN) return;
    try {
      conn.ping();
    } catch {
      // ignore ping errors
    }
  }, pingIntervalMs);

  conn.on('close', () => {
    clearInterval(pingInterval);
    cleanupConnection(conn, entry);
  });

  conn.on('message', registerMessageListener(entry, conn, opts.canWrite ?? false));

  if (conn.readyState === WsImpl.OPEN) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, entry.awareness.doc);
    sendEncoded(conn, encoder);
    respondWithAwareness(entry, conn);
  }
};
