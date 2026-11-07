import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from "lucide-react";
import { trackClientError, TrackedErrorRecord } from "@/services/errorTracker";

import { isChunkLoadError } from "@/utils/lazyWithRetry";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorRecord: TrackedErrorRecord | null;
  isChunkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorRecord: null,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isChunk = isChunkLoadError(error);

    // Extract exact component name from React component stack if available
    const stackMatch = errorInfo.componentStack?.match(/in\s+([A-Za-z0-9_]+)/);
    const failedComponent = this.props.componentName || (stackMatch ? stackMatch[1] : "ErrorBoundary");

    const errorRecord = trackClientError(error, {
      component: failedComponent,
      info: errorInfo.componentStack?.slice(0, 300),
    });

    this.setState({ errorRecord, isChunkError: isChunk });

    // Automatic recovery for chunk load failures after fresh Vercel deployments:
    // If a chunk load failed and we haven't reloaded yet for this URL, reload once cleanly.
    if (isChunk && typeof window !== "undefined") {
      const reloadKey = `foundarly_eb_chunk_reload_${window.location.pathname}`;
      try {
        const hasReloaded = Boolean(window.sessionStorage?.getItem(reloadKey));
        if (!hasReloaded) {
          window.sessionStorage?.setItem(reloadKey, "true");
          console.warn("[ErrorBoundary] Dynamic chunk load failure caught; reloading once to fetch latest assets...");
          window.location.reload();
          return;
        }
      } catch {
        // ignore sessionStorage errors
      }
    }
  }

  private handleReset = () => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        Object.keys(window.sessionStorage).forEach((k) => {
          if (k.startsWith("foundarly_chunk_reload_") || k.startsWith("foundarly_eb_chunk_reload_")) {
            window.sessionStorage.removeItem(k);
          }
        });
      }
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorRecord: null, isChunkError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const referenceId = this.state.errorRecord?.id || "ERR_FOUNDARLY";
      const isChunk = this.state.isChunkError;
      const title = isChunk ? "Connection Interrupted" : "Something went wrong";
      const description = isChunk
        ? "A network interruption or updated deployment was detected while fetching application resources. Please check your internet connection and reload."
        : "An unexpected application error occurred. We have logged this occurrence securely to improve platform reliability.";

      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-card border border-border/80 rounded-2xl p-8 shadow-xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-xl font-bold text-foreground">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
              
              <div className="mt-4 p-3 bg-secondary/50 rounded-lg text-center text-xs font-mono text-muted-foreground border border-border/40">
                <span className="text-[10px] uppercase tracking-wider block text-muted-foreground/80 mb-0.5">
                  Reference Code
                </span>
                <span className="font-semibold text-primary">{referenceId}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={this.handleReset}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {isChunk ? "Reload Application" : "Reload Page"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorRecord: null });
                  window.location.href = "/";
                }}
                className="w-full text-xs text-muted-foreground rounded-full gap-1.5"
              >
                <Home className="h-3.5 w-3.5" />
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
