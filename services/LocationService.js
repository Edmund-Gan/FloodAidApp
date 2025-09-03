// services/LocationService.js
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Google Maps API Key from app configuration
const GOOGLE_MAPS_API_KEY = 'AIzaSyC-0v96Q4G43rh8tuLfzTaACTfVA-oSwGM';

class LocationService {
  // Static tracking for active GPS requests
  static activeRequests = new Map();
  
  /**
   * Detect if running in emulator/simulator
   */
  static isEmulator() {
    // Enhanced emulator detection logic
    const deviceName = Constants.deviceName?.toLowerCase() || '';
    const modelName = Constants.deviceModelName?.toLowerCase() || '';
    
    const isEmulator = 
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
      (Constants.platform?.ios && Constants.isDevice === false) ||
      // Generic indicators
      !Constants.isDevice ||
      // Development environment indicators
      process.env.NODE_ENV === 'development' && !Constants.isDevice;
    
    console.log(`🔍 Enhanced emulator detection: ${isEmulator ? 'EMULATOR/SIMULATOR' : 'REAL DEVICE'}`, {
      deviceName: Constants.deviceName,
      modelName: Constants.deviceModelName,
      isDevice: Constants.isDevice,
      platform: Constants.platform,
      nodeEnv: process.env.NODE_ENV
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
   * Get user's current GPS location with proper permission handling
   */
  static async getCurrentLocation(skipGPS = false) {
    const debugId = Date.now();
    const isEmulatorDevice = this.isEmulator();
    
    console.log(`📍 LocationService [${debugId}]: ${skipGPS ? 'SKIPPING GPS' : 'Requesting location'} permissions...`);
    
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
    
    // GPS configuration with increased timeouts for better reliability
    const emulatorConfig = {
      timeout: isEmulatorDevice ? 18000 : 30000, // 18s for emulator (increased), 30s for device
      accuracy: isEmulatorDevice ? Location.Accuracy.Balanced : Location.Accuracy.High,
      progressInterval: isEmulatorDevice ? 5000 : 3000 // 5s progress for emulator, 3s for device
    };
    
    console.log(`🔧 GPS Configuration: ${isEmulatorDevice ? 'EMULATOR MODE' : 'DEVICE MODE'}`, emulatorConfig);
    
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
      
      // Get current position with emulator-aware configuration
      console.log(`📡 [${debugId}]: Calling getCurrentPositionAsync() with ${emulatorConfig.timeout}ms timeout`);
      
      // Add progress tracking for GPS request
      const progressTimeout = setInterval(() => {
        console.log(`⏳ [${debugId}]: GPS request still in progress...`);
      }, emulatorConfig.progressInterval);
      
      // Create cancellation flag
      let isCancelled = false;
      const cancelCallback = () => {
        isCancelled = true;
        console.log(`🚫 [${debugId}]: GPS request marked as cancelled`);
      };
      
      // Track this request for potential cancellation
      this.activeRequests.set(debugId, { progressTimeout, cancelCallback });
      
      // Enhanced timeout using Promise.race to ensure cleanup
      const gpsPromise = Location.getCurrentPositionAsync({
        accuracy: emulatorConfig.accuracy,
        timeout: emulatorConfig.timeout,
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`GPS timeout after ${emulatorConfig.timeout}ms [${debugId}]`));
        }, emulatorConfig.timeout + 500); // Add 500ms buffer
      });
      
      const location = await Promise.race([gpsPromise, timeoutPromise]);
      
      // Check if request was cancelled during GPS acquisition
      if (isCancelled) {
        console.log(`🚫 [${debugId}]: GPS request was cancelled, ignoring result`);
        throw new Error(`GPS request cancelled [${debugId}]`);
      }
      
      // Clean up tracking
      clearInterval(progressTimeout);
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
      
      // Cache the location
      await this.cacheLocation(coordinates);
      
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
      await this.cacheLocation(defaultLocation);
      
      return defaultLocation;
    }
  }

  /**
   * Get Malaysian state from coordinates using Google Maps Reverse Geocoding
   */
  static async getStateFromCoordinates(lat, lon) {
    console.log(`🗺️ Getting state for coordinates: ${lat}, ${lon}`);
    
    try {
      // Check cache first
      const cacheKey = `state_${lat.toFixed(4)}_${lon.toFixed(4)}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;
        
        // Cache valid for 24 hours
        if (age < 24 * 60 * 60 * 1000) {
          console.log('🔄 Using cached state:', parsedCache.state);
          return parsedCache.state;
        }
      }
      
      // Make API request to Google Maps
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`;
      console.log('🚀 Calling Google Maps API...');
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Geocoding API error: ${data.status}`);
      }
      
      // Extract Malaysian state from results
      const state = this.extractMalaysianState(data.results);
      
      console.log('🏛️ State identified:', state);
      
      // Cache the result
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        state,
        timestamp: Date.now()
      }));
      
      return state;
      
    } catch (error) {
      console.error('❌ Error getting state from coordinates:', error);
      
      // Fallback: try to determine state from coordinates using basic logic
      return this.getStateFromCoordinatesFallback(lat, lon);
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
   * Fallback method to determine state from coordinates using basic geographic boundaries
   */
  static getStateFromCoordinatesFallback(lat, lon) {
    console.log('🔄 Using coordinate-based state detection fallback...');
    
    // Basic coordinate ranges for Malaysian states (simplified)
    const stateRanges = {
      'Selangor': { latMin: 2.8, latMax: 3.8, lonMin: 101.0, lonMax: 102.0 },
      'Kuala Lumpur': { latMin: 3.0, latMax: 3.3, lonMin: 101.5, lonMax: 101.8 },
      'Johor': { latMin: 1.2, latMax: 2.8, lonMin: 102.5, lonMax: 104.5 },
      'Kedah': { latMin: 5.0, latMax: 6.7, lonMin: 100.0, lonMax: 101.0 },
      'Penang': { latMin: 5.2, latMax: 5.5, lonMin: 100.1, lonMax: 100.5 },
      'Perak': { latMin: 3.7, latMax: 5.5, lonMin: 100.5, lonMax: 102.0 },
      'Sabah': { latMin: 4.0, latMax: 7.5, lonMin: 115.0, lonMax: 119.5 },
      'Sarawak': { latMin: 0.8, latMax: 5.0, lonMin: 109.5, lonMax: 115.5 }
    };
    
    for (const [state, bounds] of Object.entries(stateRanges)) {
      if (lat >= bounds.latMin && lat <= bounds.latMax && 
          lon >= bounds.lonMin && lon <= bounds.lonMax) {
        console.log(`🎯 State detected by coordinates: ${state}`);
        return state;
      }
    }
    
    console.log('❓ State could not be determined, defaulting to Selangor');
    return 'Selangor'; // Default to Selangor (most common test case)
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
   * Cache location data
   */
  static async cacheLocation(location) {
    try {
      await AsyncStorage.setItem('cached_location', JSON.stringify({
        ...location,
        cacheTime: Date.now()
      }));
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }

  /**
   * Get cached location
   */
  static async getCachedLocation() {
    try {
      const cached = await AsyncStorage.getItem('cached_location');
      if (cached) {
        const location = JSON.parse(cached);
        const age = Date.now() - location.cacheTime;
        
        // Cache valid for 1 hour
        if (age < 60 * 60 * 1000) {
          return location;
        }
      }
    } catch (error) {
      console.error('Error getting cached location:', error);
    }
    
    return null;
  }

  /**
   * Check if coordinates are within Malaysia boundaries
   */
  static isLocationInMalaysia(lat, lon) {
    // Malaysian boundaries (approximate)
    const malaysianBounds = {
      // Peninsular Malaysia
      peninsula: {
        latMin: 1.2, latMax: 6.7,
        lonMin: 99.5, lonMax: 104.5
      },
      // Sabah and Sarawak (East Malaysia)  
      eastMalaysia: {
        latMin: 0.8, latMax: 7.5,
        lonMin: 109.3, lonMax: 119.5
      }
    };

    const inPeninsula = (
      lat >= malaysianBounds.peninsula.latMin && lat <= malaysianBounds.peninsula.latMax &&
      lon >= malaysianBounds.peninsula.lonMin && lon <= malaysianBounds.peninsula.lonMax
    );

    const inEastMalaysia = (
      lat >= malaysianBounds.eastMalaysia.latMin && lat <= malaysianBounds.eastMalaysia.latMax &&
      lon >= malaysianBounds.eastMalaysia.lonMin && lon <= malaysianBounds.eastMalaysia.lonMax
    );

    return inPeninsula || inEastMalaysia;
  }

  /**
   * Find nearest Malaysian location using Euclidean distance
   */
  static findNearestMalaysianLocation(lat, lon) {
    const malaysianCities = [
      { name: 'Kuala Lumpur', lat: 3.1390, lon: 101.6869, state: 'Kuala Lumpur' },
      { name: 'Puchong, Selangor', lat: 3.0738, lon: 101.5183, state: 'Selangor' },
      { name: 'Johor Bahru, Johor', lat: 1.4927, lon: 103.7414, state: 'Johor' },
      { name: 'George Town, Penang', lat: 5.4164, lon: 100.3327, state: 'Penang' },
      { name: 'Ipoh, Perak', lat: 4.5975, lon: 101.0901, state: 'Perak' },
      { name: 'Shah Alam, Selangor', lat: 3.0733, lon: 101.5185, state: 'Selangor' },
      { name: 'Petaling Jaya, Selangor', lat: 3.1073, lon: 101.6421, state: 'Selangor' },
      { name: 'Kota Kinabalu, Sabah', lat: 5.9804, lon: 116.0735, state: 'Sabah' },
      { name: 'Kuching, Sarawak', lat: 1.5533, lon: 110.3592, state: 'Sarawak' },
      { name: 'Malacca City, Malacca', lat: 2.2055, lon: 102.2501, state: 'Malacca' },
      { name: 'Alor Setar, Kedah', lat: 6.1248, lon: 100.3678, state: 'Kedah' },
      { name: 'Kuantan, Pahang', lat: 3.8077, lon: 103.3260, state: 'Pahang' }
    ];

    let nearestCity = malaysianCities[0];
    let minDistance = this.calculateEuclideanDistance(lat, lon, nearestCity.lat, nearestCity.lon);

    for (const city of malaysianCities) {
      const distance = this.calculateEuclideanDistance(lat, lon, city.lat, city.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = city;
      }
    }

    console.log(`🎯 Nearest Malaysian city: ${nearestCity.name} (distance: ${minDistance.toFixed(2)} units)`);
    return nearestCity;
  }

  /**
   * Calculate Euclidean distance between two coordinates
   */
  static calculateEuclideanDistance(lat1, lon1, lat2, lon2) {
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
    return Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
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
}

export default LocationService;