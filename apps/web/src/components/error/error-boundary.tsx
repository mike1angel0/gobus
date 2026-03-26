import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './error-fallback';

interface ErrorBoundaryProps {
  /** Content to render when no error has occurred. */
  children: ReactNode;
  /** Optional custom fallback renderer. Receives the error and a reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React error boundary that catches render errors in its subtree and displays
 * a fallback UI with a retry button. Wraps pages so one crash doesn't break the app.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyPage />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Intentionally empty — add monitoring (e.g. Sentry) integration here.
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) {
        return fallback(error, this.handleReset);
      }
      return <ErrorFallback message={error.message} onRetry={this.handleReset} />;
    }

    return children;
  }
}
