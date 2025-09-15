import * as Location from 'expo-location';
import Constants from 'expo-constants';
import LocationCache from './LocationCache';

class FusedLocationProvider {
  static locationQueue = [];
  static isProcessing = false;
  static circuitBreaker = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    openUntil: null
  };

  static PROVIDER_WEIGHTS = {
    GPS: 1.0,
    NETWORK: 0.7,
    PASSIVE: 0.5,
    CACHED: 0.3
  };

  static async getLocation(options = {}) {
    const requestId = Date.now();
    const {
      priority = 'balanced',
      timeout = 5000,
      maxAge = 300000,
      enableHighAccuracy = false
    } = options;

    console.log(`🎯 FusedLocationProvider [${requestId}]: Starting location request with priority: ${priority}`);

    return new Promise((resolve, reject) => {
      this.locationQueue.push({
        requestId,
        priority,
        timeout,
        maxAge,
        enableHighAccuracy,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  static async processQueue() {
    if (this.isProcessing || this.locationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const request = this.locationQueue.shift();
      const result = await this.getLocationInternal(request);
      request.resolve(result);
    } catch (error) {
      const request = this.locationQueue[0];
      if (request) {
        this.locationQueue.shift();
        request.reject(error);
      }
    } finally {
      this.isProcessing = false;

      if (this.locationQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  static async getLocationInternal(request) {
    const { requestId, priority, timeout, maxAge, enableHighAccuracy } = request;

    if (this.isCircuitOpen()) {
      console.log(`🚫 [${requestId}]: Circuit breaker open, using cache only`);
      return await this.getCachedLocation();
    }

    console.log(`🔄 [${requestId}]: Processing location request`);

    try {
      const locationSources = await this.getLocationFromAllSources({
        requestId,
        priority,
        timeout,
        maxAge,
        enableHighAccuracy
      });

      if (locationSources.length === 0) {
        throw new Error('No location sources available');
      }

      const fusedLocation = this.fuseLocations(locationSources);

      await LocationCache.cacheLocation(fusedLocation);
      this.resetCircuitBreaker();

      console.log(`✅ [${requestId}]: Successfully fused location from ${locationSources.length} sources`);
      return fusedLocation;

    } catch (error) {
      this.recordFailure();
      console.error(`❌ [${requestId}]: Location fusion failed:`, error.message);

      const cachedLocation = await this.getCachedLocation();
      if (cachedLocation) {
        console.log(`💾 [${requestId}]: Returning cached location as fallback`);
        return { ...cachedLocation, isFallback: true };
      }

      throw error;
    }
  }

  static async getLocationFromAllSources(options) {
    const { requestId, timeout, enableHighAccuracy } = options;
    const sources = [];
    const isEmulator = await this.isEmulator();

    console.log(`📡 [${requestId}]: Gathering location from multiple sources (emulator: ${isEmulator})`);

    const locationPromises = [];

    locationPromises.push(
      this.getGPSLocation({ requestId, timeout, enableHighAccuracy, isEmulator })
        .then(location => ({ ...location, source: 'GPS', weight: this.PROVIDER_WEIGHTS.GPS }))
        .catch(error => {
          console.log(`📡 [${requestId}]: GPS failed: ${error.message}`);
          return null;
        })
    );

    locationPromises.push(
      this.getNetworkLocation({ requestId, timeout: timeout / 2 })
        .then(location => ({ ...location, source: 'NETWORK', weight: this.PROVIDER_WEIGHTS.NETWORK }))
        .catch(error => {
          console.log(`📡 [${requestId}]: Network location failed: ${error.message}`);
          return null;
        })
    );

    locationPromises.push(
      this.getCachedLocationSource({ requestId })
        .then(location => ({ ...location, source: 'CACHED', weight: this.PROVIDER_WEIGHTS.CACHED }))
        .catch(() => null)
    );

    const results = await Promise.allSettled(locationPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        sources.push(result.value);
      }
    });

    console.log(`📡 [${requestId}]: Collected ${sources.length} location sources`);
    return sources;
  }

  static async getGPSLocation({ requestId, timeout, enableHighAccuracy, isEmulator }) {
    const startTime = Date.now();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    if (isEmulator) {
      console.log(`⚠️ [${requestId}]: Running in emulator - GPS may fail, manual location recommended`);
    }

    const config = {
      accuracy: enableHighAccuracy
        ? Location.Accuracy.BestForNavigation
        : Location.Accuracy.High,
      timeout: Math.min(timeout, 15000),
      maximumAge: 60000,
      enableHighAccuracy: enableHighAccuracy
    };

    console.log(`🛰️ [${requestId}]: Getting GPS location with config:`, config);

    const location = await Location.getCurrentPositionAsync(config);
    const acquisitionTime = Date.now() - startTime;

    console.log(`🛰️ [${requestId}]: GPS location acquired in ${acquisitionTime}ms`);

    const coords = {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
      acquisitionTime
    };

    // Validate coordinates are within reasonable bounds for Malaysia
    if (!this.isValidMalaysianCoordinates(coords.lat, coords.lon)) {
      console.warn(`⚠️ [${requestId}]: GPS returned non-Malaysian coordinates: ${coords.lat}, ${coords.lon}`);
      throw new Error('GPS returned coordinates outside Malaysia bounds');
    }

    return coords;
  }

  /**
   * Validate if coordinates are within Malaysia bounds
   */
  static isValidMalaysianCoordinates(lat, lon) {
    // Malaysia bounds: roughly 0.8°N to 7.6°N, 99.5°E to 119.6°E
    return lat >= 0.8 && lat <= 7.6 && lon >= 99.5 && lon <= 119.6;
  }

  static async getNetworkLocation({ requestId, timeout }) {
    try {
      const config = {
        accuracy: Location.Accuracy.Balanced,
        timeout: timeout,
        maximumAge: 120000,
        enableHighAccuracy: false
      };

      console.log(`📶 [${requestId}]: Getting network-based location`);

      const location = await Location.getCurrentPositionAsync(config);

      return {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      };
    } catch (error) {
      console.log(`📶 [${requestId}]: Network location failed: ${error.message}`);
      throw error;
    }
  }

  static async getCachedLocationSource({ requestId }) {
    const cached = await LocationCache.getLocationFromCache('VALID');
    if (cached) {
      console.log(`💾 [${requestId}]: Using cached location source`);
      return cached;
    }
    throw new Error('No cached location available');
  }

  static fuseLocations(locationSources) {
    if (locationSources.length === 0) {
      throw new Error('No location sources to fuse');
    }

    if (locationSources.length === 1) {
      return locationSources[0];
    }

    console.log(`🔄 Fusing ${locationSources.length} location sources`);

    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLon = 0;
    let bestAccuracy = Infinity;
    let mostRecentTime = 0;

    locationSources.forEach(location => {
      const weight = this.calculateLocationWeight(location);
      totalWeight += weight;
      weightedLat += location.lat * weight;
      weightedLon += location.lon * weight;

      if (location.accuracy && location.accuracy < bestAccuracy) {
        bestAccuracy = location.accuracy;
      }

      if (location.timestamp > mostRecentTime) {
        mostRecentTime = location.timestamp;
      }
    });

    const fusedLocation = {
      lat: weightedLat / totalWeight,
      lon: weightedLon / totalWeight,
      accuracy: bestAccuracy === Infinity ? null : bestAccuracy,
      timestamp: mostRecentTime,
      sources: locationSources.map(s => s.source),
      sourceCount: locationSources.length,
      isFused: true,
      confidence: this.calculateConfidence(locationSources)
    };

    console.log(`✅ Fused location: lat=${fusedLocation.lat.toFixed(6)}, lon=${fusedLocation.lon.toFixed(6)}, confidence=${fusedLocation.confidence.toFixed(2)}`);

    return fusedLocation;
  }

  static calculateLocationWeight(location) {
    let weight = location.weight || this.PROVIDER_WEIGHTS[location.source] || 0.5;

    if (location.accuracy) {
      weight *= Math.max(0.1, 1 - (location.accuracy / 1000));
    }

    const age = Date.now() - (location.timestamp || 0);
    const ageMinutes = age / (1000 * 60);
    weight *= Math.max(0.1, 1 - (ageMinutes / 30));

    return Math.max(0.01, weight);
  }

  static calculateConfidence(locationSources) {
    if (locationSources.length === 0) return 0;
    if (locationSources.length === 1) return 0.6;

    const hasGPS = locationSources.some(s => s.source === 'GPS');
    const hasNetwork = locationSources.some(s => s.source === 'NETWORK');
    const sourceCount = locationSources.length;

    let confidence = 0.4;

    if (hasGPS) confidence += 0.3;
    if (hasNetwork) confidence += 0.2;
    confidence += Math.min(0.1, sourceCount * 0.05);

    const accuracies = locationSources
      .filter(s => s.accuracy && s.accuracy > 0)
      .map(s => s.accuracy);

    if (accuracies.length > 0) {
      const avgAccuracy = accuracies.reduce((a, b) => a + b) / accuracies.length;
      if (avgAccuracy < 50) confidence += 0.1;
      else if (avgAccuracy < 100) confidence += 0.05;
    }

    return Math.min(1.0, confidence);
  }

  static async getCachedLocation() {
    const cached = await LocationCache.getLocationFromCache('STALE_ACCEPTABLE');
    if (cached) {
      return { ...cached, isCached: true };
    }

    throw new Error('No cached location available. Manual location input required.');
  }

  static async isEmulator() {
    try {
      const deviceName = Constants.deviceName?.toLowerCase() || '';
      const modelName = Constants.deviceModelName?.toLowerCase() || '';

      const emulatorIndicators = [
        deviceName.includes('emulator'),
        deviceName.includes('simulator'),
        deviceName.includes('generic'),
        modelName.includes('emulator'),
        modelName.includes('simulator'),
        Constants.isDevice === false
      ];

      return emulatorIndicators.some(indicator => indicator);
    } catch (error) {
      return false;
    }
  }

  static isCircuitOpen() {
    if (!this.circuitBreaker.isOpen) return false;

    if (Date.now() > this.circuitBreaker.openUntil) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = Math.max(0, this.circuitBreaker.failures - 1);
      console.log('🔄 Circuit breaker half-open');
      return false;
    }

    return true;
  }

  static recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= 3) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.openUntil = Date.now() + (30 * 1000);
      console.log('🚫 Circuit breaker opened due to repeated failures');
    }
  }

  static resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.openUntil = null;
  }

  static clearQueue() {
    const queueSize = this.locationQueue.length;
    this.locationQueue.forEach(request => {
      request.reject(new Error('Request cancelled due to queue clear'));
    });
    this.locationQueue = [];
    console.log(`🧹 Cleared ${queueSize} pending location requests`);
  }

  static getStats() {
    return {
      queueSize: this.locationQueue.length,
      isProcessing: this.isProcessing,
      circuitBreaker: { ...this.circuitBreaker },
      isCircuitOpen: this.isCircuitOpen()
    };
  }
}

export default FusedLocationProvider;