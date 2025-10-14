import { Platform } from 'react-native';

/**
 * Developer Settings Configuration
 *
 * This file controls developer-only features and tools visibility.
 * Allows platform-specific control over development features.
 */

/**
 * Determines if developer mode features should be enabled
 *
 * @returns {boolean} - true if developer features should be shown
 */
export const isDeveloperModeEnabled = () => {
  // Disable developer mode on iOS even in development builds
  if (Platform.OS === 'ios') {
    return false;
  }

  // For Android and other platforms, use default React Native behavior
  return __DEV__;
};

/**
 * Configuration object for fine-grained control
 */
export const DeveloperConfig = {
  // Show developer mode button
  showDeveloperButton: isDeveloperModeEnabled(),

  // Show alert generator tool
  showAlertGenerator: isDeveloperModeEnabled(),

  // Show location debug settings
  showLocationDebug: isDeveloperModeEnabled(),

  // Enable console logs (can be toggled independently)
  enableConsoleLogs: __DEV__,
};

export default {
  isDeveloperModeEnabled,
  DeveloperConfig,
};
