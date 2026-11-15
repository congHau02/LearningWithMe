import type { CharacterItem } from '../../services/customizationApi';

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
      className={`flex flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            Đang chọn
          </span>
        ) : item.equipped ? (
          <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
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
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-300">
            🔒 Cần thêm {item.remainingMinutes} phút
          </span>
        ) : (
          <span className="font-medium text-emerald-400">✓ Đã mở khóa</span>
        )}
      </div>
    </button>
  );
}
