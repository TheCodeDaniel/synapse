/**
 * Structured logger for Design Intelligence MCP.
 */
import { LoggingConfig } from '../types';
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare class Logger {
    private level;
    private toConsole;
    private prefix;
    constructor(config: LoggingConfig, prefix?: string);
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    private log;
}
export declare function createLogger(config: LoggingConfig, prefix?: string): Logger;
//# sourceMappingURL=logger.d.ts.map