import { VIRTUAL_DRINKS } from '../../game/cafe/studyCafeConfig';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useGameStore } from '../../stores/useGameStore';
import { XIcon } from '../icons';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';

export function VirtualDrinkMenuModal() {
  const isOpen = useGameStore((s) => s.isDrinkMenuOpen);
  const selectedDrinkId = useGameStore((s) => s.selectedDrinkId);
  const pendingDrinkOrder = useGameStore((s) => s.pendingDrinkOrder);
  const activeDrinkId = selectedDrinkId ?? pendingDrinkOrder?.drinkId ?? null;
  const activeCafeNpcName = useGameStore((s) => s.activeCafeNpcName);
  const closeDrinkMenu = useGameStore((s) => s.closeDrinkMenu);
  const selectVirtualDrink = useGameStore((s) => s.selectVirtualDrink);

  useEscapeToClose(() => {
    if (isOpen) closeDrinkMenu();
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F1714]/80 p-3 backdrop-blur-md sm:items-center sm:p-4"
      onClick={closeDrinkMenu}
    >
      <DoubleBezelCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="drink-menu-title"
        data-testid="virtual-drink-menu-modal"
        onClick={(e) => e.stopPropagation()}
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto"
        innerClassName="p-5"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Study Café • {activeCafeNpcName || 'Quầy pha chế'}
            </p>
            <h2 id="drink-menu-title" className="mt-0.5 text-base font-bold tracking-tight text-foreground">
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
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary/80 sm:min-h-9"
          >
            <XIcon className="h-3.5 w-3.5" />
            <span>Đóng</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {VIRTUAL_DRINKS.map((drink) => {
            const isSelected = activeDrinkId === drink.id;
            return (
              <button
                key={drink.id}
                type="button"
                data-testid={`drink-option-${drink.id}`}
                onClick={() => selectVirtualDrink(drink.id)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'border-primary bg-primary/15 shadow-sm ring-1 ring-primary/40'
                    : 'border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/80'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-[#0F1714]/90 text-2xl shadow-inner">
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
          {activeDrinkId ? (
            <button
              type="button"
              data-testid="clear-drink-btn"
              onClick={() => selectVirtualDrink(null)}
              className="min-h-11 rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary/80 hover:text-foreground sm:min-h-9"
            >
              Bỏ ly xuống
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Miễn phí 100% tại Study Café</span>
          )}
          <button
            type="button"
            onClick={closeDrinkMenu}
            className="min-h-11 rounded-xl border border-primary/40 bg-primary px-5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-105 active:brightness-95 sm:min-h-9"
          >
            Xong
          </button>
        </div>
      </DoubleBezelCard>
    </div>
  );
}
