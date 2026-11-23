import { useRef, useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { UpgradeAccountResponse } from '../../services/authApi';
import { XIcon } from '../icons';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';
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
  const dialogContainerRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(onClose);
  useFocusTrap(dialogContainerRef);

  return (
    <div ref={dialogContainerRef} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <DoubleBezelCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-upgrade-title"
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto"
        innerClassName="p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
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
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
          >
            <XIcon className="h-3.5 w-3.5" />
            <span>Đóng</span>
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Phương thức nâng cấp tài khoản"
          className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/60 p-1"
        >
          <button
            type="button"
            role="tab"
            id="upgrade-tab-local"
            aria-selected={activeTab === 'LOCAL'}
            aria-controls="upgrade-panel-local"
            onClick={() => setActiveTab('LOCAL')}
            className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9 ${
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
            className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9 ${
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
      </DoubleBezelCard>
    </div>
  );
}
