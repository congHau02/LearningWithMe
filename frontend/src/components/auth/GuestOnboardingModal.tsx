import { useRef, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { ServerWakeUpNotice } from "../hud/ServerWakeUpNotice";
import type { BackendConnectionStatus } from "../hud/TopBar";
import { BrandLogo } from "../brand/BrandLogo";
import { DoubleBezelCard } from "../ui/DoubleBezelCard";
import { GuestOnboardingForm } from "./GuestOnboardingForm";
import {
  OnboardingEntryTabs,
  type OnboardingEntryTab,
} from "./OnboardingEntryTabs";
import { RegisteredLoginPanel } from "./RegisteredLoginPanel";

export interface GuestOnboardingModalProps {
  backendStatus?: BackendConnectionStatus;
  showColdStartNotice?: boolean;
  coldStartElapsedSeconds?: number;
  onRetryBackendHealth?: () => void;
}

export function GuestOnboardingModal({
  backendStatus = "UP",
  showColdStartNotice = false,
  coldStartElapsedSeconds = 0,
  onRetryBackendHealth,
}: GuestOnboardingModalProps) {
  const [activeTab, setActiveTab] = useState<OnboardingEntryTab>("GUEST");
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  const isBackendWaiting = showColdStartNotice && backendStatus !== "UP";
  useFocusTrap(dialogContainerRef);

  return (
    <div
      ref={dialogContainerRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:items-center sm:p-4"
    >
      <DoubleBezelCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-onboarding-title"
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto"
        innerClassName="p-4 sm:p-5"
      >
        {isBackendWaiting ? (
          <ServerWakeUpNotice
            variant="card"
            elapsedSeconds={coldStartElapsedSeconds}
            onRetry={onRetryBackendHealth}
          />
        ) : null}

        <OnboardingEntryTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex items-start gap-3.5">
          <BrandLogo
            variant="modal"
            alt="Logo Learning With Me"
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Learning With Me
              </span>
              <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {activeTab === "GUEST"
                  ? "Guest Mode • Vào phòng không cần đăng ký"
                  : "Registered Mode • Khôi phục hồ sơ & giờ học"}
              </span>
            </div>
            <h2
              id="guest-onboarding-title"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              {activeTab === "GUEST"
                ? "Thiết lập nhân vật học tập"
                : "Đăng nhập tài khoản"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeTab === "GUEST"
                ? "Chọn ngoại hình, tên hiển thị và mục tiêu hôm nay để vào ngay thư viện 2D. Phiên Guest được lưu 7 ngày trên trình duyệt."
                : "Đăng nhập bằng tài khoản đã đăng ký để khôi phục nhân vật, vật phẩm mở khóa và tổng số phút học."}
            </p>
          </div>
        </div>

        <div
          role="tabpanel"
          id="entry-panel-guest"
          aria-labelledby="entry-tab-guest"
          hidden={activeTab !== "GUEST"}
          className={activeTab === "GUEST" ? "block" : "hidden"}
        >
          <GuestOnboardingForm isBackendWaiting={isBackendWaiting} />
        </div>

        {activeTab === "LOGIN" ? (
          <div
            role="tabpanel"
            id="entry-panel-login"
            aria-labelledby="entry-tab-login"
          >
            <RegisteredLoginPanel isBackendWaiting={isBackendWaiting} />
          </div>
        ) : null}
      </DoubleBezelCard>
    </div>
  );
}
