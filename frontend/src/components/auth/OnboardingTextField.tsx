import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface OnboardingTextFieldProps {
  id: string;
  label: string;
  required?: boolean;
  maxLength: number;
  currentLength: number;
  placeholder: string;
  autoFocus?: boolean;
  autoComplete?: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
}

export function OnboardingTextField({
  id,
  label,
  required = false,
  maxLength,
  currentLength,
  placeholder,
  autoFocus = false,
  autoComplete,
  registration,
  error,
}: OnboardingTextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-foreground">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </label>
        <span
          className={`font-mono text-xs ${
            currentLength > maxLength
              ? 'text-destructive'
              : 'text-muted-foreground'
          }`}
        >
          {currentLength}/{maxLength}
        </span>
      </div>
      <input
        id={id}
        type="text"
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...registration}
        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-400">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
