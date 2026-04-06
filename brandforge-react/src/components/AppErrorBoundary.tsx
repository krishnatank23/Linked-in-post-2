import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected UI error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UI runtime error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center px-6">
          <div className="max-w-2xl w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-red-200/80 mb-2">Frontend Runtime Error</div>
            <h1 className="text-2xl font-semibold mb-3">The UI crashed while rendering this page.</h1>
            <p className="text-sm text-red-50/90 break-words mb-5">{this.state.message}</p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 font-semibold bg-white/15 border border-white/20 hover:bg-white/20"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
