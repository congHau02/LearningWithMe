import { useRef, useState } from 'react';
import { formatApiError } from '../../services/apiClient';
import {
  upgradeAccountSession,
  type UpgradeAccountResponse,
} from '../../services/authApi';
import { requestGoogleIdTokenPopup } from '../../services/googleIdentityPopup';
import { GoogleLogoMark } from './GoogleLogoMark';

interface GoogleUpgradePanelProps {
  onSuccess: (response: UpgradeAccountResponse) => void;
}

export function GoogleUpgradePanel({ onSuccess }: GoogleUpgradePanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fallbackButtonRef = useRef<HTMLDivElement | null>(null);

  const submitGoogleToken = async (googleIdToken: string) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await upgradeAccountSession({
        provider: 'GOOGLE',
        googleIdToken,
      });
      onSuccess(response);
    } catch (error) {
      setErrorMessage(
        formatApiError(error, 'Không thể nâng cấp tài khoản Google. Vui lòng thử lại.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    let idToken: string;
    try {
      idToken = await requestGoogleIdTokenPopup({
        fallbackButtonContainer: fallbackButtonRef.current,
        onCredential: (credential) => {
          void submitGoogleToken(credential);
        },
      });
    } catch (error) {
      setErrorMessage(
        formatApiError(error, 'Không thể mở hộp thoại đăng nhập Google.', true),
      );
      setIsSubmitting(false);
      return;
    }

    await submitGoogleToken(idToken);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background/70 p-3.5 text-xs leading-relaxed text-muted-foreground">
        Đăng nhập bằng tài khoản Google qua cửa sổ bật lên an toàn. Trình duyệt giữ nguyên kết nối phòng học và chỗ ngồi hiện tại.
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-rose-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
        className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GoogleLogoMark />
        {isSubmitting ? 'Đang xác thực với Google...' : 'Tiếp tục với Google'}
      </button>

      <div
        ref={fallbackButtonRef}
        className="flex justify-center empty:hidden"
        aria-label="Nút dự phòng Google Sign-In"
      />
    </div>
  );
}
