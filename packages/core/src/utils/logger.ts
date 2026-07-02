/**
 * Structured logger for Design Intelligence MCP.
 */

import { LoggingConfig } from '../types';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

export class Logger {
  private level: LogLevel;
  private toConsole: boolean;
  private prefix: string;

  constructor(config: LoggingConfig, prefix = 'DI') {
    this.level = LEVEL_MAP[config.level] ?? LogLevel.INFO;
    this.toConsole = config.toConsole;
    this.prefix = prefix;
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) this.log(LogLevel.DEBUG, ...args);
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) this.log(LogLevel.INFO, ...args);
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) this.log(LogLevel.WARN, ...args);
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) this.log(LogLevel.ERROR, ...args);
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const label = this.prefix;
    const levelStr = ['DEBUG', 'INFO', 'WARN', 'ERROR'][level] as string;
    const prefix = `[${timestamp}] [${label}] [${levelStr}]`;

    if (this.toConsole) {
      const consoleMethod = level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : level === LogLevel.DEBUG ? console.debug : console.log;
      consoleMethod(prefix, ...args);
    }
  }
}

export function createLogger(config: LoggingConfig, prefix?: string): Logger {
  return new Logger(config, prefix ?? 'DI');
}