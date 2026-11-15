import { Client } from '@stomp/stompjs';

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
    reconnectDelay: 3000,
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
