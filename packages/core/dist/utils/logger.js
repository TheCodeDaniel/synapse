"use strict";
/**
 * Structured logger for Design Intelligence MCP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
const LEVEL_MAP = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
};
class Logger {
    level;
    toConsole;
    prefix;
    constructor(config, prefix = 'DI') {
        this.level = LEVEL_MAP[config.level] ?? LogLevel.INFO;
        this.toConsole = config.toConsole;
        this.prefix = prefix;
    }
    debug(...args) {
        if (this.level <= LogLevel.DEBUG)
            this.log(LogLevel.DEBUG, ...args);
    }
    info(...args) {
        if (this.level <= LogLevel.INFO)
            this.log(LogLevel.INFO, ...args);
    }
    warn(...args) {
        if (this.level <= LogLevel.WARN)
            this.log(LogLevel.WARN, ...args);
    }
    error(...args) {
        if (this.level <= LogLevel.ERROR)
            this.log(LogLevel.ERROR, ...args);
    }
    log(level, ...args) {
        const timestamp = new Date().toISOString();
        const label = this.prefix;
        const levelStr = ['DEBUG', 'INFO', 'WARN', 'ERROR'][level];
        const prefix = `[${timestamp}] [${label}] [${levelStr}]`;
        if (this.toConsole) {
            const consoleMethod = level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : level === LogLevel.DEBUG ? console.debug : console.log;
            consoleMethod(prefix, ...args);
        }
    }
}
exports.Logger = Logger;
function createLogger(config, prefix) {
    return new Logger(config, prefix ?? 'DI');
}
//# sourceMappingURL=logger.js.map