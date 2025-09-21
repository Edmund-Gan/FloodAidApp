/**
 * ReliableLocationService - Simplified and robust GPS location service
 *
 * This service replaces the over-engineered location system with a simple,
 * reliable approach that follows React Native best practices.
 *
 * Key Features:
 * - Progressive timeout strategy (10s → 20s → 40s)
 * - Clear error handling with user-friendly messages
 * - Simplified emulator detection
 * - Smart retry logic with exponential backoff
 * - Proper user feedback during GPS acquisition
 * - Clean separation of concerns
 */

import * as Location from 'expo-location';
import Constants from 'expo-constants';

class ReliableLocationService {
  static currentRequest = null;
  static listeners = new Set();
  static lastValidLocation = null;
  static requestCounter = 0;
  static addressCache = new Map(); // Cache for reverse geocoded addresses

  // Progressive timeout strategy for better reliability
  static TIMEOUT_STRATEGY = [
    { name: 'quick', timeout: 10000, accuracy: Location.Accuracy.Balanced },
    { name: 'medium', timeout: 20000, accuracy: Location.Accuracy.High },
    { name: 'thorough', timeout: 40000, accuracy: Location.Accuracy.BestForNavigation }
  ];

  // Error types for specific handling
  static ERROR_TYPES = {
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    LOCATION_DISABLED: 'LOCATION_DISABLED',
    TIMEOUT: 'TIMEOUT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    GPS_UNAVAILABLE: 'GPS_UNAVAILABLE',
    UNKNOWN: 'UNKNOWN'
  };

  /**
   * Main method: Get current location with progressive timeout strategy
   */
  static async getCurrentLocation(options = {}) {
    const {
      enableProgressiveFallback = true,
      onProgress = null,
      forceRefresh = false,
      enableHighAccuracy = true,
      includeAddress = true // New parameter to request reverse geocoding
    } = options;

    const requestId = ++this.requestCounter;
    console.log(`📍 ReliableLocationService [${requestId}]: Starting location request`);

    // Check if another request is in progress
    if (this.currentRequest && !forceRefresh) {
      console.log(`⏳ [${requestId}]: Waiting for ongoing request...`);
      try {
        const result = await this.currentRequest;
        return { ...result, isDuplicate: true, requestId };
      } catch (error) {
        console.log(`⚠️ [${requestId}]: Ongoing request failed, starting new one`);
      }
    }

    // Create new location request
    this.currentRequest = this._performLocationRequest(requestId, onProgress, enableProgressiveFallback, enableHighAccuracy, includeAddress);

    try {
      const result = await this.currentRequest;
      this.lastValidLocation = result;
      this._notifyListeners(result);
      return { ...result, requestId };
    } catch (error) {
      console.error(`❌ [${requestId}]: Location request failed:`, error.message);
      throw this._enhanceError(error, requestId);
    } finally {
      this.currentRequest = null;
    }
  }

  /**
   * Perform location request with progressive timeouts
   */
  static async _performLocationRequest(requestId, onProgress, enableProgressiveFallback, enableHighAccuracy, includeAddress) {
    // Check permissions first
    const permissionResult = await this._checkPermissions(requestId);
    if (!permissionResult.granted) {
      throw this._createError(this.ERROR_TYPES.PERMISSION_DENIED, permissionResult.message);
    }

    // Check if location services are enabled
    const servicesEnabled = await this._checkLocationServices(requestId);
    if (!servicesEnabled) {
      throw this._createError(this.ERROR_TYPES.LOCATION_DISABLED, 'Location services are disabled on this device');
    }

    // Detect device type for appropriate settings
    const isEmulator = this._isEmulator();
    const strategy = enableProgressiveFallback ? this.TIMEOUT_STRATEGY : [this.TIMEOUT_STRATEGY[1]]; // Use medium timeout if no fallback

    console.log(`🔧 [${requestId}]: Device type: ${isEmulator ? 'EMULATOR/SIMULATOR' : 'REAL DEVICE'}`);

    let lastError = null;

    // Try each timeout strategy
    for (let i = 0; i < strategy.length; i++) {
      const attempt = strategy[i];
      const isLastAttempt = i === strategy.length - 1;

      if (onProgress) {
        onProgress({
          phase: `attempt_${i + 1}`,
          message: `Attempting GPS (${attempt.name})...`,
          isLastAttempt,
          attemptNumber: i + 1,
          totalAttempts: strategy.length
        });
      }

      try {
        console.log(`📡 [${requestId}]: GPS attempt ${i + 1}/${strategy.length} (${attempt.name}: ${attempt.timeout}ms timeout)`);

        const location = await this._attemptGPSLocation(requestId, attempt, isEmulator, enableHighAccuracy);

        if (this._validateLocation(location)) {
          console.log(`✅ [${requestId}]: GPS successful on attempt ${i + 1}`);

          if (onProgress) {
            onProgress({
              phase: 'success',
              message: 'Location acquired successfully',
              location
            });
          }

          return await this._formatLocation(location, requestId, `gps_${attempt.name}`, includeAddress);
        } else {
          throw this._createError(this.ERROR_TYPES.GPS_UNAVAILABLE, 'GPS returned invalid coordinates');
        }

      } catch (error) {
        lastError = error;
        console.log(`⚠️ [${requestId}]: GPS attempt ${i + 1} failed: ${error.message}`);

        if (!isLastAttempt && enableProgressiveFallback) {
          const nextAttempt = strategy[i + 1];
          if (onProgress) {
            onProgress({
              phase: 'retry',
              message: `Retrying with ${nextAttempt.name} settings...`,
              error: error.message,
              attemptNumber: i + 1,
              totalAttempts: strategy.length
            });
          }

          // Brief pause before retry
          await this._delay(1000);
        }
      }
    }

    // All attempts failed - throw the last error
    if (onProgress) {
      onProgress({
        phase: 'failed',
        message: 'GPS acquisition failed',
        error: lastError?.message || 'Unknown error'
      });
    }

    throw lastError || this._createError(this.ERROR_TYPES.GPS_UNAVAILABLE, 'All GPS attempts failed');
  }

  /**
   * Attempt GPS location with specific timeout and accuracy
   */
  static async _attemptGPSLocation(requestId, strategy, isEmulator, enableHighAccuracy) {
    const config = {
      accuracy: isEmulator ? Location.Accuracy.Balanced : strategy.accuracy,
      timeout: isEmulator ? Math.min(strategy.timeout, 15000) : strategy.timeout,
      maximumAge: 5000, // Only accept locations younger than 5 seconds
      enableHighAccuracy: enableHighAccuracy && !isEmulator
    };

    console.log(`🛰️ [${requestId}]: GPS config:`, config);

    // Use Promise.race with explicit timeout for better control
    const gpsPromise = Location.getCurrentPositionAsync(config);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(this._createError(this.ERROR_TYPES.TIMEOUT, `GPS timeout after ${config.timeout}ms`));
      }, config.timeout);
    });

    const result = await Promise.race([gpsPromise, timeoutPromise]);
    return result;
  }

  /**
   * Check location permissions
   */
  static async _checkPermissions(requestId) {
    try {
      console.log(`🔐 [${requestId}]: Checking location permissions...`);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        console.log(`✅ [${requestId}]: Location permission granted`);
        return { granted: true };
      }

      const message = status === 'denied'
        ? 'Location permission was denied'
        : `Location permission status: ${status}`;

      console.warn(`⚠️ [${requestId}]: ${message}`);
      return { granted: false, status, message };

    } catch (error) {
      console.error(`❌ [${requestId}]: Permission check failed:`, error);
      return {
        granted: false,
        status: 'error',
        message: `Permission check failed: ${error.message}`
      };
    }
  }

  /**
   * Check if location services are enabled
   */
  static async _checkLocationServices(requestId) {
    try {
      console.log(`🔧 [${requestId}]: Checking location services...`);
      const enabled = await Location.hasServicesEnabledAsync();

      if (enabled) {
        console.log(`✅ [${requestId}]: Location services enabled`);
      } else {
        console.warn(`⚠️ [${requestId}]: Location services disabled`);
      }

      return enabled;
    } catch (error) {
      console.error(`❌ [${requestId}]: Location services check failed:`, error);
      return false;
    }
  }

  /**
   * Simplified emulator detection - only use reliable indicators
   */
  static _isEmulator() {
    try {
      // Only use the most reliable indicator
      const isDevice = Constants.isDevice;
      const deviceName = Constants.deviceName?.toLowerCase() || '';

      // Simple emulator detection
      const isEmulator = !isDevice ||
                        deviceName.includes('emulator') ||
                        deviceName.includes('simulator');

      console.log(`🔍 Device detection: ${isEmulator ? 'EMULATOR/SIMULATOR' : 'REAL DEVICE'} (isDevice: ${isDevice}, deviceName: "${Constants.deviceName}")`);

      return isEmulator;
    } catch (error) {
      console.warn('🔍 Emulator detection failed, assuming real device:', error);
      return false;
    }
  }

  /**
   * Validate GPS coordinates are reasonable
   */
  static _validateLocation(location) {
    if (!location || !location.coords) {
      return false;
    }

    const { latitude, longitude, accuracy } = location.coords;

    // Basic coordinate validation
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn(`⚠️ Invalid coordinates: ${latitude}, ${longitude}`);
      return false;
    }

    // Check for null island (0,0) - usually indicates GPS failure
    if (latitude === 0 && longitude === 0) {
      console.warn(`⚠️ Null island coordinates detected - likely GPS failure`);
      return false;
    }

    // Check for extremely poor accuracy (> 10km)
    if (accuracy && accuracy > 10000) {
      console.warn(`⚠️ Very poor GPS accuracy: ${accuracy}m`);
      return false;
    }

    return true;
  }

  /**
   * Format location result consistently with optional reverse geocoding
   */
  static async _formatLocation(locationResult, requestId, source, includeAddress = false) {
    const { coords, timestamp } = locationResult;

    const baseLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      lat: coords.latitude, // For compatibility with existing code
      lon: coords.longitude, // For compatibility with existing code
      accuracy: coords.accuracy,
      altitude: coords.altitude || null,
      heading: coords.heading || null,
      speed: coords.speed || null,
      timestamp: timestamp || Date.now(),
      source: source,
      requestId: requestId,
      acquisitionTime: Date.now()
    };

    // Add reverse geocoding if requested
    if (includeAddress) {
      try {
        const address = await this._reverseGeocode(coords.latitude, coords.longitude, requestId);
        baseLocation.display_name = address;
      } catch (error) {
        console.warn(`⚠️ [${requestId}]: Reverse geocoding failed, using coordinates`);
        baseLocation.display_name = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}, Malaysia`;
      }
    } else {
      // Provide coordinates as fallback
      baseLocation.display_name = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}, Malaysia`;
    }

    return baseLocation;
  }

  /**
   * Reverse geocode coordinates to human-readable address with caching
   */
  static async _reverseGeocode(latitude, longitude, requestId) {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

    // Check cache first (cache for 15 minutes)
    if (this.addressCache.has(cacheKey)) {
      const cached = this.addressCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 15 * 60 * 1000) {
        console.log(`📍 [${requestId}]: Using cached address for ${cacheKey}`);
        return cached.address;
      } else {
        this.addressCache.delete(cacheKey);
      }
    }

    console.log(`🗺️ [${requestId}]: Reverse geocoding ${latitude}, ${longitude}`);

    try {
      // Use expo-location's built-in reverse geocoding
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      console.log(`🔍 [${requestId}]: Raw geocoding result:`, JSON.stringify(addresses, null, 2));

      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        console.log(`📍 [${requestId}]: Processing address object:`, {
          formattedAddress: address.formattedAddress,
          name: address.name,
          street: address.street,
          city: address.city,
          district: address.district,
          region: address.region,
          subregion: address.subregion,
          country: address.country,
          postalCode: address.postalCode,
          isoCountryCode: address.isoCountryCode
        });

        let readableAddress;

        // Priority 1: Use formattedAddress if available (most reliable)
        if (address.formattedAddress && address.formattedAddress.trim()) {
          readableAddress = address.formattedAddress.trim();
          console.log(`✅ [${requestId}]: Using formattedAddress: ${readableAddress}`);
        } else {
          // Priority 2: Build address from components for Malaysian context
          const addressParts = [];

          // Add street/name info
          if (address.name && address.name.trim()) {
            addressParts.push(address.name.trim());
          } else if (address.street && address.street.trim()) {
            addressParts.push(address.street.trim());
          }

          // Add area info (district preferred over city for Malaysia)
          if (address.district && address.district.trim()) {
            addressParts.push(address.district.trim());
          } else if (address.city && address.city.trim()) {
            addressParts.push(address.city.trim());
          }

          // Add region/state info
          if (address.region && address.region.trim()) {
            addressParts.push(address.region.trim());
          } else if (address.subregion && address.subregion.trim()) {
            addressParts.push(address.subregion.trim());
          }

          // Add postal code if available
          if (address.postalCode && address.postalCode.trim()) {
            addressParts.push(address.postalCode.trim());
          }

          // Add country
          if (address.country && address.country.trim()) {
            addressParts.push(address.country.trim());
          } else {
            addressParts.push('Malaysia'); // Default for Malaysian coordinates
          }

          readableAddress = addressParts.length > 0
            ? addressParts.join(', ')
            : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}, Malaysia`;

          console.log(`🔧 [${requestId}]: Built address from components: ${readableAddress}`);
          console.log(`📋 [${requestId}]: Address parts used:`, addressParts);
        }

        // Cache the result
        this.addressCache.set(cacheKey, {
          address: readableAddress,
          timestamp: Date.now()
        });

        console.log(`✅ [${requestId}]: Final reverse geocoded address: ${readableAddress}`);
        return readableAddress;
      } else {
        console.warn(`⚠️ [${requestId}]: No addresses returned from geocoding API`);
        throw new Error('No address found');
      }
    } catch (error) {
      console.warn(`⚠️ [${requestId}]: Reverse geocoding failed:`, error.message);
      // Return coordinates as fallback
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}, Malaysia`;
    }
  }

  /**
   * Create enhanced error with type and user-friendly message
   */
  static _createError(type, message, originalError = null) {
    const error = new Error(message);
    error.type = type;
    error.originalError = originalError;
    error.userFriendlyMessage = this._getUserFriendlyMessage(type, message);
    return error;
  }

  /**
   * Enhance existing error with better information
   */
  static _enhanceError(error, requestId) {
    const message = error.message?.toLowerCase() || '';
    let type = this.ERROR_TYPES.UNKNOWN;

    // Classify error type
    if (message.includes('permission') || message.includes('denied')) {
      type = this.ERROR_TYPES.PERMISSION_DENIED;
    } else if (message.includes('timeout') || message.includes('timed out')) {
      type = this.ERROR_TYPES.TIMEOUT;
    } else if (message.includes('disabled') || message.includes('unavailable')) {
      type = this.ERROR_TYPES.LOCATION_DISABLED;
    } else if (message.includes('network') || message.includes('connection')) {
      type = this.ERROR_TYPES.NETWORK_ERROR;
    } else if (message.includes('gps') || message.includes('location')) {
      type = this.ERROR_TYPES.GPS_UNAVAILABLE;
    }

    return this._createError(type, error.message, error);
  }

  /**
   * Get user-friendly error message
   */
  static _getUserFriendlyMessage(type, originalMessage) {
    const platform = Constants.platform;

    switch (type) {
      case this.ERROR_TYPES.PERMISSION_DENIED:
        return {
          title: 'Location Permission Required',
          message: 'FloodAid needs location access to provide accurate flood predictions.',
          suggestion: platform?.ios
            ? 'Go to Settings > Privacy & Security > Location Services > FloodAid and select "While Using App".'
            : 'Go to Settings > Apps > FloodAid > Permissions > Location and enable.',
          canRetry: false,
          showManualOption: true
        };

      case this.ERROR_TYPES.TIMEOUT:
        return {
          title: 'GPS Signal Timeout',
          message: 'Your device is taking longer than expected to get a GPS signal.',
          suggestion: 'Try moving to an open area away from buildings, or use manual location.',
          canRetry: true,
          showManualOption: true
        };

      case this.ERROR_TYPES.LOCATION_DISABLED:
        return {
          title: 'Location Services Disabled',
          message: 'GPS or location services are turned off on your device.',
          suggestion: platform?.ios
            ? 'Enable Location Services in Settings > Privacy & Security > Location Services.'
            : 'Enable Location in Settings > Location.',
          canRetry: false,
          showManualOption: true
        };

      case this.ERROR_TYPES.GPS_UNAVAILABLE:
        return {
          title: 'GPS Unavailable',
          message: 'Unable to get your location due to poor GPS signal or hardware issues.',
          suggestion: 'Try moving outdoors or use manual location input.',
          canRetry: true,
          showManualOption: true
        };

      default:
        return {
          title: 'Location Unavailable',
          message: 'Unable to determine your location automatically.',
          suggestion: 'Please provide your location manually or try again.',
          canRetry: true,
          showManualOption: true
        };
    }
  }

  /**
   * Utility methods
   */
  static _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add location listener
   */
  static addLocationListener(callback) {
    this.listeners.add(callback);
    console.log(`📡 Added location listener (${this.listeners.size} total)`);
  }

  /**
   * Remove location listener
   */
  static removeLocationListener(callback) {
    const removed = this.listeners.delete(callback);
    if (removed) {
      console.log(`📡 Removed location listener (${this.listeners.size} remaining)`);
    }
  }

  /**
   * Notify all listeners of location update
   */
  static _notifyListeners(location) {
    if (this.listeners.size === 0) return;

    console.log(`📡 Notifying ${this.listeners.size} location listeners`);
    this.listeners.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('📡 Error in location listener:', error);
      }
    });
  }

  /**
   * Check if location services are available
   */
  static async hasLocationPermission() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Get last known valid location
   */
  static getLastValidLocation() {
    return this.lastValidLocation;
  }

  /**
   * Cancel any ongoing location request
   */
  static cancelCurrentRequest() {
    if (this.currentRequest) {
      console.log('🚫 Cancelling current location request...');
      this.currentRequest = null;
      return true;
    }
    return false;
  }

  /**
   * Get service statistics
   */
  static getStats() {
    return {
      hasOngoingRequest: this.currentRequest !== null,
      listenerCount: this.listeners.size,
      lastValidLocation: this.lastValidLocation,
      requestCounter: this.requestCounter
    };
  }
}

export default ReliableLocationService;