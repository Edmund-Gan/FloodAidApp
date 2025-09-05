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
  
  // Background location watching
  static backgroundLocationWatcher = null;
  static backgroundLocationCallbacks = new Set();
  
  /**
   * Detect if running in emulator/simulator with improved reliability
   */
  static async isEmulator() {
    try {
      const deviceName = Constants.deviceName?.toLowerCase() || '';
      const modelName = Constants.deviceModelName?.toLowerCase() || '';
      const appOwnership = Constants.appOwnership; // 'expo', 'standalone', or 'guest'
      const platform = Constants.platform;
      
      // Check for manual override from AsyncStorage (for development)
      const manualOverride = await this.getManualEmulatorOverride();
      if (manualOverride !== null) {
        console.log(`🔍 Manual emulator override: ${manualOverride ? 'EMULATOR' : 'REAL_DEVICE'}`);
        return manualOverride;
      }
      
      // Strong real device indicators
      const realDeviceIndicators = [
        // Expo Go on real device with proper device detection
        appOwnership === 'expo' && Constants.isDevice === true,
        // Real device model names (not containing emulator keywords)
        modelName && 
          !modelName.includes('emulator') && 
          !modelName.includes('simulator') && 
          !modelName.includes('sdk') &&
          !modelName.includes('generic') &&
          !modelName.includes('android_x86'),
        // iOS real device
        platform?.ios && Constants.isDevice === true,
        // Android real device with proper brand/manufacturer
        platform?.android && Constants.isDevice === true && 
          (deviceName.includes('samsung') || deviceName.includes('huawei') || 
           deviceName.includes('xiaomi') || deviceName.includes('oppo') ||
           deviceName.includes('vivo') || deviceName.includes('oneplus'))
      ];
      
      // Emulator indicators
      const emulatorIndicators = [
        // Generic Android emulator patterns
        deviceName.includes('emulator'),
        deviceName.includes('simulator'),
        deviceName.includes('generic'),
        deviceName.includes('android_x86'),
        deviceName.includes('google_sdk'),
        // Model name patterns
        modelName.includes('emulator'),
        modelName.includes('simulator'),
        modelName.includes('sdk'),
        // iOS simulator
        platform?.ios && Constants.isDevice === false,
        // Android Studio emulator specific
        deviceName.includes('avd') || modelName.includes('avd')
      ];
      
      const hasRealDeviceIndicator = realDeviceIndicators.some(indicator => indicator);
      const hasEmulatorIndicator = emulatorIndicators.some(indicator => indicator);
      
      // Prioritize real device indicators
      const isEmulator = hasEmulatorIndicator && !hasRealDeviceIndicator;
      
      console.log(`🔍 Improved emulator detection: ${isEmulator ? 'EMULATOR/SIMULATOR' : 'REAL DEVICE'}`, {
        deviceName: Constants.deviceName,
        modelName: Constants.deviceModelName,
        isDevice: Constants.isDevice,
        appOwnership: Constants.appOwnership,
        platform: Constants.platform,
        hasRealDeviceIndicator,
        hasEmulatorIndicator,
        finalDecision: isEmulator ? 'EMULATOR' : 'REAL_DEVICE'
      });
      
      return isEmulator;
      
    } catch (error) {
      console.warn('🔍 Emulator detection failed, assuming real device:', error);
      return false; // Default to real device when detection fails
    }
  }
  
  /**
   * Get manual emulator override from developer settings
   */
  static async getManualEmulatorOverride() {
    try {
      const settings = await AsyncStorage.getItem('locationDebugSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return parsed.forceEmulatorMode;
      }
    } catch (error) {
      console.warn('Failed to read manual emulator override:', error);
    }
    return null;
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
   * Get user-friendly error message for GPS failures with enhanced error handling
   */
  static getLocationErrorMessage(error, debugId) {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || '';
    const platform = Constants.platform;
    
    console.log(`🔍 [${debugId}]: Analyzing error - Message: "${errorMessage}", Code: "${errorCode}"`);
    
    // Timeout errors - most common on real devices
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        title: 'GPS Timeout',
        message: 'Location request took longer than expected. This is common indoors or in areas with poor GPS signal.',
        suggestion: 'Try moving outdoors, restarting location services, or use retry mode in settings.',
        isRecoverable: true,
        retryRecommended: true
      };
    }
    
    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('denied') || 
        errorMessage.includes('not authorized') || errorCode.includes('PERMISSION')) {
      return {
        title: 'Location Permission Required',
        message: 'FloodAid needs location access to provide accurate flood predictions.',
        suggestion: platform?.ios ? 
          'Go to Settings > Privacy & Security > Location Services > FloodAid and select "While Using App".' :
          'Go to Settings > Apps > FloodAid > Permissions > Location and enable.',
        isRecoverable: true,
        retryRecommended: false
      };
    }
    
    // Request cancelled
    if (errorMessage.includes('cancelled') || errorMessage.includes('canceled') ||
        errorMessage.includes('aborted') || errorCode.includes('CANCELLED')) {
      return {
        title: 'Location Request Cancelled',
        message: 'GPS request was cancelled, likely due to a newer request starting.',
        suggestion: 'This is normal. The app will use cached or retry automatically.',
        isRecoverable: true,
        retryRecommended: false
      };
    }
    
    // Location services disabled
    if (errorMessage.includes('unavailable') || errorMessage.includes('disabled') ||
        errorMessage.includes('service') || errorCode.includes('UNAVAILABLE')) {
      return {
        title: 'Location Services Disabled',
        message: 'GPS or location services are turned off on your device.',
        suggestion: platform?.ios ?
          'Enable Location Services in Settings > Privacy & Security > Location Services.' :
          'Enable Location in Settings > Location.',
        isRecoverable: true,
        retryRecommended: false
      };
    }
    
    // Network/API related errors
    if (errorMessage.includes('network') || errorMessage.includes('connection') ||
        errorMessage.includes('internet') || errorCode.includes('NETWORK')) {
      return {
        title: 'Network Error',
        message: 'Unable to connect to location services due to network issues.',
        suggestion: 'Check your internet connection and try again.',
        isRecoverable: true,
        retryRecommended: true
      };
    }
    
    // GPS hardware/signal issues
    if (errorMessage.includes('accuracy') || errorMessage.includes('signal') ||
        errorMessage.includes('satellite') || errorCode.includes('ACCURACY')) {
      return {
        title: 'Poor GPS Signal',
        message: 'GPS signal is too weak to get accurate location.',
        suggestion: 'Move to an open area away from buildings and try again.',
        isRecoverable: true,
        retryRecommended: true
      };
    }
    
    // Expo-specific errors
    if (errorMessage.includes('expo') || errorMessage.includes('unimodule')) {
      return {
        title: 'Location Service Error',
        message: 'There was an issue with the location service module.',
        suggestion: 'Try restarting the app or updating Expo Go.',
        isRecoverable: true,
        retryRecommended: true
      };
    }
    
    // Generic GPS failure with enhanced context
    return {
      title: 'GPS Unavailable',
      message: 'Unable to determine your exact location. Using fallback location for flood predictions.',
      suggestion: 'Try moving to an open area, check location permissions, or restart the app. If in emulator, try using a physical device for testing.',
      isRecoverable: true,
      retryRecommended: true
    };
  }
  
  /**
   * Get user's current GPS location with progressive retry logic
   */
  static async getCurrentLocationWithRetry(skipGPS = false, maxRetries = 3) {
    const priorities = ['fast', 'normal', 'thorough'];
    const debugId = Date.now();
    
    console.log(`📍 LocationService [${debugId}]: Starting GPS with retry logic (maxRetries: ${maxRetries})`);
    
    if (skipGPS) {
      return this.getCurrentLocation(true, 'fast');
    }
    
    for (let attempt = 0; attempt < maxRetries && attempt < priorities.length; attempt++) {
      const priority = priorities[attempt];
      console.log(`📍 [${debugId}]: GPS attempt ${attempt + 1}/${maxRetries} with ${priority} priority`);
      
      try {
        const result = await this.getCurrentLocation(false, priority);
        console.log(`SUCCESS [${debugId}]: GPS succeeded on attempt ${attempt + 1} with ${priority} priority`);
        return result;
        
      } catch (error) {
        console.log(`RETRY [${debugId}]: GPS attempt ${attempt + 1} failed with ${priority} priority: ${error.message}`);
        
        // If this is not the last attempt, continue to next priority level
        if (attempt < maxRetries - 1 && attempt < priorities.length - 1) {
          console.log(`RETRY [${debugId}]: Retrying with higher priority level...`);
          
          // Wait a short time before retry to allow GPS to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Last attempt failed, fall back to cached/default
        console.log(`FALLBACK [${debugId}]: All GPS attempts failed, using cached/default location`);
        
        // Try cached location
        const cachedLocation = await this.getCachedLocation();
        if (cachedLocation) {
          console.log(`FALLBACK [${debugId}]: Using cached location`);
          return {
            ...cachedLocation,
            isCached: true,
            debugId,
            fallbackReason: 'GPS retries exhausted'
          };
        }
        
        // Ultimate fallback
        console.log(`FALLBACK [${debugId}]: Using default Puchong coordinates`);
        const defaultLocation = {
          lat: 3.0738,
          lon: 101.5183,
          accuracy: null,
          timestamp: Date.now(),
          isDefault: true,
          debugId,
          fallbackReason: 'GPS and cache unavailable'
        };
        
        await this.cacheLocation(defaultLocation);
        return defaultLocation;
      }
    }
  }

  /**
   * Get user's current GPS location with optimized caching and request deduplication
   */
  static async getCurrentLocation(skipGPS = false, priority = 'normal') {
    const debugId = Date.now();
    const isEmulatorDevice = await this.isEmulator();
    
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
    
    // Allow concurrent requests but limit high priority ones
    if (this.activeRequests.size > 0 && priority === 'thorough') {
      console.log(`🚫 [${debugId}]: Cancelling ${this.activeRequests.size} existing requests for high priority GPS...`);
      this.cancelAllRequests();
    } else if (this.activeRequests.size >= 3) {
      console.log(`🚫 [${debugId}]: Too many concurrent GPS requests (${this.activeRequests.size}), cancelling oldest...`);
      const oldestRequest = this.activeRequests.keys().next().value;
      this.cancelRequest(oldestRequest);
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
    
    // Optimized GPS configuration with extended timeout strategy for better reliability
    const gpsConfigs = {
      fast: {
        timeout: isEmulatorDevice ? 5000 : 10000,
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 120000, // Accept up to 2 minutes old
        enableHighAccuracy: false
      },
      normal: {
        timeout: isEmulatorDevice ? 15000 : 30000,
        accuracy: isEmulatorDevice ? Location.Accuracy.Balanced : Location.Accuracy.High,
        maximumAge: 60000, // Accept up to 1 minute old
        enableHighAccuracy: !isEmulatorDevice
      },
      thorough: {
        timeout: isEmulatorDevice ? 30000 : 45000,
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
   * Start background location watching for continuous updates
   */
  static async startBackgroundLocationWatcher(options = {}) {
    if (this.backgroundLocationWatcher) {
      console.log('📡 Background location watcher already active');
      return;
    }
    
    try {
      console.log('📡 Starting background location watcher...');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission required for background watching');
      }
      
      const isEmulator = await this.isEmulator();
      
      this.backgroundLocationWatcher = await Location.watchPositionAsync(
        {
          accuracy: isEmulator ? Location.Accuracy.Balanced : Location.Accuracy.High,
          timeInterval: options.interval || 300000, // 5 minutes default
          distanceInterval: options.distance || 100, // 100 meters
          mayShowUserSettingsDialog: true
        },
        (location) => {
          const processedLocation = {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
            source: 'background_watcher'
          };
          
          console.log('📡 Background location update:', processedLocation);
          
          // Cache the location automatically
          this.cacheLocation(processedLocation);
          
          // Notify all callbacks
          this.backgroundLocationCallbacks.forEach(callback => {
            try {
              callback(processedLocation);
            } catch (error) {
              console.error('📡 Error in background location callback:', error);
            }
          });
        }
      );
      
      console.log('SUCCESS: Background location watcher started');
      
    } catch (error) {
      console.error('ERROR: Failed to start background location watcher:', error);
      this.backgroundLocationWatcher = null;
      throw error;
    }
  }
  
  /**
   * Stop background location watching
   */
  static async stopBackgroundLocationWatcher() {
    if (this.backgroundLocationWatcher) {
      console.log('📡 Stopping background location watcher...');
      
      try {
        await this.backgroundLocationWatcher.remove();
        this.backgroundLocationWatcher = null;
        console.log('SUCCESS: Background location watcher stopped');
      } catch (error) {
        console.error('ERROR: Failed to stop background location watcher:', error);
        this.backgroundLocationWatcher = null;
      }
    }
  }
  
  /**
   * Add callback for background location updates
   */
  static addBackgroundLocationCallback(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    this.backgroundLocationCallbacks.add(callback);
    console.log(`📡 Added background location callback (${this.backgroundLocationCallbacks.size} total)`);
  }
  
  /**
   * Remove callback from background location updates
   */
  static removeBackgroundLocationCallback(callback) {
    const removed = this.backgroundLocationCallbacks.delete(callback);
    if (removed) {
      console.log(`📡 Removed background location callback (${this.backgroundLocationCallbacks.size} remaining)`);
    }
    
    // Stop watcher if no callbacks remain
    if (this.backgroundLocationCallbacks.size === 0) {
      this.stopBackgroundLocationWatcher();
    }
  }
  
  /**
   * Watch location changes (for real-time updates) - Legacy method
   */
  static async watchLocation(callback, options = {}) {
    console.warn('watchLocation is deprecated, use startBackgroundLocationWatcher instead');
    this.addBackgroundLocationCallback(callback);
    return this.startBackgroundLocationWatcher(options);
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