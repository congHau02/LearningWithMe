import type { CharacterItem } from '../../services/customizationApi';
import { CheckIcon, LockIcon } from '../icons';

export interface CharacterCustomizerItemCardProps {
  item: CharacterItem;
  selected: boolean;
  onSelect: (itemId: string) => void;
}

export function CharacterCustomizerItemCard({
  item,
  selected,
  onSelect,
}: CharacterCustomizerItemCardProps) {
  const locked = !item.unlocked;

  return (
    <button
      type="button"
      data-testid={`customizer-item-${item.id}`}
      disabled={locked}
      onClick={() => {
        if (!locked) {
          onSelect(item.id);
        }
      }}
      className={`flex min-h-16 flex-col items-start justify-between gap-2 rounded-xl border p-3.5 text-left transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        locked
          ? 'cursor-not-allowed border-border/60 bg-secondary/25 opacity-65'
          : selected
            ? 'border-primary bg-primary/15 shadow-sm ring-1 ring-primary/40'
            : 'border-border bg-secondary/50 hover:bg-secondary/80'
      }`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {item.itemName}
        </span>
        {selected ? (
          <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            Đang chọn
          </span>
        ) : item.equipped ? (
          <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
            Đang mặc
          </span>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-between gap-2 text-xs">
        <span className="font-mono text-muted-foreground">
          {item.requiredStudyMinutes === 0
            ? 'Miễn phí (0 phút)'
            : `Mở khóa: ${item.requiredStudyMinutes} phút`}
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-medium text-primary">
            <LockIcon className="h-3 w-3 shrink-0" />
            <span>Cần thêm {item.remainingMinutes} phút</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
            <CheckIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Đã mở khóa</span>
          </span>
        )}
      </div>
    </button>
  );
}
