import { useCallback } from 'react';
import { MAX_SCRATCHPAD_LENGTH } from '../../hooks/useMathScratchpad';
import { sendTableScratchpadUpdate } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import { FunctionGrapherCard } from './FunctionGrapherCard';
import { ScientificSolverCard } from './ScientificSolverCard';

interface MathGrapherSolverPanelProps {
  tableId: string;
  canControl: boolean;
  onSwitchToBoard: () => void;
}

export function MathGrapherSolverPanel({
  tableId,
  canControl,
  onSwitchToBoard,
}: MathGrapherSolverPanelProps) {
  const handleInsertToScratchpad = useCallback(
    (latexLine: string) => {
      if (!canControl || !latexLine.trim()) return;
      const current = useTableStore.getState().scratchpadState.content;
      const joined = current.trim() ? `${current}\n${latexLine}` : latexLine;
      sendTableScratchpadUpdate(tableId, joined.slice(0, MAX_SCRATCHPAD_LENGTH));
    },
    [canControl, tableId],
  );

  return (
    <div data-testid="math-grapher-solver-panel" className="flex flex-col gap-3">
      <FunctionGrapherCard
        tableId={tableId}
        canControl={canControl}
        onSwitchToBoard={onSwitchToBoard}
      />
      <ScientificSolverCard
        canControl={canControl}
        onInsertToScratchpad={handleInsertToScratchpad}
      />
    </div>
  );
}
