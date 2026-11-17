import { useState, type DragEvent } from 'react';
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout';
import { HomeworkDeckPanel } from './HomeworkDeckPanel';
import { PanelDragHandle } from './PanelDragHandle';
import { SyncedYouTubePlayer } from './SyncedYouTubePlayer';
import { WorkspaceLayoutControls } from './WorkspaceLayoutControls';

type WorkspacePanelId = 'youtube' | 'homework';

interface WorkspacePrimaryPanelsProps {
  activeTableId: string;
  canControl: boolean;
}

/** Primary study area hosting layout controls and reorderable Video / Homework panels. */
export function WorkspacePrimaryPanels({ activeTableId, canControl }: WorkspacePrimaryPanelsProps) {
  const { layoutMode, isHomeworkFirst, setLayoutMode, swapPanels } = useWorkspaceLayout();
  const [draggedPanel, setDraggedPanel] = useState<WorkspacePanelId | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<WorkspacePanelId | null>(null);

  const endPanelDrag = () => {
    setDraggedPanel(null);
    setDragOverPanel(null);
  };

  const makeDragHandle = (panel: WorkspacePanelId, testId: string, label: string) => (
    <PanelDragHandle
      testId={testId}
      label={label}
      onDragStart={(e: DragEvent<HTMLSpanElement>) => {
        setDraggedPanel(panel);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', panel);
        }
      }}
      onDragEnd={endPanelDrag}
    />
  );

  const getSlotHandlers = (target: WorkspacePanelId, orderClass: string) => ({
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      if (draggedPanel && draggedPanel !== target) {
        e.preventDefault();
        setDragOverPanel(target);
      }
    },
    onDragLeave: () => {
      if (dragOverPanel === target) setDragOverPanel(null);
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (draggedPanel && draggedPanel !== target) {
        swapPanels();
      }
      endPanelDrag();
    },
    className: `${orderClass} min-w-0 rounded-xl transition ${
      dragOverPanel === target ? 'ring-2 ring-sky-400/70' : ''
    }`,
  });

  return (
    <div className="flex flex-col gap-3 lg:col-span-2">
      <WorkspaceLayoutControls
        layoutMode={layoutMode}
        onChangeLayout={setLayoutMode}
        onSwapPanels={swapPanels}
      />

      <div
        data-testid="workspace-primary-panels"
        className={
          layoutMode === 'SPLIT_HORIZONTAL'
            ? 'grid grid-cols-1 gap-4 lg:grid-cols-2'
            : 'grid grid-cols-1 gap-4'
        }
      >
        <div
          data-testid="youtube-panel-slot"
          {...getSlotHandlers('youtube', isHomeworkFirst ? 'order-2' : 'order-1')}
        >
          <SyncedYouTubePlayer
            tableId={activeTableId}
            canControl={canControl}
            dragHandle={makeDragHandle(
              'youtube',
              'youtube-drag-handle',
              'Kéo bảng YouTube để đổi vị trí',
            )}
          />
        </div>

        <div
          data-testid="homework-panel-slot"
          {...getSlotHandlers('homework', isHomeworkFirst ? 'order-1' : 'order-2')}
        >
          <HomeworkDeckPanel
            tableId={activeTableId}
            canControl={canControl}
            dragHandle={makeDragHandle(
              'homework',
              'homework-drag-handle',
              'Kéo bảng bài tập để đổi vị trí',
            )}
          />
        </div>
      </div>
    </div>
  );
}
