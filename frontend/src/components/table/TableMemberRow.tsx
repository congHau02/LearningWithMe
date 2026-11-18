import type { PermissionAction, TableMemberDto } from '../../services/tableApi';
import type { VoicePeerState } from '../../stores/useVoiceStore';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
import { CrownIcon, ZapIcon } from '../icons';
import { SpeakingEqualizer } from './SpeakingEqualizer';
import { VOICE_CONNECTION_BADGES } from './voiceControlMeta';

const ROLE_BADGES = {
  TABLE_HOST: { label: 'Trưởng bàn', cls: 'border border-[#E5A93C] bg-[#E5A93C] text-[#0F1714] font-bold shadow-sm' },
  CO_HOST: { label: 'Co-Host', cls: 'border border-[#E5A93C] bg-[#E5A93C] text-[#0F1714] font-bold shadow-sm' },
  MEMBER: { label: 'Thành viên', cls: 'border border-border bg-card text-muted-foreground' },
} as const;

export interface TableMemberRowProps {
  member: TableMemberDto;
  isSelf: boolean;
  isSelfHost: boolean;
  hatId?: string | null;
  deskPetId?: string | null;
  inVoice: boolean;
  isSelfMuted: boolean;
  isSelfSpeaking: boolean;
  peerVoice?: VoicePeerState;
  onAction: (action: PermissionAction, targetUserId: string) => void;
}

export function TableMemberRow({
  member,
  isSelf,
  isSelfHost,
  hatId,
  deskPetId,
  inVoice,
  isSelfMuted,
  isSelfSpeaking,
  peerVoice,
  onAction,
}: TableMemberRowProps) {
  const badge = ROLE_BADGES[member.tableRole];
  const memberMuted = isSelf ? isSelfMuted : (peerVoice?.muted ?? true);
  const memberSpeaking = isSelf
    ? inVoice && isSelfSpeaking && !isSelfMuted
    : Boolean(peerVoice?.speaking && !peerVoice.muted);
  const peerConnBadge = !isSelf ? VOICE_CONNECTION_BADGES[peerVoice?.connectionState ?? 'ready'] : null;

  return (
    <li
      data-testid={`table-member-${member.userId}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/75 bg-background/65 px-2.5 py-2 text-xs"
    >
      <div className="flex min-w-0 items-center gap-2">
        <StarterAvatarPortrait
          avatarId={member.avatarId}
          hatId={hatId ?? undefined}
          deskPetId={deskPetId ?? undefined}
          size={24}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="truncate">{member.nickname}</span>
            {isSelf ? <span className="text-muted-foreground">(Bạn)</span> : null}
            <SpeakingEqualizer
              testId={`speaking-indicator-${member.userId}`}
              speaking={memberSpeaking}
              micLive={!memberMuted}
              label={`${member.nickname} đang nói`}
            />
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {member.seatId} {!member.connected ? '• Grace' : ''}
            </span>
            {peerConnBadge ? (
              <span
                data-testid={`voice-peer-status-${member.userId}`}
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${peerConnBadge.cls}`}
              >
                {peerConnBadge.label}
              </span>
            ) : null}
          </div>
          {member.studyGoal?.trim() ? (
            <p
              data-testid={`member-goal-${member.userId}`}
              className={`mt-0.5 flex items-center gap-1 text-[11px] ${
                member.studyGoalCompleted ? 'font-medium text-emerald-300' : 'text-muted-foreground'
              }`}
            >
              {member.studyGoalCompleted ? (
                <span data-testid={`member-goal-completed-${member.userId}`}>✅</span>
              ) : null}
              <span className="truncate">{member.studyGoal.trim()}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          data-testid={`voice-mute-badge-${member.userId}`}
          className={`min-w-[4.25rem] rounded border px-1.5 py-0.5 text-center text-[10px] font-semibold ${
            memberMuted
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {memberMuted ? 'Mic tắt' : 'Mic bật'}
        </span>
        <span
          data-testid={`member-role-${member.userId}`}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
        >
          {member.tableRole === 'TABLE_HOST' ? (
            <CrownIcon className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
          ) : member.tableRole === 'CO_HOST' ? (
            <ZapIcon className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
          ) : null}
          <span>{badge.label}</span>
        </span>

        {isSelfHost && !isSelf ? (
          <>
            {member.tableRole === 'MEMBER' ? (
              <button
                type="button"
                data-testid={`grant-cohost-btn-${member.userId}`}
                onClick={() => onAction('GRANT', member.userId)}
                className="rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/25"
              >
                Cấp Co-Host
              </button>
            ) : null}
            {member.tableRole === 'CO_HOST' ? (
              <button
                type="button"
                data-testid={`revoke-cohost-btn-${member.userId}`}
                onClick={() => onAction('REVOKE', member.userId)}
                className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300 hover:bg-rose-500/25"
              >
                Thu hồi Co-Host
              </button>
            ) : null}
            <button
              type="button"
              data-testid={`transfer-host-btn-${member.userId}`}
              onClick={() => onAction('TRANSFER_HOST', member.userId)}
              className="rounded border border-primary/50 bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/30"
            >
              Chuyển Trưởng bàn
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
