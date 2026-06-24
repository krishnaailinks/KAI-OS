"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  title?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {this.props.title || "Section Error"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            This section encountered an error. Our team has been notified.
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
