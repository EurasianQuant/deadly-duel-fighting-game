import React, { Component, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ error, errorInfo });
        
        // Log error details
        logger.error('React Error Boundary caught an error:', error, {
            componentStack: errorInfo.componentStack,
        });

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="error-boundary min-h-screen bg-gray-900 text-white flex items-center justify-center">
                    <div className="text-center p-8 max-w-lg">
                        <h2 className="text-2xl font-bold mb-4 text-red-400">🚨 Something went wrong</h2>
                        <p className="text-gray-300 mb-6">
                            The game encountered an unexpected error. This has been logged for investigation.
                        </p>
                        <div className="space-y-4">
                            <button
                                onClick={this.handleRetry}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded font-medium transition-colors ml-4"
                            >
                                Reload Page
                            </button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="cursor-pointer text-yellow-400 hover:text-yellow-300">
                                    Error Details (Development)
                                </summary>
                                <pre className="mt-2 p-4 bg-gray-800 rounded text-sm overflow-auto">
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;