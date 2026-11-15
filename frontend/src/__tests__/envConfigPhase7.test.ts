import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Phase 7 frontend env URL resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('derives HTTPS API base and WSS STOMP URL from VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://study.duckdns.org/');
    vi.stubEnv('VITE_WS_BASE_URL', '');
    vi.resetModules();

    const { API_BASE_URL } = await import('../services/apiClient');
    const { resolveWebSocketUrl } = await import('../services/roomApi');

    expect(API_BASE_URL).toBe('https://study.duckdns.org');
    expect(resolveWebSocketUrl()).toBe('wss://study.duckdns.org/ws');
  });

  it('uses explicit VITE_WS_BASE_URL when configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://study.duckdns.org');
    vi.stubEnv('VITE_WS_BASE_URL', 'wss://realtime.study.duckdns.org');
    vi.resetModules();

    const { resolveWebSocketUrl } = await import('../services/roomApi');

    expect(resolveWebSocketUrl()).toBe('wss://realtime.study.duckdns.org/ws');
  });

  it('does not fall back to localhost when PROD is true and env is empty', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_WS_BASE_URL', '');
    vi.resetModules();

    const { API_BASE_URL } = await import('../services/apiClient');
    const { resolveWebSocketUrl } = await import('../services/roomApi');

    expect(API_BASE_URL).toBe('');
    expect(() => resolveWebSocketUrl()).toThrow(/VITE_API_BASE_URL/);
  });
});
