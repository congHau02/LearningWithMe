import { useEffect, useState } from 'react';
import type { UpgradeAccountResponse } from '../../services/authApi';
import { GoogleUpgradePanel } from './GoogleUpgradePanel';
import { LocalUpgradeForm } from './LocalUpgradeForm';

export interface AccountUpgradeModalProps {
  onClose: () => void;
  onUpgraded: (response: UpgradeAccountResponse) => void;
}

type UpgradeTab = 'LOCAL' | 'GOOGLE';

export function AccountUpgradeModal({
  onClose,
  onUpgraded,
}: AccountUpgradeModalProps) {
  const [activeTab, setActiveTab] = useState<UpgradeTab>('LOCAL');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-upgrade-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Không gián đoạn phiên học
            </span>
            <h2
              id="account-upgrade-title"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              Nâng cấp tài khoản
            </h2>
            <p className="text-sm text-muted-foreground">
              Lưu vĩnh viễn thời gian học đã tích lũy mà vẫn giữ nguyên chỗ ngồi hiện tại.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Đóng
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Phương thức nâng cấp tài khoản"
          className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background/70 p-1"
        >
          <button
            type="button"
            role="tab"
            id="upgrade-tab-local"
            aria-selected={activeTab === 'LOCAL'}
            aria-controls="upgrade-panel-local"
            onClick={() => setActiveTab('LOCAL')}
            className={`min-h-9 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'LOCAL'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Dùng Email & Mật khẩu
          </button>
          <button
            type="button"
            role="tab"
            id="upgrade-tab-google"
            aria-selected={activeTab === 'GOOGLE'}
            aria-controls="upgrade-panel-google"
            onClick={() => setActiveTab('GOOGLE')}
            className={`min-h-9 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'GOOGLE'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Google
          </button>
        </div>

        <div
          role="tabpanel"
          id={activeTab === 'LOCAL' ? 'upgrade-panel-local' : 'upgrade-panel-google'}
          aria-labelledby={activeTab === 'LOCAL' ? 'upgrade-tab-local' : 'upgrade-tab-google'}
          className="mt-5"
        >
          {activeTab === 'LOCAL' ? (
            <LocalUpgradeForm onSuccess={onUpgraded} />
          ) : (
            <GoogleUpgradePanel onSuccess={onUpgraded} />
          )}
        </div>
      </div>
    </div>
  );
}
