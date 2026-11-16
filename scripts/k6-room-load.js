/**
 * Parameterized k6 load test simulating concurrent STOMP learners moving at 10Hz
 * and sending Room Chat messages in Cùng Nhau Học Bài.
 *
 * Example usage:
 *   k6 run -e BASE_URL=http://localhost:8080 -e VUS=25 -e DURATION=30s scripts/k6-room-load.js
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { buildStompFrame, nextWalkableStep, parseStompFrames } from './k6-stomp-helpers.js';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const WS_URL =
  __ENV.WS_URL || `${BASE_URL.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')}/ws`;
const ORIGIN = __ENV.ORIGIN || 'http://localhost:5173';
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '30s';
const MOVE_HZ = Number(__ENV.MOVE_HZ || 10);
const MOVE_INTERVAL_MS = Math.max(95, Math.round(1000 / MOVE_HZ));
const CHAT_INTERVAL_MS = Number(__ENV.CHAT_INTERVAL_MS || 5000);
const P95_BROADCAST_MS = Number(__ENV.P95_BROADCAST_MS || 250);
const WS_CONN_DURATION_MS = Number(__ENV.WS_CONN_DURATION_MS || 15000);

const stompBroadcastLatencyMs = new Trend('stomp_broadcast_latency_ms', true);
const stompMoveRttMs = new Trend('stomp_move_rtt_ms', true);
const stompChatRttMs = new Trend('stomp_chat_rtt_ms', true);
const stompErrorRate = new Rate('stomp_error_rate');
const stompEventsReceived = new Counter('stomp_events_received');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    stomp_error_rate: ['rate<0.01'],
    stomp_broadcast_latency_ms: [`p(95)<${P95_BROADCAST_MS}`],
  },
};

export default function () {
  const vuId = __VU || 1;
  const forwardedIp = `203.0.113.${((vuId - 1) % 250) + 1}`;
  const commonHeaders = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    'X-Forwarded-For': forwardedIp,
  };

  // 1. Issue Guest JWT
  const guestRes = http.post(
    `${BASE_URL}/api/v1/auth/guest`,
    JSON.stringify({
      nickname: `k6_user_${vuId}`,
      avatarId: 'default_student',
      studyGoal: 'k6 10Hz load check',
    }),
    { headers: commonHeaders },
  );

  const guestOk = check(guestRes, {
    'guest auth status is 200': (r) => r.status === 200,
  });
  if (!guestOk) {
    stompErrorRate.add(1);
    sleep(1);
    return;
  }

  const { guestId, guestToken } = guestRes.json();
  const authHeaders = {
    ...commonHeaders,
    Authorization: `Bearer ${guestToken}`,
  };

  // 2. Join room shard
  const joinRes = http.post(`${BASE_URL}/api/v1/rooms/join`, '{}', { headers: authHeaders });
  const joinOk = check(joinRes, {
    'room join status is 200': (r) => r.status === 200,
  });
  if (!joinOk) {
    stompErrorRate.add(1);
    sleep(1);
    return;
  }
  const { roomId } = joinRes.json();

  // 3. Open STOMP over WebSocket session
  let pos = { x: 12, y: 13 };
  let moveStep = 0;
  let lastMoveSentAt = 0;
  let lastChatSentAt = 0;

  const wsRes = ws.connect(WS_URL, { headers: { Origin: ORIGIN } }, (socket) => {
    socket.on('open', () => {
      socket.send(
        buildStompFrame('CONNECT', {
          'accept-version': '1.2',
          Authorization: `Bearer ${guestToken}`,
        }),
      );
    });

    socket.on('message', (rawData) => {
      for (const frame of parseStompFrames(rawData)) {
        if (frame.command === 'CONNECTED') {
          socket.send(
            buildStompFrame('SUBSCRIBE', {
              id: 'sub-errors',
              destination: '/user/queue/errors',
            }),
          );
          socket.send(
            buildStompFrame('SUBSCRIBE', {
              id: 'sub-room',
              destination: `/topic/room/${roomId}/events`,
            }),
          );
          socket.send(
            buildStompFrame('SEND', {
              destination: `/app/room/${roomId}/join`,
            }),
          );

          http.get(`${BASE_URL}/api/v1/rooms/${roomId}/state`, { headers: authHeaders });

          socket.setInterval(() => {
            const next = nextWalkableStep(pos, moveStep++);
            pos = { x: next.x, y: next.y };
            lastMoveSentAt = Date.now();
            socket.send(
              buildStompFrame(
                'SEND',
                {
                  destination: `/app/room/${roomId}/move`,
                  'content-type': 'application/json',
                },
                JSON.stringify(next),
              ),
            );
          }, MOVE_INTERVAL_MS);

          socket.setInterval(() => {
            lastChatSentAt = Date.now();
            socket.send(
              buildStompFrame(
                'SEND',
                {
                  destination: `/app/room/${roomId}/chat`,
                  'content-type': 'application/json',
                },
                JSON.stringify({ content: `k6 ping from VU ${vuId} @ ${lastChatSentAt}` }),
              ),
            );
          }, CHAT_INTERVAL_MS);
        } else if (frame.command === 'MESSAGE') {
          const dest = frame.headers.destination || '';
          if (dest === '/user/queue/errors') {
            stompErrorRate.add(1);
            continue;
          }
          if (dest.startsWith('/topic/room/')) {
            stompEventsReceived.add(1);
            stompErrorRate.add(0);
            const now = Date.now();
            try {
              const event = JSON.parse(frame.body);
              if (typeof event.timestampEpoch === 'number') {
                stompBroadcastLatencyMs.add(Math.max(0, now - event.timestampEpoch));
              }
              if (event.userId === guestId && event.type === 'PLAYER_MOVED' && lastMoveSentAt > 0) {
                stompMoveRttMs.add(Math.max(0, now - lastMoveSentAt));
              }
              if (event.userId === guestId && event.type === 'ROOM_CHAT' && lastChatSentAt > 0) {
                stompChatRttMs.add(Math.max(0, now - lastChatSentAt));
              }
            } catch {
              stompErrorRate.add(1);
            }
          }
        } else if (frame.command === 'ERROR') {
          stompErrorRate.add(1);
        }
      }
    });

    socket.on('error', () => {
      stompErrorRate.add(1);
    });

    socket.setTimeout(() => {
      socket.send(buildStompFrame('DISCONNECT', { receipt: `bye-${vuId}` }));
      socket.close();
    }, WS_CONN_DURATION_MS);
  });

  check(wsRes, {
    'websocket handshake status is 101': (r) => r && r.status === 101,
  });
}
