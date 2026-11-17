import { VIRTUAL_DRINKS } from '../../game/cafe/studyCafeConfig';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useGameStore } from '../../stores/useGameStore';

export function VirtualDrinkMenuModal() {
  const isOpen = useGameStore((s) => s.isDrinkMenuOpen);
  const selectedDrinkId = useGameStore((s) => s.selectedDrinkId);
  const activeCafeNpcName = useGameStore((s) => s.activeCafeNpcName);
  const closeDrinkMenu = useGameStore((s) => s.closeDrinkMenu);
  const selectVirtualDrink = useGameStore((s) => s.selectVirtualDrink);

  useEscapeToClose(() => {
    if (isOpen) closeDrinkMenu();
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/75 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={closeDrinkMenu}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drink-menu-title"
        data-testid="virtual-drink-menu-modal"
        onClick={(e) => e.stopPropagation()}
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-500/30 bg-card p-5 text-card-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              Study Café • {activeCafeNpcName || 'Quầy pha chế'}
            </p>
            <h2 id="drink-menu-title" className="mt-0.5 text-base font-bold tracking-tight">
              Chọn đồ uống đồng hành
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Biểu tượng ly nước sẽ gắn cạnh tên nhân vật của bạn trên bản đồ.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrinkMenu}
            aria-label="Đóng menu đồ uống"
            className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Đóng
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {VIRTUAL_DRINKS.map((drink) => {
            const isSelected = selectedDrinkId === drink.id;
            return (
              <button
                key={drink.id}
                type="button"
                data-testid={`drink-option-${drink.id}`}
                onClick={() => selectVirtualDrink(drink.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 shadow-sm'
                    : 'border-border bg-secondary/40 hover:border-amber-500/40 hover:bg-secondary/80'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900/80 text-xl">
                  {drink.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{drink.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{drink.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          {selectedDrinkId ? (
            <button
              type="button"
              data-testid="clear-drink-btn"
              onClick={() => selectVirtualDrink(null)}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              Bỏ ly xuống
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Miễn phí 100% tại Study Café</span>
          )}
          <button
            type="button"
            onClick={closeDrinkMenu}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
