import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatApiError } from '../../services/apiClient';
import {
  upgradeAccountSession,
  type UpgradeAccountResponse,
} from '../../services/authApi';
import { localLoginResolver, type LocalLoginFormValues } from './loginSchema';

interface ExistingLocalMergeFormProps {
  onSuccess: (response: UpgradeAccountResponse) => void;
}

export function ExistingLocalMergeForm({ onSuccess }: ExistingLocalMergeFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LocalLoginFormValues>({
    resolver: localLoginResolver,
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LocalLoginFormValues) => {
    setSubmitError(null);
    try {
      const response = await upgradeAccountSession({
        provider: 'LOCAL',
        email: values.email,
        password: values.password,
        existingAccount: true,
      });
      onSuccess(response);
    } catch (error) {
      setSubmitError(
        formatApiError(error, 'Không thể gộp vào tài khoản đã có. Vui lòng thử lại.'),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="merge-email" className="block text-sm font-medium text-foreground">
          Email <span className="text-destructive">*</span>
        </label>
        <input
          id="merge-email"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="banhoc@example.com"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.email ? (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="merge-password" className="block text-sm font-medium text-foreground">
          Mật khẩu <span className="text-destructive">*</span>
        </label>
        <input
          id="merge-password"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu tài khoản hiện có"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.password ? (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {errors.password.message}
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
        {isSubmitting ? 'Đang đăng nhập & gộp phiên...' : 'Đăng nhập & gộp phiên học'}
      </button>
    </form>
  );
}
