import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatApiError } from '../../services/apiClient';
import {
  upgradeAccountSession,
  type UpgradeAccountResponse,
} from '../../services/authApi';
import {
  localUpgradeResolver,
  type LocalUpgradeFormValues,
} from './accountUpgradeSchema';
import { ExistingLocalMergeForm } from './ExistingLocalMergeForm';

interface LocalUpgradeFormProps {
  onSuccess: (response: UpgradeAccountResponse) => void;
}

export function LocalUpgradeForm({ onSuccess }: LocalUpgradeFormProps) {
  const [isExistingAccount, setIsExistingAccount] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {isExistingAccount
            ? 'Gộp phiên hiện tại vào tài khoản đã có'
            : 'Chưa có tài khoản? Tạo mới từ phiên Guest'}
        </span>
        <button
          type="button"
          onClick={() => setIsExistingAccount((prev) => !prev)}
          className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isExistingAccount
            ? 'Tạo tài khoản mới'
            : 'Đã có tài khoản? Đăng nhập & gộp'}
        </button>
      </div>

      {isExistingAccount ? (
        <ExistingLocalMergeForm onSuccess={onSuccess} />
      ) : (
        <NewLocalUpgradeForm onSuccess={onSuccess} />
      )}
    </div>
  );
}

function NewLocalUpgradeForm({ onSuccess }: LocalUpgradeFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LocalUpgradeFormValues>({
    resolver: localUpgradeResolver,
    mode: 'onSubmit',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: LocalUpgradeFormValues) => {
    setSubmitError(null);
    try {
      const response = await upgradeAccountSession({
        provider: 'LOCAL',
        email: values.email,
        password: values.password,
      });
      onSuccess(response);
    } catch (error) {
      setSubmitError(
        formatApiError(error, 'Không thể nâng cấp tài khoản. Vui lòng thử lại.'),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="upgrade-email" className="block text-sm font-medium text-foreground">
          Email <span className="text-destructive">*</span>
        </label>
        <input
          id="upgrade-email"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="banhoc@example.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'upgrade-email-error' : undefined}
          {...register('email')}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.email ? (
          <p id="upgrade-email-error" role="alert" className="text-xs font-medium text-rose-400">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="upgrade-password" className="block text-sm font-medium text-foreground">
          Mật khẩu <span className="text-destructive">*</span>
        </label>
        <input
          id="upgrade-password"
          type="password"
          autoComplete="new-password"
          placeholder="Ít nhất 8 ký tự"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'upgrade-password-error' : undefined}
          {...register('password')}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.password ? (
          <p id="upgrade-password-error" role="alert" className="text-xs font-medium text-rose-400">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="upgrade-confirm-password" className="block text-sm font-medium text-foreground">
          Xác nhận mật khẩu <span className="text-destructive">*</span>
        </label>
        <input
          id="upgrade-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? 'upgrade-confirm-error' : undefined}
          {...register('confirmPassword')}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.confirmPassword ? (
          <p id="upgrade-confirm-error" role="alert" className="text-xs font-medium text-rose-400">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-rose-300">
          {submitError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isSubmitting ? 'Đang nâng cấp tài khoản...' : 'Hoàn tất nâng cấp'}
      </button>
    </form>
  );
}
