import { Logger, LogLevel, createLogger } from '../logger';

describe('Logger', () => {
  // info-level messages log via console.log, not console.info — matches
  // the actual implementation's `level === LogLevel.DEBUG ? console.debug
  // : ... : console.log` fallback.
  let consoleSpies: Record<'debug' | 'log' | 'warn' | 'error', jest.SpyInstance>;

  beforeEach(() => {
    consoleSpies = {
      debug: jest.spyOn(console, 'debug').mockImplementation(() => undefined),
      log: jest.spyOn(console, 'log').mockImplementation(() => undefined),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      error: jest.spyOn(console, 'error').mockImplementation(() => undefined),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs at or above the configured level', () => {
    const logger = new Logger({ level: 'warn', toConsole: true, toFile: false });

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.log).not.toHaveBeenCalled();
    expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
  });

  it('logs everything at debug level', () => {
    const logger = new Logger({ level: 'debug', toConsole: true, toFile: false });

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(consoleSpies.debug).toHaveBeenCalledTimes(1);
    expect(consoleSpies.log).toHaveBeenCalledTimes(1);
    expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
  });

  it('does not log to console when toConsole is false', () => {
    const logger = new Logger({ level: 'debug', toConsole: false, toFile: false });

    logger.error('should not print');

    expect(consoleSpies.error).not.toHaveBeenCalled();
  });

  it('includes the configured prefix in log output', () => {
    const logger = new Logger({ level: 'info', toConsole: true, toFile: false }, 'MyPrefix');

    logger.info('hello');

    expect(consoleSpies.log.mock.calls[0].join(' ')).toContain('MyPrefix');
  });

  it('createLogger returns a working Logger instance', () => {
    const logger = createLogger({ level: 'info', toConsole: true, toFile: false }, 'Test');

    logger.info('via factory');

    expect(consoleSpies.log).toHaveBeenCalledTimes(1);
  });

  it('LogLevel enum orders levels from most to least verbose', () => {
    expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
    expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
    expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
  });
});
