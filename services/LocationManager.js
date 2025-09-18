import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

class LocationManager {
  static cache = new Map();
  static lastLocation = null;
  static isRequestInProgress = false;
  static listeners = new Set();

  static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for fresh location
  static STALE_DURATION = 30 * 60 * 1000; // 30 minutes for acceptable stale location

  static TIMEOUTS = {
    FAST: 5000,    // 5 seconds - quick attempt
    NORMAL: 10000, // 10 seconds - standard request
    THOROUGH: 15000 // 15 seconds - high accuracy attempt
  };

  /**
   * Main method: Get user's current location with progressive enhancement
   */
  static async getCurrentLocation(options = {}) {
    const {
      priority = 'normal', // 'fast', 'normal', 'thorough'
      allowStale = true,
      showError = true,
      forceGPS = false
    } = options;

    const requestId = Date.now();
    console.log(`📍 LocationManager [${requestId}]: Getting location (priority: ${priority})`);

    try {
      // 1. Return cached location if available and fresh
      if (!forceGPS) {
        const cached = await this.getCachedLocation(priority === 'fast');
        if (cached) {
          console.log(`⚡ [${requestId}]: Using cached location (${Math.round(cached.age/1000)}s old)`);

          // Start background GPS improvement if cache is stale
          if (cached.age > this.CACHE_DURATION) {
            this.improveLocationInBackground(requestId);
          }

          return {
            ...cached,
            source: 'cache',
            debugId: requestId
          };
        }
      }

      // 2. Check if another request is in progress
      if (this.isRequestInProgress && !forceGPS) {
        console.log(`⏳ [${requestId}]: GPS request already in progress, waiting...`);
        return await this.waitForCurrentRequest(requestId);
      }

      // 3. Attempt GPS location
      this.isRequestInProgress = true;
      const location = await this.getGPSLocation(requestId, priority);

      if (location) {
        await this.cacheLocation(location);
        this.notifyListeners(location);
        this.isRequestInProgress = false;

        console.log(`✅ [${requestId}]: GPS location acquired successfully`);
        return {
          ...location,
          source: 'gps',
          debugId: requestId
        };
      }

    } catch (error) {
      this.isRequestInProgress = false;
      console.error(`❌ [${requestId}]: Location request failed:`, error.message);

      // 4. Try stale cache as last resort
      if (allowStale) {
        const staleLocation = await this.getCachedLocation(true);
        if (staleLocation) {
          console.log(`💾 [${requestId}]: Using stale cached location as fallback`);
          return {
            ...staleLocation,
            source: 'stale_cache',
            debugId: requestId,
            isStale: true
          };
        }
      }

      // 5. No location available - throw clear error
      const userError = this.getUserFriendlyError(error);
      if (showError) {
        // This will be caught by the UI to show user-friendly error
        throw userError;
      }
      throw error;
    }
  }

  /**
   * Get GPS location with proper timeout and error handling
   */
  static async getGPSLocation(requestId, priority) {
    // Check permissions first
    const permissionResult = await this.requestLocationPermission(requestId);
    if (!permissionResult.granted) {
      throw new Error(`PERMISSION_DENIED: ${permissionResult.reason}`);
    }

    const timeout = this.TIMEOUTS[priority.toUpperCase()] || this.TIMEOUTS.NORMAL;
    const isEmulator = await this.isRunningInEmulator();

    const config = {
      accuracy: this.getAccuracyForPriority(priority, isEmulator),
      timeout: isEmulator ? Math.min(timeout, 8000) : timeout,
      maximumAge: 60000,
      enableHighAccuracy: priority === 'thorough' && !isEmulator
    };

    console.log(`🛰️ [${requestId}]: Requesting GPS with ${timeout}ms timeout (emulator: ${isEmulator})`);

    try {
      const location = await Location.getCurrentPositionAsync(config);

      const result = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: Date.now()
      };

      // Validate location is reasonable
      if (!this.isValidLocation(result.latitude, result.longitude)) {
        throw new Error('GPS_INVALID_COORDS: Location outside reasonable bounds');
      }

      return result;

    } catch (error) {
      // Enhanced error handling with specific error types
      if (error.message.includes('timeout')) {
        throw new Error(`GPS_TIMEOUT: Location request timed out after ${timeout}ms`);
      }
      if (error.message.includes('permission')) {
        throw new Error('GPS_PERMISSION: Location permission was denied');
      }
      if (error.message.includes('unavailable')) {
        throw new Error('GPS_UNAVAILABLE: Location services are disabled');
      }

      throw new Error(`GPS_FAILED: ${error.message}`);
    }
  }

  /**
   * Request location permission with clear messaging
   */
  static async requestLocationPermission(requestId) {
    try {
      console.log(`🔐 [${requestId}]: Requesting location permission...`);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        console.log(`✅ [${requestId}]: Location permission granted`);
        return { granted: true };
      }

      const reason = status === 'denied'
        ? 'Permission was denied by user'
        : 'Permission request failed';

      console.warn(`⚠️ [${requestId}]: Location permission ${status}: ${reason}`);
      return { granted: false, status, reason };

    } catch (error) {
      console.error(`❌ [${requestId}]: Permission request error:`, error);
      return {
        granted: false,
        status: 'error',
        reason: `Permission check failed: ${error.message}`
      };
    }
  }

  /**
   * Get cached location if available and valid
   */
  static async getCachedLocation(allowStale = false) {
    const now = Date.now();

    // Check memory cache first
    if (this.lastLocation) {
      const age = now - this.lastLocation.timestamp;
      const maxAge = allowStale ? this.STALE_DURATION : this.CACHE_DURATION;

      if (age < maxAge) {
        return { ...this.lastLocation, age, isCached: true };
      }
    }

    // Check AsyncStorage cache
    try {
      const stored = await AsyncStorage.getItem('location_cache');
      if (stored) {
        const location = JSON.parse(stored);
        const age = now - location.timestamp;
        const maxAge = allowStale ? this.STALE_DURATION : this.CACHE_DURATION;

        if (age < maxAge) {
          this.lastLocation = location;
          return { ...location, age, isCached: true };
        }
      }
    } catch (error) {
      console.warn('Failed to read location cache:', error);
    }

    return null;
  }

  /**
   * Cache location to memory and storage
   */
  static async cacheLocation(location) {
    this.lastLocation = location;

    try {
      await AsyncStorage.setItem('location_cache', JSON.stringify(location));
    } catch (error) {
      console.warn('Failed to cache location:', error);
    }
  }

  /**
   * Get user-friendly error messages
   */
  static getUserFriendlyError(error) {
    const message = error.message || '';

    if (message.includes('PERMISSION_DENIED')) {
      return {
        type: 'permission',
        title: 'Location Permission Required',
        message: 'FloodAid needs location access to provide accurate flood predictions.',
        action: 'Please enable location permissions in your device settings.',
        canRetry: false
      };
    }

    if (message.includes('GPS_TIMEOUT')) {
      return {
        type: 'timeout',
        title: 'GPS Taking Too Long',
        message: 'Your device is having trouble getting a GPS signal.',
        action: 'Try moving to an open area or use manual location.',
        canRetry: true
      };
    }

    if (message.includes('GPS_UNAVAILABLE')) {
      return {
        type: 'unavailable',
        title: 'Location Services Disabled',
        message: 'GPS or location services are turned off on your device.',
        action: 'Please enable location services in your device settings.',
        canRetry: false
      };
    }

    return {
      type: 'unknown',
      title: 'Location Unavailable',
      message: 'Unable to determine your location automatically.',
      action: 'Please provide your location manually or try again.',
      canRetry: true
    };
  }

  /**
   * Helper methods
   */
  static getAccuracyForPriority(priority, isEmulator) {
    if (isEmulator) return Location.Accuracy.Balanced;

    switch (priority) {
      case 'fast': return Location.Accuracy.Low;
      case 'thorough': return Location.Accuracy.BestForNavigation;
      default: return Location.Accuracy.High;
    }
  }

  static isValidLocation(lat, lon) {
    // Basic validation: reasonable coordinates
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
           lat !== 0 && lon !== 0; // Avoid null island
  }

  static async isRunningInEmulator() {
    try {
      return Constants.isDevice === false ||
             Constants.deviceName?.toLowerCase().includes('emulator') ||
             Constants.deviceName?.toLowerCase().includes('simulator');
    } catch {
      return false;
    }
  }

  /**
   * Background location improvement (non-blocking)
   */
  static async improveLocationInBackground(requestId) {
    try {
      console.log(`🔄 [${requestId}]: Starting background location improvement...`);

      setTimeout(async () => {
        try {
          const improved = await this.getGPSLocation(`${requestId}_bg`, 'normal');
          if (improved) {
            await this.cacheLocation(improved);
            this.notifyListeners(improved);
            console.log(`✅ [${requestId}_bg]: Background location improved`);
          }
        } catch (error) {
          console.log(`🔄 [${requestId}_bg]: Background improvement failed: ${error.message}`);
        }
      }, 100);

    } catch (error) {
      console.log(`🔄 Background improvement setup failed: ${error.message}`);
    }
  }

  /**
   * Wait for current GPS request to complete
   */
  static async waitForCurrentRequest(requestId) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        if (!this.isRequestInProgress) {
          clearInterval(checkInterval);
          const location = await this.getCachedLocation();
          resolve(location || { source: 'wait_failed', debugId: requestId });
        }
      }, 500);

      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({ source: 'wait_timeout', debugId: requestId });
      }, 15000);
    });
  }

  /**
   * Notification system for location updates
   */
  static addLocationListener(callback) {
    this.listeners.add(callback);
  }

  static removeLocationListener(callback) {
    this.listeners.delete(callback);
  }

  static notifyListeners(location) {
    this.listeners.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Location listener error:', error);
      }
    });
  }

  /**
   * Utility methods for UI components
   */
  static async hasLocationPermission() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  static async clearCache() {
    this.lastLocation = null;
    this.cache.clear();
    try {
      await AsyncStorage.removeItem('location_cache');
    } catch (error) {
      console.warn('Failed to clear location cache:', error);
    }
  }

  static getLastKnownLocation() {
    return this.lastLocation;
  }

  /**
   * For manual location input integration
   */
  static async setManualLocation(latitude, longitude, address = null) {
    const manualLocation = {
      latitude,
      longitude,
      accuracy: null,
      timestamp: Date.now(),
      isManual: true,
      address
    };

    await this.cacheLocation(manualLocation);
    this.notifyListeners(manualLocation);

    console.log('📍 Manual location set:', manualLocation);
    return manualLocation;
  }
}

export default LocationManager;