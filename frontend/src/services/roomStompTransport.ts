import { Client } from '@stomp/stompjs';

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * Computes an exponential backoff delay (1s, 2s, 4s... capped at 15s) with full jitter.
 */
export function computeJitteredReconnectDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** Math.max(0, attempt));
  const clamped = Math.min(1, Math.max(0, random()));
  return Math.round(clamped * ceiling);
}

export interface StompTransportConfig {
  brokerURL: string;
  connectHeaders: Record<string, string>;
  onConnect: () => void;
  onDisconnect?: () => void;
  onWebSocketClose?: (code: number) => void;
  onStompError?: (message: string) => void;
}

export interface StompTransport {
  activate(): void;
  subscribe(destination: string, handler: (body: string) => void): () => void;
  publish(destination: string, body: string): void;
  disableReconnect(): void;
  deactivate(): Promise<void>;
}

/**
 * Creates a STOMP-over-WebSocket transport backed by `@stomp/stompjs`.
 */
export function createStompJsTransport(config: StompTransportConfig): StompTransport {
  const client = new Client({
    brokerURL: config.brokerURL,
    connectHeaders: config.connectHeaders,
    // Managed by RoomStompSession using exponential backoff with full jitter
    reconnectDelay: 0,
    onConnect: () => config.onConnect(),
    onDisconnect: () => config.onDisconnect?.(),
    onWebSocketClose: (ev) => config.onWebSocketClose?.(ev?.code ?? 1000),
    onStompError: (frame) =>
      config.onStompError?.(frame.headers['message'] || frame.body || 'STOMP error'),
  });

  return {
    activate: () => client.activate(),
    subscribe: (destination, handler) => {
      const subscription = client.subscribe(destination, (frame) => handler(frame.body));
      return () => subscription.unsubscribe();
    },
    publish: (destination, body) => client.publish({ destination, body }),
    disableReconnect: () => {
      client.reconnectDelay = 0;
    },
    deactivate: () => client.deactivate(),
  };
}
