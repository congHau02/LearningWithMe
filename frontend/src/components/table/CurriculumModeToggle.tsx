import { useCurriculumModeStore } from '../../stores/useCurriculumModeStore';
import type { CurriculumMode } from '../../utils/mathLatex';

const OPTIONS: readonly { id: CurriculumMode; label: string; testId: string; title: string }[] = [
  { id: 'THCS', label: 'Toán THCS', testId: 'curriculum-mode-thcs', title: 'Chế độ Toán THCS (Cấp 2: Lớp 6–9)' },
  { id: 'THPT', label: 'THPT / Đại học', testId: 'curriculum-mode-thpt', title: 'Mở rộng Đạo hàm, Tích phân & Hệ 3×3' },
];

export function CurriculumModeToggle() {
  const mode = useCurriculumModeStore((s) => s.curriculumMode);
  const setMode = useCurriculumModeStore((s) => s.setCurriculumMode);

  return (
    <div
      role="group"
      aria-label="Chế độ cấp học Toán"
      data-testid="curriculum-mode-toggle"
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            data-testid={opt.testId}
            aria-pressed={active}
            title={opt.title}
            onClick={() => setMode(opt.id)}
            className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-md border px-2.5 py-1 text-[11px] transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[32px] ${
              active
                ? 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                : 'border-transparent bg-transparent font-medium text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
