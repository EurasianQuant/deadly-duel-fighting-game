// Centralized logging and error handling system

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

interface LogEntry {
    timestamp: number;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: Error;
}

class Logger {
    private logs: LogEntry[] = [];
    private maxLogs = 1000;
    private minLevel: LogLevel = LogLevel.INFO;

    constructor() {
        // Set debug level in development
        if (process.env.NODE_ENV === 'development') {
            this.minLevel = LogLevel.DEBUG;
        }
    }

    private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
        if (level < this.minLevel) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            context,
            error,
        };

        this.logs.push(entry);

        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Output to console with appropriate level
        const prefix = `[${new Date().toISOString()}] [${LogLevel[level]}]`;
        const logMessage = `${prefix} ${message}`;

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(logMessage, context, error);
                break;
            case LogLevel.INFO:
                console.info(logMessage, context, error);
                break;
            case LogLevel.WARN:
                console.warn(logMessage, context, error);
                break;
            case LogLevel.ERROR:
                console.error(logMessage, context, error);
                break;
        }
    }

    debug(message: string, context?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.log(LogLevel.WARN, message, context);
    }

    error(message: string, error?: Error, context?: Record<string, unknown>): void {
        this.log(LogLevel.ERROR, message, context, error);
    }

    // Game-specific logging methods
    gameEvent(eventName: string, data?: Record<string, unknown>): void {
        this.debug(`Game Event: ${eventName}`, data);
    }

    performance(operation: string, duration: number): void {
        this.debug(`Performance: ${operation} took ${duration}ms`);
    }

    networkEvent(event: string, data?: Record<string, unknown>): void {
        this.info(`Network: ${event}`, data);
    }

    combatEvent(event: string, data?: Record<string, unknown>): void {
        this.debug(`Combat: ${event}`, data);
    }

    // Get recent logs for debugging
    getRecentLogs(count = 50): LogEntry[] {
        return this.logs.slice(-count);
    }

    // Export logs for support
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    // Clear logs
    clearLogs(): void {
        this.logs = [];
    }
}

// Create singleton instance
export const logger = new Logger();

// Global error handler
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        logger.error('Uncaught error', event.error, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection', event.reason);
    });
}

// Export for development debugging
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).logger = logger;
}