/**
 * Logger.js - Smart logging utility for FloodAid
 *
 * Provides platform-aware logging that can be centrally controlled.
 * Disabled on iOS in development by default to reduce console noise.
 *
 * Usage:
 *   import Logger from './utils/Logger';
 *   Logger.log('Debug message');
 *   Logger.warn('Warning message');
 *   Logger.error('Error message');
 *
 * For emergency/critical logs that should always show:
 *   Logger.always('Critical message');
 */

import { DeveloperConfig } from '../config/DeveloperSettings';

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

/**
 * Check if logging is enabled based on platform and configuration
 */
const isLoggingEnabled = () => {
  return DeveloperConfig.enableConsoleLogs;
};

/**
 * Logger utility with platform-aware logging
 */
const Logger = {
  /**
   * Standard log - disabled on iOS in development
   */
  log: (...args) => {
    if (isLoggingEnabled()) {
      originalConsole.log(...args);
    }
  },

  /**
   * Warning log - disabled on iOS in development
   */
  warn: (...args) => {
    if (isLoggingEnabled()) {
      originalConsole.warn(...args);
    }
  },

  /**
   * Error log - disabled on iOS in development
   */
  error: (...args) => {
    if (isLoggingEnabled()) {
      originalConsole.error(...args);
    }
  },

  /**
   * Info log - disabled on iOS in development
   */
  info: (...args) => {
    if (isLoggingEnabled()) {
      originalConsole.info(...args);
    }
  },

  /**
   * Debug log - disabled on iOS in development
   */
  debug: (...args) => {
    if (isLoggingEnabled()) {
      originalConsole.debug(...args);
    }
  },

  /**
   * Always log - bypasses platform checks for critical messages
   * Use sparingly for errors that must be visible
   */
  always: (...args) => {
    originalConsole.log(...args);
  },

  /**
   * Group start - for organized logging
   */
  group: (label) => {
    if (isLoggingEnabled() && console.group) {
      console.group(label);
    }
  },

  /**
   * Group end
   */
  groupEnd: () => {
    if (isLoggingEnabled() && console.groupEnd) {
      console.groupEnd();
    }
  },

  /**
   * Table log - for structured data
   */
  table: (data) => {
    if (isLoggingEnabled() && console.table) {
      console.table(data);
    }
  },
};

export default Logger;

// Export original console methods for special cases
export { originalConsole };
