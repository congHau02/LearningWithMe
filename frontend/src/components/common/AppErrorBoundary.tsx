import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Đã xảy ra lỗi hiển thị không mong muốn.',
    };
  }

  public componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error is captured into fallback UI state so the viewport never collapses to a blank screen.
  }

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        data-testid="app-error-boundary"
        className="flex min-h-[100dvh] items-center justify-center bg-background p-4 text-foreground"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
          <h1 className="text-lg font-bold text-foreground">Đã có sự cố tải Study Café</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/40 bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tải lại phòng học
          </button>
        </div>
      </div>
    );
  }
}
