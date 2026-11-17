export type OnboardingEntryTab = 'GUEST' | 'LOGIN';

interface OnboardingEntryTabsProps {
  activeTab: OnboardingEntryTab;
  onChange: (tab: OnboardingEntryTab) => void;
}

export function OnboardingEntryTabs({ activeTab, onChange }: OnboardingEntryTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Chế độ vào phòng học"
      className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-[#0F1714]/60 p-1"
    >
      <button
        type="button"
        role="tab"
        id="entry-tab-guest"
        aria-selected={activeTab === 'GUEST'}
        onClick={() => onChange('GUEST')}
        className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
          activeTab === 'GUEST'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Vào ngay (Khách)
      </button>
      <button
        type="button"
        role="tab"
        id="entry-tab-login"
        aria-selected={activeTab === 'LOGIN'}
        onClick={() => onChange('LOGIN')}
        className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
          activeTab === 'LOGIN'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Đăng nhập tài khoản
      </button>
    </div>
  );
}
