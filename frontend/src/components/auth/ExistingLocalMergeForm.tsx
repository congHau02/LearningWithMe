import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatApiError } from '../../services/apiClient';
import {
  upgradeAccountSession,
  type UpgradeAccountResponse,
} from '../../services/authApi';
import { localLoginResolver, type LocalLoginFormValues } from './loginSchema';
import { PasswordField } from './PasswordField';

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
          className="min-h-11 w-full rounded-xl border border-border bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.email ? (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="merge-password"
        label="Mật khẩu"
        placeholder="Nhập mật khẩu tài khoản hiện có"
        autoComplete="current-password"
        registration={register('password')}
        error={errors.password}
      />

      {submitError ? (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-rose-300">
          {submitError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 w-full rounded-xl border border-primary/40 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {isSubmitting ? 'Đang đăng nhập & gộp phiên...' : 'Đăng nhập & gộp phiên học'}
      </button>
    </form>
  );
}
