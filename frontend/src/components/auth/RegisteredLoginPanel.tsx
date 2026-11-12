import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatApiError } from '../../services/apiClient';
import { loginRegisteredUser } from '../../services/authApi';
import { requestGoogleIdTokenPopup } from '../../services/googleIdentityPopup';
import { useAuthStore } from '../../stores/useAuthStore';
import { GoogleLogoMark } from './GoogleLogoMark';
import { localLoginResolver, type LocalLoginFormValues } from './loginSchema';

export function RegisteredLoginPanel() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const fallbackButtonRef = useRef<HTMLDivElement | null>(null);
  const setSession = useAuthStore((s) => s.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LocalLoginFormValues>({
    resolver: localLoginResolver,
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const applyLoginSession = (response: Awaited<ReturnType<typeof loginRegisteredUser>>) => {
    setSession({
      userId: response.userId,
      nickname: response.nickname,
      avatarSpriteId: response.avatarId,
      studyGoal: response.studyGoal,
      authProvider: response.authProvider,
      email: response.email,
      totalStudyMinutes: response.totalStudyMinutes,
      token: response.accessToken,
    });
  };

  const onSubmit = async (values: LocalLoginFormValues) => {
    setSubmitError(null);
    try {
      const response = await loginRegisteredUser({
        provider: 'LOCAL',
        email: values.email,
        password: values.password,
      });
      applyLoginSession(response);
    } catch (error) {
      setSubmitError(
        formatApiError(error, 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'),
      );
    }
  };

  const submitGoogleToken = async (googleIdToken: string) => {
    setSubmitError(null);
    setIsGoogleLoading(true);
    try {
      const response = await loginRegisteredUser({
        provider: 'GOOGLE',
        googleIdToken,
      });
      applyLoginSession(response);
    } catch (error) {
      setSubmitError(
        formatApiError(error, 'Không thể đăng nhập bằng Google. Vui lòng thử lại.'),
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitError(null);
    setIsGoogleLoading(true);
    try {
      const idToken = await requestGoogleIdTokenPopup({
        fallbackButtonContainer: fallbackButtonRef.current,
        onCredential: (credential) => {
          void submitGoogleToken(credential);
        },
      });
      await submitGoogleToken(idToken);
    } catch (error) {
      setSubmitError(
        formatApiError(error, 'Không thể mở hộp thoại đăng nhập Google.', true),
      );
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="mt-5 space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
            Email <span className="text-destructive">*</span>
          </label>
          <input
            id="login-email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="banhoc@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.email ? (
            <p id="login-email-error" role="alert" className="text-xs font-medium text-rose-400">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
            Mật khẩu <span className="text-destructive">*</span>
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu của bạn"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password')}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.password ? (
            <p id="login-password-error" role="alert" className="text-xs font-medium text-rose-400">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        {submitError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-rose-300"
          >
            {submitError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleLoading}
          className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-border" />
        <span className="mx-3 text-[11px] uppercase tracking-wider text-muted-foreground">hoặc</span>
        <div className="flex-grow border-t border-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isSubmitting || isGoogleLoading}
        className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GoogleLogoMark />
        {isGoogleLoading ? 'Đang xác thực với Google...' : 'Đăng nhập với Google'}
      </button>

      <div
        ref={fallbackButtonRef}
        className="flex justify-center empty:hidden"
        aria-label="Nút dự phòng Google Login"
      />
    </div>
  );
}
