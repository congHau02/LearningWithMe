import type { PermissionAction, QuickCheckSignalState, TableMemberDto } from '../../services/tableApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { SpeakingEqualizer } from './SpeakingEqualizer';
import { TableMemberRow } from './TableMemberRow';
import { VoiceErrorBanner } from './VoiceErrorBanner';

export interface TableMembersPanelProps {
  members: TableMemberDto[];
  selfUserId: string | null;
  isSelfHost: boolean;
  quickCheckSignals?: Record<string, QuickCheckSignalState>;
  onAction: (action: PermissionAction, targetUserId: string) => void;
}

export function TableMembersPanel({
  members,
  selfUserId,
  isSelfHost,
  quickCheckSignals = {},
  onAction,
}: TableMembersPanelProps) {
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isJoining = useVoiceStore((s) => s.isJoining);
  const isSelfMuted = useVoiceStore((s) => s.isMuted);
  const isSelfSpeaking = useVoiceStore((s) => s.isSelfSpeaking);
  const voicePeers = useVoiceStore((s) => s.peers);
  const selfHatId = useAuthStore((s) => s.hatId);
  const selfDeskPetId = useAuthStore((s) => s.deskPetId);
  const remotePlayers = useGameStore((s) => s.remotePlayers);

  const voiceBadge = inVoice
    ? {
        label: 'Voice bàn học',
        dotCls: 'bg-emerald-400',
        pillCls: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
      }
    : isJoining
      ? {
          label: 'Đang kết nối thoại',
          dotCls: 'bg-amber-400 animate-pulse',
          pillCls: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
        }
      : {
          label: 'Chờ kết nối thoại',
          dotCls: 'bg-muted-foreground/60',
          pillCls: 'border-border bg-secondary/70 text-muted-foreground',
        };

  return (
    <aside
      data-testid="table-members-panel"
      aria-label="Thành viên đang ngồi cùng bàn"
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Thành viên tại bàn ({members.length})
        </h3>
        <div className="flex items-center gap-1.5" data-testid="table-voice-status">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold ${voiceBadge.pillCls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${voiceBadge.dotCls}`} aria-hidden="true" />
            <span>{voiceBadge.label}</span>
          </span>
          <SpeakingEqualizer
            testId="self-speaking-indicator"
            speaking={inVoice && isSelfSpeaking && !isSelfMuted}
            micLive={inVoice && !isSelfMuted}
            label="Bạn đang nói"
          />
        </div>
      </div>

      <VoiceErrorBanner />

      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Đang đồng bộ danh sách thành viên...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const isSelf = member.userId === selfUserId;
            return (
              <TableMemberRow
                key={member.userId}
                member={member}
                isSelf={isSelf}
                isSelfHost={isSelfHost}
                hatId={member.hatId ?? (isSelf ? selfHatId : remotePlayers[member.userId]?.hatId)}
                deskPetId={member.deskPetId ?? (isSelf ? selfDeskPetId : remotePlayers[member.userId]?.deskPetId)}
                inVoice={inVoice}
                isSelfMuted={isSelfMuted}
                isSelfSpeaking={isSelfSpeaking}
                peerVoice={voicePeers[member.userId]}
                quickCheck={quickCheckSignals[member.userId] ?? null}
                onAction={onAction}
              />
            );
          })}
        </ul>
      )}
    </aside>
  );
}
