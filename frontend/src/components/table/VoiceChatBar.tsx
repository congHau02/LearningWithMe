import type { TableMemberDto } from '../../services/tableApi';
import { useVoiceStore, type VoicePeerConnectionState } from '../../stores/useVoiceStore';
import { getMicControlMeta, SpeakingEqualizer } from './SpeakingEqualizer';

export interface VoiceChatBarProps {
  members: TableMemberDto[];
  selfUserId: string | null;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
}

const CONNECTION_BADGES: Record<VoicePeerConnectionState, { label: string; cls: string }> = {
  ready: { label: 'Sẵn sàng', cls: 'border-slate-600 bg-slate-800 text-slate-300' },
  connecting: { label: 'Đang kết nối', cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300' },
  connected: { label: 'Đã kết nối', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' },
  disconnected: { label: 'Mất kết nối', cls: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
  failed: { label: 'Lỗi kết nối', cls: 'border-rose-500/50 bg-rose-500/20 text-rose-200' },
};

export function VoiceChatBar({
  members,
  selfUserId,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
}: VoiceChatBarProps) {
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isJoining = useVoiceStore((s) => s.isJoining);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isSelfSpeaking = useVoiceStore((s) => s.isSelfSpeaking);
  const voiceError = useVoiceStore((s) => s.voiceError);
  const peers = useVoiceStore((s) => s.peers);
  const setVoiceError = useVoiceStore((s) => s.setVoiceError);

  const remoteMembers = members.filter((m) => m.userId !== selfUserId);
  const activeCount = Object.keys(peers).length + (inVoice ? 1 : 0);
  const micMeta = getMicControlMeta(isMuted);

  return (
    <section
      data-testid="voice-chat-bar"
      aria-label="Điều khiển kênh thoại bàn học"
      className="flex flex-col gap-2 rounded-xl border border-border bg-card/80 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Voice Chat P2P
          </span>
          <span
            data-testid="voice-participant-count"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300"
          >
            {activeCount} đang bật thoại
          </span>
          <SpeakingEqualizer
            testId="self-speaking-indicator"
            speaking={inVoice && isSelfSpeaking && !isMuted}
            micLive={inVoice && !isMuted}
            label="Bạn đang nói"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          {!inVoice ? (
            <button
              type="button"
              data-testid="voice-join-btn"
              disabled={isJoining}
              onClick={onJoinVoice}
              className="min-h-[44px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-200 transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[36px]"
            >
              {isJoining ? 'Đang bật mic...' : 'Tham gia Voice'}
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="voice-mute-btn"
                aria-pressed={micMeta.ariaPressed}
                aria-label={micMeta.ariaLabel}
                onClick={onToggleMute}
                className={`min-h-[44px] min-w-[8.25rem] rounded-lg border px-3 py-1.5 text-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:min-h-[36px] ${micMeta.toneClass}`}
              >
                {micMeta.label}
              </button>
              <button
                type="button"
                data-testid="voice-leave-btn"
                onClick={onLeaveVoice}
                className="min-h-[44px] rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 font-semibold text-rose-200 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:min-h-[36px]"
              >
                Rời kênh thoại
              </button>
            </>
          )}
        </div>
      </div>

      {voiceError ? (
        <div
          role="alert"
          data-testid="voice-error-banner"
          className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-200"
        >
          <span>{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            aria-label="Đóng thông báo lỗi micro"
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold hover:bg-rose-500/20"
          >
            Đóng
          </button>
        </div>
      ) : null}

      {remoteMembers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1" data-testid="voice-peer-status-list">
          {remoteMembers.map((member) => {
            const peer = peers[member.userId];
            const badge = peer
              ? CONNECTION_BADGES[peer.connectionState]
              : { label: 'Chưa vào Voice', cls: 'border-slate-700 bg-slate-900 text-slate-400' };
            return (
              <span
                key={member.userId}
                data-testid={`voice-peer-status-${member.userId}`}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
              >
                <span>{member.nickname}:</span>
                <span>{badge.label}</span>
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
