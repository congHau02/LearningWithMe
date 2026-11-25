import type { PermissionAction, PermissionRequestNotification, QuickCheckAction, QuickCheckSignalState, TableMemberDto } from '../../services/tableApi';
import { HomeworkDeckPanel } from './HomeworkDeckPanel';
import { HostPermissionToast } from './HostPermissionToast';
import { QuickCheckBar } from './QuickCheckBar';
import { SosBannerControl } from './SosBannerControl';
import { TableChatPanel } from './TableChatPanel';
import { TableMembersPanel } from './TableMembersPanel';
import { WorkspacePrimaryPanels } from './WorkspacePrimaryPanels';

export interface TableWorkspaceBodyProps {
  activeTableId: string;
  isClearView: boolean;
  isHost: boolean;
  canControl: boolean;
  selfUserId: string | null;
  sosBanner: string | null;
  members: TableMemberDto[];
  quickCheckSignals?: Record<string, QuickCheckSignalState>;
  permissionToast: string | null;
  pendingPermissionRequests: PermissionRequestNotification[];
  onRespondPermissionRequest: (requesterUserId: string, action: 'GRANT' | 'DENY') => void;
  onPermissionAction: (action: PermissionAction, targetUserId?: string) => void;
  onQuickCheck?: (action: QuickCheckAction) => void;
}

/** Inner scrollable workspace layout switching between Clear View and full study panels. */
export function TableWorkspaceBody({
  activeTableId,
  isClearView,
  isHost,
  canControl,
  selfUserId,
  sosBanner,
  members,
  quickCheckSignals = {},
  permissionToast,
  pendingPermissionRequests,
  onRespondPermissionRequest,
  onPermissionAction,
  onQuickCheck,
}: TableWorkspaceBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
      {onQuickCheck ? (
        <QuickCheckBar
          signals={quickCheckSignals}
          selfUserId={selfUserId}
          isHost={isHost}
          onQuickCheck={onQuickCheck}
        />
      ) : null}

      {permissionToast ? (
        <div
          role="status"
          data-testid="table-permission-toast"
          className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-xl border border-primary/50 bg-card/95 px-3.5 py-2 text-xs font-medium text-primary shadow-xl"
        >
          {permissionToast}
        </div>
      ) : null}

      {isHost ? (
        <HostPermissionToast
          requests={pendingPermissionRequests}
          onRespond={onRespondPermissionRequest}
        />
      ) : null}

      {isClearView ? (
        <div
          data-testid="clear-view-layout"
          className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4"
        >
          <div
            data-testid="clear-view-board-pane"
            className="flex min-h-0 flex-[3_1_0%] flex-col overflow-y-auto lg:col-span-2"
          >
            <HomeworkDeckPanel tableId={activeTableId} canControl={canControl} clearView={true} />
          </div>
          <div
            data-testid="clear-view-chat-pane"
            className="flex min-h-[15rem] flex-[2_1_0%] flex-col overflow-hidden lg:col-span-1 lg:min-h-0"
          >
            <TableChatPanel tableId={activeTableId} fillHeight clearView={true} />
          </div>
        </div>
      ) : (
        <>
          <SosBannerControl
            tableId={activeTableId}
            sosBanner={sosBanner}
            canControl={canControl}
          />
          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <WorkspacePrimaryPanels activeTableId={activeTableId} canControl={canControl} />

            <div className="flex flex-col gap-4">
              <TableMembersPanel
                members={members}
                selfUserId={selfUserId}
                isSelfHost={isHost}
                quickCheckSignals={quickCheckSignals}
                onAction={(action, targetUserId) => onPermissionAction(action, targetUserId)}
              />
              <TableChatPanel tableId={activeTableId} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
