/**
 * AsyncStorageHelper - Reliable AsyncStorage wrapper with iOS optimizations
 *
 * Fixes iOS storage sync issues by:
 * - Write queue with rate limiting
 * - Automatic retry on failure (exponential backoff)
 * - Write verification
 * - Platform-specific timing adjustments
 * - Batch write support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class AsyncStorageHelper {
  static writeQueue = [];
  static isProcessing = false;
  static retryAttempts = new Map(); // Track retry attempts per key

  // iOS needs longer delays between writes
  static WRITE_DELAY = Platform.OS === 'ios' ? 100 : 50; // ms between writes
  static MAX_RETRIES = 3;
  static RETRY_BACKOFF = Platform.OS === 'ios' ? 500 : 300; // ms base backoff

  /**
   * Reliable setItem with retry and verification
   */
  static async setItem(key, value, options = {}) {
    const {
      priority = 'normal', // 'high', 'normal', 'low'
      verify = true,
      retries = this.MAX_RETRIES
    } = options;

    return new Promise((resolve, reject) => {
      const writeOperation = {
        key,
        value,
        priority,
        verify,
        retries,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Add to queue based on priority
      if (priority === 'high') {
        this.writeQueue.unshift(writeOperation);
      } else {
        this.writeQueue.push(writeOperation);
      }

      // Start processing if not already running
      if (!this.isProcessing) {
        this._processQueue();
      }
    });
  }

  /**
   * Process write queue with rate limiting
   */
  static async _processQueue() {
    if (this.isProcessing || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.writeQueue.length > 0) {
      const operation = this.writeQueue.shift();

      try {
        await this._executeWrite(operation);

        // Add delay between writes (iOS needs this)
        if (this.writeQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.WRITE_DELAY));
        }

      } catch (error) {
        console.error(`❌ AsyncStorageHelper: Write failed for ${operation.key}:`, error);

        // Handle retry if available
        if (operation.retries > 0) {
          console.log(`🔄 AsyncStorageHelper: Retrying ${operation.key} (${this.MAX_RETRIES - operation.retries + 1}/${this.MAX_RETRIES})`);

          // Calculate exponential backoff
          const retryCount = this.MAX_RETRIES - operation.retries + 1;
          const backoffDelay = this.RETRY_BACKOFF * Math.pow(2, retryCount - 1);

          // Re-queue with reduced retry count
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          this.writeQueue.unshift({
            ...operation,
            retries: operation.retries - 1
          });

        } else {
          // Max retries exceeded
          console.error(`❌ AsyncStorageHelper: Max retries exceeded for ${operation.key}`);
          operation.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute single write operation with verification
   */
  static async _executeWrite(operation) {
    const { key, value, verify, resolve, reject } = operation;

    try {
      // Perform write
      await AsyncStorage.setItem(key, value);

      // Verify write if requested
      if (verify) {
        const readBack = await AsyncStorage.getItem(key);

        if (readBack !== value) {
          throw new Error(`Write verification failed for ${key}: value mismatch`);
        }
      }

      console.log(`✅ AsyncStorageHelper: Successfully wrote ${key} (${value.length} bytes)`);
      resolve(true);

      // Clear retry counter on success
      this.retryAttempts.delete(key);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Batch write multiple items
   */
  static async multiSet(keyValuePairs, options = {}) {
    const { verify = false } = options;

    try {
      // Use AsyncStorage multiSet for atomic batch write
      await AsyncStorage.multiSet(keyValuePairs);

      // Verify if requested
      if (verify) {
        const keys = keyValuePairs.map(([key]) => key);
        const readBack = await AsyncStorage.multiGet(keys);

        // Check all values match
        for (let i = 0; i < keyValuePairs.length; i++) {
          const [key, value] = keyValuePairs[i];
          const [, readValue] = readBack[i];

          if (readValue !== value) {
            throw new Error(`Batch write verification failed for ${key}`);
          }
        }
      }

      console.log(`✅ AsyncStorageHelper: Batch wrote ${keyValuePairs.length} items`);
      return true;

    } catch (error) {
      console.error('❌ AsyncStorageHelper: Batch write failed:', error);
      throw error;
    }
  }

  /**
   * Debounced setItem - useful for rapid updates (like UserContext)
   */
  static debouncedSetItem(key, getValue, delay = 500) {
    // Clear existing debounce timer for this key
    if (this.debounceTimers && this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }

    if (!this.debounceTimers) {
      this.debounceTimers = {};
    }

    return new Promise((resolve, reject) => {
      this.debounceTimers[key] = setTimeout(async () => {
        try {
          const value = await getValue();
          await this.setItem(key, value, { verify: true });
          delete this.debounceTimers[key];
          resolve(true);
        } catch (error) {
          delete this.debounceTimers[key];
          reject(error);
        }
      }, delay);
    });
  }

  /**
   * Get queue statistics
   */
  static getQueueStats() {
    return {
      queueLength: this.writeQueue.length,
      isProcessing: this.isProcessing,
      platform: Platform.OS,
      writeDelay: this.WRITE_DELAY,
      retryBackoff: this.RETRY_BACKOFF,
      pendingOperations: this.writeQueue.map(op => ({
        key: op.key,
        priority: op.priority,
        retriesLeft: op.retries,
        age: Date.now() - op.timestamp
      }))
    };
  }

  /**
   * Clear all pending operations (use with caution)
   */
  static clearQueue() {
    const count = this.writeQueue.length;
    this.writeQueue = [];
    console.log(`🗑️ AsyncStorageHelper: Cleared ${count} pending operations`);
    return count;
  }

  /**
   * Check AsyncStorage health
   */
  static async healthCheck() {
    const testKey = '__asyncstorage_health_check__';
    const testValue = JSON.stringify({ timestamp: Date.now(), test: 'health' });

    try {
      // Test write
      const writeStart = Date.now();
      await AsyncStorage.setItem(testKey, testValue);
      const writeTime = Date.now() - writeStart;

      // Test read
      const readStart = Date.now();
      const readValue = await AsyncStorage.getItem(testKey);
      const readTime = Date.now() - readStart;

      // Test delete
      await AsyncStorage.removeItem(testKey);

      // Verify
      const isHealthy = readValue === testValue;

      return {
        healthy: isHealthy,
        writeTime,
        readTime,
        platform: Platform.OS,
        details: isHealthy ? 'AsyncStorage is working correctly' : 'Write/read mismatch detected'
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        platform: Platform.OS,
        details: 'AsyncStorage health check failed'
      };
    }
  }
}

export default AsyncStorageHelper;
