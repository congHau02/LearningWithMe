import { useRef, useState } from 'react';
import { formatApiError } from '../../services/apiClient';
import {
  upgradeAccountSession,
  type UpgradeAccountResponse,
} from '../../services/authApi';
import { requestGoogleIdTokenPopup } from '../../services/googleIdentityPopup';

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

function GoogleLogoMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M3.5 7.4l3.2 2.4C7.6 7.5 9.6 6 12 6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4c-3.7 0-6.9 2.1-8.5 5z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.6c2.6 0 4.9-.9 6.5-2.4l-3-2.5c-.8.6-1.9 1-3.5 1-2.7 0-4.9-1.8-5.7-4.2l-3.2 2.5c1.6 3.3 5 5.6 8.9 5.6z"
      />
      <path
        fill="#4285F4"
        d="M21.5 13c0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.2-1 2.2-2 2.9l3 2.5c1.8-1.6 3-4.1 3-8z"
      />
    </svg>
  );
}
