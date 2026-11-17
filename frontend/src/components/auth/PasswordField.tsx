import { useState } from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  autoComplete?: string;
  errorId?: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
}

/** Accessible password input with show/hide toggle and inline validation error. */
export function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  errorId = `${id}-error`,
  registration,
  error,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label} <span className="text-destructive">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...registration}
          className="min-h-11 w-full rounded-lg border border-border bg-background py-2 pl-3 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-controls={id}
          aria-label={visible ? 'Ẩn ký tự đã nhập' : 'Hiển thị ký tự đã nhập'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-400">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
