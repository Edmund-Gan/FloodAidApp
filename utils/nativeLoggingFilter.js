/**
 * nativeLoggingFilter.js - Native logging filter for iOS devices
 *
 * This file intercepts console logs BEFORE they reach the native bridge,
 * preventing them from appearing in iOS device logs/Xcode console while
 * keeping them visible in the Metro bundler terminal.
 *
 * How it works:
 * - Metro terminal captures console output BEFORE the native bridge
 * - This hook intercepts at the native bridge level
 * - For iOS: Block transmission to native (no device logs)
 * - For Android: Allow normal transmission (logcat works)
 * - Metro terminal sees everything regardless
 *
 * Import this file at the very top of App.js:
 *   import './utils/nativeLoggingFilter';
 */

import { Platform } from 'react-native';

/**
 * Store the original native logging hook if it exists
 */
const originalNativeLoggingHook = global.nativeLoggingHook;

/**
 * Override the native logging hook
 * This is called by React Native before sending logs to the native side
 */
global.nativeLoggingHook = (level, ...args) => {
  // On iOS: Don't send logs to native bridge
  // This prevents logs from appearing in Xcode console and iOS device logs
  // Metro terminal still sees them because it captures before this hook
  if (Platform.OS === 'ios') {
    // Silently discard - don't send to iOS native logging
    return;
  }

  // On Android and other platforms: Use default behavior
  // Send logs to native bridge (Android logcat, etc.)
  if (originalNativeLoggingHook) {
    originalNativeLoggingHook(level, ...args);
  }
};

// Log that the filter is active (only in development)
if (__DEV__) {
  // Use a setTimeout to ensure this runs after React Native's logging setup
  setTimeout(() => {
    if (Platform.OS === 'ios') {
      // This log will appear in Metro terminal but not iOS device logs
      console.log(
        '📱 [Native Logging Filter] iOS device logging disabled - logs visible in Metro terminal only'
      );
    } else {
      console.log(
        '📱 [Native Logging Filter] Native logging enabled for ' + Platform.OS
      );
    }
  }, 100);
}

/**
 * Export a function to temporarily restore native logging for iOS
 * Useful for debugging native issues
 */
export const enableIOSNativeLogging = () => {
  if (Platform.OS === 'ios') {
    global.nativeLoggingHook = originalNativeLoggingHook;
    console.log('📱 [Native Logging Filter] iOS native logging temporarily enabled');
  }
};

/**
 * Export a function to re-apply the filter
 */
export const disableIOSNativeLogging = () => {
  if (Platform.OS === 'ios') {
    global.nativeLoggingHook = (level, ...args) => {
      // Block iOS native logging again
      return;
    };
    console.log('📱 [Native Logging Filter] iOS native logging disabled');
  }
};

/**
 * Check if iOS native logging is currently filtered
 */
export const isIOSNativeLoggingDisabled = () => {
  return Platform.OS === 'ios' && global.nativeLoggingHook !== originalNativeLoggingHook;
};
