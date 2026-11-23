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
import { PasswordField } from './PasswordField';

interface LocalUpgradeFormProps {
  onSuccess: (response: UpgradeAccountResponse) => void;
}

export function LocalUpgradeForm({ onSuccess }: LocalUpgradeFormProps) {
  const [isExistingAccount, setIsExistingAccount] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-xs">
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
          className="min-h-11 w-full rounded-xl border border-border bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.email ? (
          <p id="upgrade-email-error" role="alert" className="text-xs font-medium text-rose-400">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="upgrade-password"
        label="Mật khẩu"
        placeholder="Ít nhất 8 ký tự"
        autoComplete="new-password"
        errorId="upgrade-password-error"
        registration={register('password')}
        error={errors.password}
      />

      <PasswordField
        id="upgrade-confirm-password"
        label="Xác nhận mật khẩu"
        placeholder="Nhập lại mật khẩu"
        autoComplete="new-password"
        errorId="upgrade-confirm-error"
        registration={register('confirmPassword')}
        error={errors.confirmPassword}
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
        {isSubmitting ? 'Đang nâng cấp tài khoản...' : 'Hoàn tất nâng cấp'}
      </button>
    </form>
  );
}
