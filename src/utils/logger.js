/**
 * Centralized logging utility with configurable log levels
 * 
 * Log Levels (in order of severity):
 * - error: Critical errors that need immediate attention
 * - warn: Warning messages for potentially harmful situations
 * - info: General informational messages (default)
 * - debug: Detailed information for debugging
 * - verbose: Very detailed information, including all operations
 * - off: Disable all logging
 * 
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.error('Critical error:', error);
 *   logger.warn('Warning message');
 *   logger.info('Info message');
 *   logger.debug('Debug details');
 *   logger.verbose('Verbose details');
 * 
 * Configuration:
 *   Set LOG_LEVEL environment variable to: error, warn, info, debug, verbose, or off
 *   Defaults to 'info' if not set
 */

const LOG_LEVELS = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5
};

class Logger {
  constructor() {
    // Get log level from environment variable, default to 'info'
    const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    this.level = LOG_LEVELS[configuredLevel] !== undefined 
      ? LOG_LEVELS[configuredLevel] 
      : LOG_LEVELS.info;
    
    this.levelName = configuredLevel in LOG_LEVELS ? configuredLevel : 'info';
    
    // Only log initialization message if level is not 'off'
    if (this.level > LOG_LEVELS.off) {
      console.log(`[Logger] Initialized with level: ${this.levelName.toUpperCase()}`);
    }
  }

  /**
   * Format timestamp for log messages
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with timestamp, optional request ID, and level
   */
  formatMessage(level, args, requestId = null) {
    const timestamp = this.getTimestamp();
    const idPart = requestId ? ` [${requestId}]` : '';
    return [`[${timestamp}]${idPart} [${level.toUpperCase()}]`, ...args];
  }

  /**
   * Log error messages (highest priority)
   */
  error(...args) {
    if (this.level >= LOG_LEVELS.error) {
      console.error(...this.formatMessage('error', args));
    }
  }

  /**
   * Log warning messages
   */
  warn(...args) {
    if (this.level >= LOG_LEVELS.warn) {
      console.warn(...this.formatMessage('warn', args));
    }
  }

  /**
   * Log informational messages (default level)
   */
  info(...args) {
    if (this.level >= LOG_LEVELS.info) {
      console.log(...this.formatMessage('info', args));
    }
  }

  /**
   * Log debug messages
   */
  debug(...args) {
    if (this.level >= LOG_LEVELS.debug) {
      console.log(...this.formatMessage('debug', args));
    }
  }

  /**
   * Log verbose messages (most detailed)
   */
  verbose(...args) {
    if (this.level >= LOG_LEVELS.verbose) {
      console.log(...this.formatMessage('verbose', args));
    }
  }

  /**
   * Check if a specific log level is enabled
   */
  isLevelEnabled(level) {
    return this.level >= LOG_LEVELS[level];
  }

  /**
   * Get current log level name
   */
  getLevel() {
    return this.levelName;
  }

  /**
   * Set log level programmatically
   */
  setLevel(level) {
    const normalizedLevel = level.toLowerCase();
    if (LOG_LEVELS[normalizedLevel] !== undefined) {
      this.level = LOG_LEVELS[normalizedLevel];
      this.levelName = normalizedLevel;
      this.info(`Log level changed to: ${normalizedLevel.toUpperCase()}`);
    } else {
      this.warn(`Invalid log level: ${level}. Valid levels: ${Object.keys(LOG_LEVELS).join(', ')}`);
    }
  }

  /**
   * Return a child logger that prepends the given request ID to every message.
   * Use in route handlers: const log = logger.withRequestId(req.requestId);
   */
  withRequestId(requestId) {
    const LEVEL_MAP = [
      ['error', console.error],
      ['warn', console.warn],
      ['info', console.log],
      ['debug', console.log],
      ['verbose', console.log],
    ];

    const child = {};
    const self = this;

    LEVEL_MAP.forEach(([level, consoleFn]) => {
      child[level] = (...args) => {
        if (self.level >= LOG_LEVELS[level]) {
          consoleFn(...self.formatMessage(level, args, requestId));
        }
      };
    });

    return child;
  }
}

// Export singleton instance
module.exports = new Logger();
