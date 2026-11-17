import type { PermissionAction, TableMemberDto } from '../../services/tableApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
import { CrownIcon, ZapIcon } from '../icons';
import { SpeakingEqualizer } from './SpeakingEqualizer';

export interface TableMembersPanelProps {
  members: TableMemberDto[];
  selfUserId: string | null;
  isSelfHost: boolean;
  onAction: (action: PermissionAction, targetUserId: string) => void;
}

const ROLE_BADGES = {
  TABLE_HOST: { label: 'Trưởng bàn', cls: 'border border-[#E5A93C] bg-[#E5A93C] text-[#0F1714] font-bold shadow-sm' },
  CO_HOST: { label: 'Co-Host', cls: 'border border-[#E5A93C] bg-[#E5A93C] text-[#0F1714] font-bold shadow-sm' },
  MEMBER: { label: 'Thành viên', cls: 'border border-border bg-card text-muted-foreground' },
} as const;

export function TableMembersPanel({
  members,
  selfUserId,
  isSelfHost,
  onAction,
}: TableMembersPanelProps) {
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isSelfMuted = useVoiceStore((s) => s.isMuted);
  const isSelfSpeaking = useVoiceStore((s) => s.isSelfSpeaking);
  const voicePeers = useVoiceStore((s) => s.peers);
  const selfHatId = useAuthStore((s) => s.hatId);
  const selfDeskPetId = useAuthStore((s) => s.deskPetId);
  const remotePlayers = useGameStore((s) => s.remotePlayers);

  return (
    <aside
      data-testid="table-members-panel"
      aria-label="Thành viên đang ngồi cùng bàn"
      className="flex flex-col gap-2 rounded-xl border border-border bg-card/80 p-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Thành viên tại bàn ({members.length})
        </h3>
      </div>

      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Đang đồng bộ danh sách thành viên...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const badge = ROLE_BADGES[member.tableRole];
            const isSelf = member.userId === selfUserId;
            const peerVoice = voicePeers[member.userId];
            const memberInVoice = isSelf ? inVoice : Boolean(peerVoice);
            const memberMuted = isSelf ? isSelfMuted : Boolean(peerVoice?.muted);
            const memberSpeaking = isSelf ? isSelfSpeaking && !isSelfMuted : Boolean(peerVoice?.speaking && !peerVoice.muted);
            return (
              <li
                key={member.userId}
                data-testid={`table-member-${member.userId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-[#0F1714]/60 px-2.5 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <StarterAvatarPortrait
                    avatarId={member.avatarId}
                    hatId={member.hatId ?? (isSelf ? selfHatId : remotePlayers[member.userId]?.hatId)}
                    deskPetId={member.deskPetId ?? (isSelf ? selfDeskPetId : remotePlayers[member.userId]?.deskPetId)}
                    size={24}
                  />
                  <div>
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      <span>{member.nickname}</span>
                      {isSelf ? <span className="text-muted-foreground">(Bạn)</span> : null}
                      <SpeakingEqualizer
                        testId={`speaking-indicator-${member.userId}`}
                        speaking={memberSpeaking}
                        micLive={memberInVoice && !memberMuted}
                        label={`${member.nickname} đang nói`}
                      />
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {member.seatId} {!member.connected ? '• Grace' : ''}
                    </p>
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
                  {memberInVoice ? (
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
                  ) : null}
                  <span
                    data-testid={`member-role-${member.userId}`}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                  >
                    {member.tableRole === 'TABLE_HOST' ? (
                      <CrownIcon className="h-3 w-3 text-[#0F1714]" aria-hidden="true" />
                    ) : member.tableRole === 'CO_HOST' ? (
                      <ZapIcon className="h-3 w-3 text-[#0F1714]" aria-hidden="true" />
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
          })}
        </ul>
      )}
    </aside>
  );
}
