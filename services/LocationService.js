// services/LocationService.js
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import LocationCache from './LocationCache';

// Google Maps API Key from app configuration
const GOOGLE_MAPS_API_KEY = 'AIzaSyC-0v96Q4G43rh8tuLfzTaACTfVA-oSwGM';

class LocationService {
  // Static tracking for active GPS requests
  static activeRequests = new Map();
  
  // Singleton promise for ongoing location requests
  static ongoingLocationRequest = null;
  
  // Performance metrics
  static performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    gpsAcquisitions: 0,
    averageGpsTime: 0,
    failureRate: 0
  };
  
  /**
   * Detect if running in emulator/simulator
   * Improved detection for Expo Go on real devices
   */
  static isEmulator() {
    // Enhanced emulator detection logic with Expo Go consideration
    const deviceName = Constants.deviceName?.toLowerCase() || '';
    const modelName = Constants.deviceModelName?.toLowerCase() || '';
    const appOwnership = Constants.appOwnership; // 'expo', 'standalone', or 'guest'
    
    // Real device indicators (override emulator detection)
    const isRealDeviceIndicator = 
      // If running in Expo Go on a real device, Constants.isDevice should be true
      (appOwnership === 'expo' && Constants.isDevice === true) ||
      // Specific real device model patterns
      (modelName && !modelName.includes('emulator') && !modelName.includes('simulator') && !modelName.includes('sdk'));
    
    const isEmulatorIndicator = 
      // Android emulator indicators
      deviceName.includes('emulator') ||
      deviceName.includes('simulator') ||
      modelName.includes('emulator') ||
      modelName.includes('simulator') ||
      modelName.includes('sdk') ||
      // Specific Android emulator patterns
      deviceName.includes('generic') ||
      deviceName.includes('android_x86') ||
      // iOS simulator indicators  
      (Constants.platform?.ios && Constants.isDevice === false);
    
    // If we have strong real device indicators, override emulator detection
    const isEmulator = isEmulatorIndicator && !isRealDeviceIndicator;
    
    console.log(`🔍 Enhanced emulator detection: ${isEmulator ? 'EMULATOR/SIMULATOR' : 'REAL DEVICE'}`, {
      deviceName: Constants.deviceName,
      modelName: Constants.deviceModelName,
      isDevice: Constants.isDevice,
      appOwnership: Constants.appOwnership,
      platform: Constants.platform,
      isRealDeviceIndicator,
      isEmulatorIndicator,
      finalDecision: isEmulator ? 'EMULATOR' : 'REAL_DEVICE'
    });
    
    return isEmulator;
  }
  
  /**
   * Cancel all active GPS requests
   */
  static cancelAllRequests() {
    const activeCount = this.activeRequests.size;
    console.log(`🚫 LocationService: Cancelling ${activeCount} active GPS request(s)...`);
    
    if (activeCount === 0) {
      console.log('✅ No active GPS requests to cancel');
      return;
    }
    
    for (const [debugId, { progressTimeout, cancelCallback }] of this.activeRequests.entries()) {
      if (progressTimeout) {
        clearInterval(progressTimeout);
        console.log(`🚫 Cancelled GPS request [${debugId}] - no more progress messages`);
      }
      
      // Call cancel callback if available
      if (cancelCallback) {
        try {
          cancelCallback();
          console.log(`🚫 Called cancel callback for GPS request [${debugId}]`);
        } catch (error) {
          console.warn(`⚠️ Error calling cancel callback for [${debugId}]:`, error);
        }
      }
    }
    
    this.activeRequests.clear();
    console.log(`✅ All ${activeCount} GPS request(s) cancelled successfully`);
  }

  /**
   * Cancel specific GPS request by ID
   */
  static cancelRequest(debugId) {
    const requestData = this.activeRequests.get(debugId);
    if (!requestData) {
      console.log(`ℹ️ GPS request [${debugId}] not found in active requests`);
      return false;
    }
    
    const { progressTimeout, cancelCallback } = requestData;
    
    if (progressTimeout) {
      clearInterval(progressTimeout);
    }
    
    if (cancelCallback) {
      try {
        cancelCallback();
      } catch (error) {
        console.warn(`⚠️ Error calling cancel callback for [${debugId}]:`, error);
      }
    }
    
    this.activeRequests.delete(debugId);
    console.log(`🚫 Cancelled GPS request [${debugId}]`);
    return true;
  }

  /**
   * Get user-friendly error message for GPS failures
   */
  static getLocationErrorMessage(error, debugId) {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Check for specific error patterns and return user-friendly messages
    if (errorMessage.includes('timeout')) {
      return {
        title: 'GPS Timeout',
        message: 'Location request took longer than expected. Using cached or default location instead.',
        suggestion: 'Try moving to an area with better GPS signal or enable "Skip GPS" in developer settings.',
        isRecoverable: true
      };
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      return {
        title: 'Location Permission Required',
        message: 'FloodAid needs location access to provide accurate flood predictions.',
        suggestion: 'Please enable location permissions in your device settings.',
        isRecoverable: true
      };
    }
    
    if (errorMessage.includes('cancelled')) {
      return {
        title: 'Location Request Cancelled',
        message: 'GPS request was cancelled. Using fallback location.',
        suggestion: 'This is normal when switching between GPS modes.',
        isRecoverable: true
      };
    }
    
    if (errorMessage.includes('unavailable') || errorMessage.includes('disabled')) {
      return {
        title: 'Location Services Disabled',
        message: 'GPS or location services are turned off on your device.',
        suggestion: 'Please enable location services in your device settings.',
        isRecoverable: true
      };
    }
    
    // Generic GPS failure
    return {
      title: 'GPS Unavailable',
      message: 'Unable to determine your exact location. Using fallback location for flood predictions.',
      suggestion: 'Predictions may be less accurate. Try moving to an open area or restarting the app.',
      isRecoverable: true
    };
  }
  
  /**
   * Get user's current GPS location with optimized caching and request deduplication
   */
  static async getCurrentLocation(skipGPS = false, priority = 'normal') {
    const debugId = Date.now();
    const isEmulatorDevice = this.isEmulator();
    
    this.performanceMetrics.totalRequests++;
    console.log(`📍 LocationService [${debugId}]: ${skipGPS ? 'SKIPPING GPS' : 'Requesting location'} (priority: ${priority})...`);
    
    // Check for ongoing request and return same promise for deduplication
    if (!skipGPS && this.ongoingLocationRequest && priority !== 'high') {
      console.log(`⏳ [${debugId}]: Joining ongoing GPS request...`);
      try {
        const result = await this.ongoingLocationRequest;
        return { ...result, debugId, isDeduplicated: true };
      } catch (error) {
        console.log(`⚠️ [${debugId}]: Ongoing request failed, starting new one`);
      }
    }
    
    // Try cached location first with tiered strategy
    if (!skipGPS) {
      const cacheType = priority === 'background' ? 'VALID' : 'FRESH';
      const cachedLocation = await LocationCache.getLocationFromCache(cacheType);
      if (cachedLocation) {
        this.performanceMetrics.cacheHits++;
        console.log(`⚡ [${debugId}]: Using cached location (${Math.round(cachedLocation.cacheAge/1000)}s old)`);
        return {
          ...cachedLocation,
          debugId
        };
      }
    }
    
    // Cancel any existing requests before starting new one
    if (this.activeRequests.size > 0) {
      console.log(`🚫 [${debugId}]: Cancelling ${this.activeRequests.size} existing GPS requests...`);
      this.cancelAllRequests();
    }
    
    // Skip GPS if requested - immediately return cached or default location
    if (skipGPS) {
      console.log(`⚡ [${debugId}]: Skip GPS enabled - using cached/default location`);
      
      // Try cached location first
      const cachedLocation = await this.getCachedLocation();
      if (cachedLocation) {
        console.log(`✅ [${debugId}]: Using cached location:`, cachedLocation);
        return {
          ...cachedLocation,
          isCached: true,
          isSkippedGPS: true,
          debugId
        };
      }
      
      // Fallback to default Puchong location
      console.log(`🏠 [${debugId}]: No cached location, using default Puchong coordinates`);
      const defaultLocation = {
        lat: 3.0738,
        lon: 101.5183,
        accuracy: null,
        timestamp: Date.now(),
        isDefault: true,
        isSkippedGPS: true,
        debugId
      };
      
      await this.cacheLocation(defaultLocation);
      return defaultLocation;
    }
    
    // Optimized GPS configuration with tiered timeout strategy
    const gpsConfigs = {
      fast: {
        timeout: isEmulatorDevice ? 3000 : 5000,
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 120000, // Accept up to 2 minutes old
        enableHighAccuracy: false
      },
      normal: {
        timeout: isEmulatorDevice ? 8000 : 15000,
        accuracy: isEmulatorDevice ? Location.Accuracy.Balanced : Location.Accuracy.High,
        maximumAge: 60000, // Accept up to 1 minute old
        enableHighAccuracy: !isEmulatorDevice
      },
      thorough: {
        timeout: isEmulatorDevice ? 15000 : 30000,
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 10000, // Only accept recent readings
        enableHighAccuracy: true
      }
    };
    
    const gpsConfig = gpsConfigs[priority] || gpsConfigs.normal;
    const progressInterval = 6000; // 6 seconds for progress updates
    
    console.log(`🔧 GPS Configuration: ${isEmulatorDevice ? 'EMULATOR MODE' : 'DEVICE MODE'}`, gpsConfig);
    
    try {
      // Request location permissions
      console.log(`🔐 [${debugId}]: Calling requestForegroundPermissionsAsync()`);
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log(`🔐 [${debugId}]: Permission status: ${status}`);
      
      if (status !== 'granted') {
        console.warn('⚠️ Location permission denied');
        throw new Error('Location permission denied');
      }
      
      console.log('✅ Location permission granted');
      
      // Initialize tracking variables for GPS acquisition
      let isCancelled = false;
      let progressTimeout = null;
      
      // Track this request for potential cancellation
      this.activeRequests.set(debugId, {
        progressTimeout: null,
        cancelCallback: () => {
          isCancelled = true;
          if (progressTimeout) {
            clearInterval(progressTimeout);
          }
        }
      });
      
      // Create the GPS acquisition promise
      const gpsPromise = (async () => {
        console.log(`📡 [${debugId}]: Starting GPS acquisition with ${gpsConfig.timeout}ms timeout...`);
        
        // Set up progress tracking
        let progressCounter = 0;
        progressTimeout = setInterval(() => {
          if (!isCancelled) {
            progressCounter++;
            console.log(`📡 [${debugId}]: GPS acquisition in progress... (${progressCounter * progressInterval / 1000}s)`);
          }
        }, progressInterval);
        
        // Update the tracking data with the timeout reference
        const requestData = this.activeRequests.get(debugId);
        if (requestData) {
          requestData.progressTimeout = progressTimeout;
        }
        
        // Perform the actual GPS location request
        const locationResult = await Location.getCurrentPositionAsync({
          accuracy: gpsConfig.accuracy,
          timeout: gpsConfig.timeout,
          maximumAge: gpsConfig.maximumAge,
          enableHighAccuracy: gpsConfig.enableHighAccuracy
        });
        
        return locationResult;
      })();
      
      if (!skipGPS && priority !== 'background') {
        this.ongoingLocationRequest = gpsPromise;
        
        // Clear the ongoing request when done
        gpsPromise.finally(() => {
          if (this.ongoingLocationRequest === gpsPromise) {
            this.ongoingLocationRequest = null;
          }
        });
      }
      
      const location = await gpsPromise;
      
      // Check if request was cancelled during GPS acquisition
      if (isCancelled) {
        console.log(`🚫 [${debugId}]: GPS request was cancelled, ignoring result`);
        throw new Error(`GPS request cancelled [${debugId}]`);
      }
      
      // Clean up tracking
      if (progressTimeout) {
        clearInterval(progressTimeout);
      }
      this.activeRequests.delete(debugId);
      console.log(`📡 [${debugId}]: getCurrentPositionAsync() completed successfully`);
      console.log(`📡 [${debugId}]: Raw location:`, location.coords);
      
      const coordinates = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      };
      
      console.log('📍 Current location obtained:', coordinates);
      
      // Cache the location using optimized cache
      await LocationCache.cacheLocation(coordinates);
      this.performanceMetrics.gpsAcquisitions++;
      
      return coordinates;
      
    } catch (error) {
      // Ensure cleanup happens regardless of how timeout fails
      const requestData = this.activeRequests.get(debugId);
      if (requestData && requestData.progressTimeout) {
        clearInterval(requestData.progressTimeout);
        this.activeRequests.delete(debugId);
        console.log(`🧹 [${debugId}]: Cleaned up failed GPS request`);
      }
      
      // Log timeout-specific information for debugging
      if (error.message && error.message.includes('timeout')) {
        console.log(`⏰ [${debugId}]: GPS timeout occurred (likely emulator/simulator) - falling back to cached/default location`);
      }
      
      console.error(`❌ [${debugId}]: GPS location failed:`, error.message);
      console.error(`❌ [${debugId}]: Error type: ${error.name || 'Unknown'}`);
      
      // Get user-friendly error message
      const friendlyError = this.getLocationErrorMessage(error, debugId);
      console.log(`💬 [${debugId}]: User-friendly error: ${friendlyError.title} - ${friendlyError.message}`);
      
      // Check if it's a timeout specifically
      if (error.message && error.message.includes('timeout')) {
        console.log(`⏰ [${debugId}]: GPS timeout occurred, trying fallback methods...`);
      }
      
      // Try to return cached location as fallback
      console.log(`🔄 [${debugId}]: Attempting to use cached location...`);
      const cachedLocation = await this.getCachedLocation();
      if (cachedLocation) {
        console.log(`✅ [${debugId}]: Using cached location as fallback:`, cachedLocation);
        return {
          ...cachedLocation,
          isCached: true,
          debugId
        };
      }
      console.log(`❌ [${debugId}]: No cached location available`);
      
      // Ultimate fallback: Puchong coordinates (Alice Chen's location)
      console.log(`🏠 [${debugId}]: Using default Puchong coordinates as final fallback`);
      const defaultLocation = {
        lat: 3.0738,
        lon: 101.5183,
        accuracy: null,
        timestamp: Date.now(),
        isDefault: true,
        debugId
      };
      
      // Cache this default location for next time
      await LocationCache.cacheLocation(defaultLocation);
      this.updatePerformanceMetrics('failure');
      
      return defaultLocation;
    }
  }

  /**
   * Get Malaysian state from coordinates using optimized offline-first approach
   */
  static async getStateFromCoordinates(lat, lon) {
    console.log(`🗺️ Getting state for coordinates: ${lat}, ${lon}`);
    
    try {
      // Try offline detection first (much faster)
      const offlineState = LocationCache.getStateFromCoordinates(lat, lon);
      if (offlineState !== 'Selangor') { // Only fallback to API if not default
        return offlineState;
      }
      
      // For Selangor default, verify with API (but don't block on it)
      const cacheKey = `state_${lat.toFixed(4)}_${lon.toFixed(4)}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;
        
        if (age < 24 * 60 * 60 * 1000) {
          console.log('🔄 Using cached API state:', parsedCache.state);
          return parsedCache.state;
        }
      }
      
      // Background API verification (non-blocking)
      this.verifyStateWithAPI(lat, lon, cacheKey).catch(error => {
        console.warn('Background API verification failed:', error);
      });
      
      return offlineState;
      
    } catch (error) {
      console.error('❌ Error getting state:', error);
      return 'Selangor';
    }
  }
  
  /**
   * Background API verification for state detection
   */
  static async verifyStateWithAPI(lat, lon, cacheKey) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK') {
      const state = this.extractMalaysianState(data.results);
      
      // Cache for future use
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        state,
        timestamp: Date.now()
      }));
      
      console.log('🏛️ Background API verified state:', state);
    }
  }

  /**
   * Extract Malaysian state from Google Maps geocoding results
   */
  static extractMalaysianState(results) {
    const malaysianStates = [
      'Selangor', 'Kuala Lumpur', 'Johor', 'Kedah', 'Kelantan', 'Melaka', 
      'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah', 
      'Sarawak', 'Terengganu', 'Putrajaya', 'Labuan'
    ];
    
    for (const result of results) {
      for (const component of result.address_components) {
        // Check if this component is a state
        if (component.types.includes('administrative_area_level_1')) {
          const stateName = component.long_name;
          
          // Find matching Malaysian state
          const matchedState = malaysianStates.find(state => 
            stateName.toLowerCase().includes(state.toLowerCase()) ||
            state.toLowerCase().includes(stateName.toLowerCase())
          );
          
          if (matchedState) {
            return matchedState;
          }
        }
      }
    }
    
    // Fallback: if no state found in components, look in formatted address
    for (const result of results) {
      const address = result.formatted_address.toLowerCase();
      
      for (const state of malaysianStates) {
        if (address.includes(state.toLowerCase())) {
          return state;
        }
      }
    }
    
    return 'Unknown';
  }

  /**
   * Legacy fallback method - now delegates to LocationCache
   */
  static getStateFromCoordinatesFallback(lat, lon) {
    return LocationCache.getStateFromCoordinates(lat, lon);
  }

  /**
   * Get location display name (city, state) for UI
   */
  static async getLocationDisplayName(lat, lon) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        
        // Extract city and state
        let city = 'Unknown';
        let state = 'Unknown';
        
        for (const component of result.address_components) {
          if (component.types.includes('locality') || component.types.includes('sublocality')) {
            city = component.long_name;
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
        }
        
        return `${city}, ${state}`;
      }
      
    } catch (error) {
      console.error('Error getting display name:', error);
    }
    
    // Fallback
    const state = await this.getStateFromCoordinates(lat, lon);
    return `${state}, Malaysia`;
  }

  /**
   * Cache location data - delegates to LocationCache
   */
  static async cacheLocation(location) {
    await LocationCache.cacheLocation(location);
  }

  /**
   * Get cached location - delegates to LocationCache
   */
  static async getCachedLocation() {
    return await LocationCache.getLocationFromCache('STALE_ACCEPTABLE');
  }

  /**
   * Check if coordinates are within Malaysia boundaries - optimized version
   */
  static isLocationInMalaysia(lat, lon) {
    return LocationCache.isLocationInMalaysia(lat, lon);
  }

  /**
   * Find nearest Malaysian location - now delegates to optimized LocationCache
   */
  static findNearestMalaysianLocation(lat, lon) {
    return LocationCache.findNearestMalaysianLocation(lat, lon);
  }

  /**
   * Calculate Euclidean distance between two coordinates
   */
  static calculateEuclideanDistance(lat1, lon1, lat2, lon2) {
    return LocationCache.calculateDistance(lat1, lon1, lat2, lon2);
  }

  /**
   * Get location with Malaysia validation and nearest location fallback
   */
  static async getCurrentLocationWithMalaysiaCheck(skipGPS = false) {
    console.log('📍 LocationService: Getting location with Malaysia validation...');
    
    try {
      // Get current location
      const location = await this.getCurrentLocation(skipGPS);
      
      // Check if location is in Malaysia
      if (this.isLocationInMalaysia(location.lat, location.lon)) {
        console.log('✅ Location is within Malaysia boundaries');
        return location;
      }

      console.log('⚠️ Location is outside Malaysia, finding nearest Malaysian area...');
      
      // Find nearest Malaysian location
      const nearestCity = this.findNearestMalaysianLocation(location.lat, location.lon);
      
      // Return the nearest Malaysian location with original location info
      return {
        lat: nearestCity.lat,
        lon: nearestCity.lon,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        originalLocation: {
          lat: location.lat,
          lon: location.lon,
          name: await this.getLocationDisplayName(location.lat, location.lon)
        },
        nearestMalaysianLocation: {
          lat: nearestCity.lat,
          lon: nearestCity.lon,
          name: nearestCity.name,
          state: nearestCity.state
        },
        isRedirected: true
      };
      
    } catch (error) {
      console.error('❌ Error getting Malaysia-validated location:', error);
      throw error;
    }
  }

  /**
   * Check if location services are available
   */
  static async isLocationAvailable() {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      return enabled;
    } catch (error) {
      console.error('Error checking location availability:', error);
      return false;
    }
  }

  /**
   * Watch location changes (for real-time updates)
   */
  static async watchLocation(callback, options = {}) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission required for watching');
      }

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: options.interval || 300000, // 5 minutes default
          distanceInterval: options.distance || 100, // 100 meters
        },
        (location) => {
          callback({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp
          });
        }
      );
      
    } catch (error) {
      console.error('Error watching location:', error);
      throw error;
    }
  }
  
  /**
   * Update performance metrics
   */
  static updatePerformanceMetrics(result, gpsTime = null) {
    if (result === 'success' && gpsTime) {
      const currentAvg = this.performanceMetrics.averageGpsTime;
      const count = this.performanceMetrics.gpsAcquisitions;
      this.performanceMetrics.averageGpsTime = 
        (currentAvg * count + gpsTime) / (count + 1);
    } else if (result === 'failure') {
      this.performanceMetrics.failureRate = 
        (this.performanceMetrics.failureRate * this.performanceMetrics.totalRequests + 1) / 
        (this.performanceMetrics.totalRequests + 1);
    }
  }
  
  /**
   * Get performance statistics
   */
  static getPerformanceStats() {
    const cacheStats = LocationCache.getCacheStats();
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.performanceMetrics.totalRequests > 0 ? 
        this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests : 0,
      ...cacheStats
    };
  }
  
  /**
   * Clean up expired data and optimize performance
   */
  static optimizePerformance() {
    LocationCache.cleanExpiredCache();
    console.log('🚀 LocationService performance optimized');
  }
}

export default LocationService;