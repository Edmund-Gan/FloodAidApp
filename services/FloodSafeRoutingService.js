// services/FloodSafeRoutingService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// OpenRouteService API configuration
// Uses EXPO_PUBLIC_ prefix for automatic loading in Expo SDK 54
const ORS_API_KEY = process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY || 'YOUR_ORS_API_KEY_HERE';

// Detailed logging for debugging
console.log('🔍 OpenRouteService API Key Loading Debug:');
console.log('  - process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY:', process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY ? 'Found' : 'Not found');
console.log('  - Final API key length:', ORS_API_KEY?.length || 0);
console.log('  - First 30 chars:', ORS_API_KEY?.substring(0, 30) || 'N/A');

// Validate API key is configured
if (!ORS_API_KEY || ORS_API_KEY === 'YOUR_ORS_API_KEY_HERE') {
  console.error('⚠️ OpenRouteService API key not configured!');
  console.error('   Check .env has: EXPO_PUBLIC_OPENROUTESERVICE_API_KEY');
  console.error('   Then restart with: npx expo start -c');
} else {
  console.log('✅ OpenRouteService API key loaded successfully');
}

const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

// Route calculation constants
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_ROUTE_DISTANCE_KM = 100; // ORS limitation for alternative routes
const LOW_ELEVATION_THRESHOLD = 10; // meters - areas below this are considered flood-prone
const MAX_RETRY_ATTEMPTS = 2; // Retry 403 errors up to 2 times
const RETRY_DELAYS = [1000, 2000]; // Delay in ms: 1s, 2s

// State-specific elevation thresholds (meters above sea level)
const STATE_ELEVATION_THRESHOLDS = {
  'KUALA LUMPUR': 10,
  'SELANGOR': 12,
  'KELANTAN': 8,      // Coastal, more flood-sensitive
  'TERENGGANU': 8,    // Coastal, more flood-sensitive
  'PAHANG': 15,       // Hillier terrain
  'JOHOR': 10,
  'PENANG': 8,        // Island/coastal
  'PERAK': 12,
  'KEDAH': 10,
  'PERLIS': 10,
  'NEGERI SEMBILAN': 12,
  'MALACCA': 8,       // Coastal
  'SABAH': 10,
  'SARAWAK': 10,
  'PUTRAJAYA': 10,
  'LABUAN': 8         // Island
};

class FloodSafeRoutingService {
  /**
   * Sleep utility for retry delays
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Plan flood-safe routes between origin and destination
   * Returns up to 3 alternative routes with elevation analysis and flood risk scoring
   */
  static async planFloodSafeRoute(origin, destination, options = {}) {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (!origin?.latitude || !origin?.longitude) {
        throw new Error('Invalid origin coordinates');
      }
      if (!destination?.lat || !destination?.lng) {
        throw new Error('Invalid destination coordinates');
      }

      // Check cache first
      const cacheKey = this.getCacheKey(origin, destination);
      const cached = await this.getCachedRoute(cacheKey);
      if (cached && !options.skipCache) {
        console.log('Using cached flood-safe routes');
        return cached;
      }

      // Calculate straight-line distance to check if under 100km limit
      const straightLineDistance = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.lat,
        destination.lng
      );

      if (straightLineDistance > MAX_ROUTE_DISTANCE_KM) {
        throw new Error(
          `Route distance (${straightLineDistance.toFixed(1)}km) exceeds 100km limit for alternative routes. ` +
          'Please select a closer emergency service or use standard navigation.'
        );
      }

      // Get elevation threshold for the area (use origin location's state)
      const elevationThreshold = options.elevationThreshold ||
                                 this.getElevationThreshold(options.state) ||
                                 LOW_ELEVATION_THRESHOLD;

      console.log(`Requesting flood-safe routes from ORS (distance: ${straightLineDistance.toFixed(1)}km)...`);

      // Request routes from OpenRouteService
      const routes = await this.requestRoutesFromORS(origin, destination, options);

      if (!routes || routes.length === 0) {
        throw new Error('No routes found. Please check your internet connection and try again.');
      }

      console.log(`Received ${routes.length} route(s) from ORS`);

      // Analyze each route for flood safety
      const analyzedRoutes = routes
        .map((route, index) => this.analyzeRouteFloodSafety(route, index, elevationThreshold))
        .filter(route => {
          // Filter out null routes and routes marked as invalid
          if (!route) {
            console.warn('Filtering out null route');
            return false;
          }
          if (route.isInvalid) {
            console.warn(`Filtering out invalid route ${route.routeIndex}`);
            return false;
          }
          return true;
        });

      // Check if we have any valid routes left
      if (analyzedRoutes.length === 0) {
        throw new Error('No valid routes found. The routes returned by the service have invalid structure.');
      }

      console.log(`Analyzed ${analyzedRoutes.length} valid route(s)`);

      // Sort by safety score (highest first)
      analyzedRoutes.sort((a, b) => b.safetyScore - a.safetyScore);

      // Mark the recommended route
      if (analyzedRoutes.length > 0) {
        analyzedRoutes[0].isRecommended = true;
      }

      const result = {
        routes: analyzedRoutes,
        origin,
        destination,
        elevationThreshold,
        calculatedAt: Date.now(),
        calculationTime: Date.now() - startTime
      };

      // Cache the result
      await this.cacheRoute(cacheKey, result);

      console.log(`Flood-safe route calculation completed in ${result.calculationTime}ms`);
      return result;

    } catch (error) {
      console.error('Error planning flood-safe route:', error);
      throw error;
    }
  }

  /**
   * Request routes from OpenRouteService API with retry logic
   */
  static async requestRoutesFromORS(origin, destination, options = {}) {
    const coordinates = [
      [origin.longitude, origin.latitude],
      [destination.lng, destination.lat]
    ];

    const requestBody = {
      coordinates,
      preference: 'recommended',
      units: 'km',
      language: 'en',
      geometry: true,
      elevation: true,
      extra_info: ['steepness', 'surface', 'waytype'],
      instructions: false,
      options: {  // avoid_features must be inside options object
        avoid_features: ['fords', 'ferries']  // Critical for flood safety
      },
      alternative_routes: {
        target_count: 3,
        share_factor: 0.6,      // Allow routes to share 60% of segments
        weight_factor: 1.4      // Routes can be up to 1.4x the optimal route
      }
    };

    // Add optional avoid polygons for known flood-prone areas
    if (options.avoidPolygons && options.avoidPolygons.length > 0) {
      requestBody.options.avoid_polygons = options.avoidPolygons;
    }

    // Use /geojson endpoint to get coordinates array instead of encoded polyline
    const url = `${ORS_BASE_URL}/driving-car/geojson`;

    // Retry logic for 403 errors (temporary service issues)
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_DELAYS[attempt - 1];
          console.log(`⏳ Retrying request (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS + 1}) after ${delay}ms...`);
          await this.sleep(delay);
        }

        console.log('📡 OpenRouteService Request Details:');
        console.log('  - URL:', url);
        console.log('  - Attempt:', attempt + 1);
        console.log('  - Timestamp:', new Date().toISOString());
        console.log('  - API Key present:', !!ORS_API_KEY);
        console.log('  - API Key length:', ORS_API_KEY?.length);
        console.log('  - Coordinates:', requestBody.coordinates);
        console.log('  - Alternative routes requested:', requestBody.alternative_routes?.target_count);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': ORS_API_KEY
          },
          body: JSON.stringify(requestBody),
          timeout: 10000 // 10 second timeout
        });

        console.log('📥 OpenRouteService Response:');
        console.log('  - Status:', response.status);
        console.log('  - Status Text:', response.statusText);
        console.log('  - Timestamp:', new Date().toISOString());

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ ORS API Error Details:');
          console.error('  - Status:', response.status);
          console.error('  - Response:', errorText);
          console.error('  - API Key (first 30):', ORS_API_KEY?.substring(0, 30));

          if (response.status === 401) {
            throw new Error('OpenRouteService API authentication failed. Please check API key.');
          } else if (response.status === 403) {
            // 403 errors might be temporary - retry
            lastError = new Error('OpenRouteService API access forbidden. This might be temporary.');
            if (attempt < MAX_RETRY_ATTEMPTS) {
              console.log('  - 403 error detected, will retry...');
              continue; // Retry
            }
            throw new Error('OpenRouteService API access forbidden. Please verify API key permissions.');
          } else if (response.status === 429) {
            throw new Error('OpenRouteService API rate limit exceeded. Please try again later.');
          } else {
            throw new Error(`OpenRouteService API error: ${response.status}`);
          }
        }

        const data = await response.json();

        // Convert GeoJSON FeatureCollection to routes array
        let routes = [];

        if (data.type === 'FeatureCollection' && data.features) {
          // GeoJSON format - convert features to routes
          console.log('📍 Received GeoJSON FeatureCollection with', data.features.length, 'feature(s)');

          routes = data.features.map(feature => ({
            geometry: feature.geometry,
            summary: feature.properties?.summary || {},
            segments: feature.properties?.segments || [],
            extras: feature.properties?.extras || {},
            way_points: feature.properties?.way_points || [],
            warnings: feature.properties?.warnings || []
          }));
        } else if (data.routes) {
          // Standard JSON format
          routes = data.routes;
        } else {
          // Unknown format
          console.error('❌ Unknown response format:', {
            hasType: !!data.type,
            type: data.type,
            hasFeatures: !!data.features,
            hasRoutes: !!data.routes,
            keys: Object.keys(data)
          });
          throw new Error('Unknown response format from OpenRouteService');
        }

        if (!routes || routes.length === 0) {
          throw new Error('No routes returned from OpenRouteService');
        }

        console.log('✅ Successfully received', routes.length, 'route(s) from OpenRouteService');

        // Debug: Log first route structure
        if (routes[0]) {
          console.log('📊 First route structure:');
          console.log('  - Has geometry:', !!routes[0].geometry);
          console.log('  - Geometry type:', typeof routes[0].geometry);
          console.log('  - Geometry keys:', routes[0].geometry ? Object.keys(routes[0].geometry) : 'N/A');
          if (routes[0].geometry) {
            console.log('  - Has coordinates:', !!routes[0].geometry.coordinates);
            console.log('  - Coordinates length:', routes[0].geometry.coordinates?.length || 0);
            console.log('  - First coordinate:', routes[0].geometry.coordinates?.[0]);
          }
          console.log('  - Has summary:', !!routes[0].summary);
          console.log('  - Summary keys:', routes[0].summary ? Object.keys(routes[0].summary) : 'N/A');
        }

        return routes;

      } catch (error) {
        if (error.message.includes('Network request failed') || error.name === 'TypeError') {
          throw new Error('Network error. Please check your internet connection and try again.');
        }

        // If this is the last attempt or a non-retryable error, throw
        if (attempt >= MAX_RETRY_ATTEMPTS || !error.message.includes('temporary')) {
          throw error;
        }

        lastError = error;
      }
    }

    // If all retries failed, throw the last error
    throw lastError || new Error('Failed to get routes from OpenRouteService after retries');
  }

  /**
   * Analyze a route for flood safety based on elevation data
   */
  static analyzeRouteFloodSafety(route, index, elevationThreshold) {
    // Add null checks for route structure
    if (!route) {
      console.error('⚠️ Route is null or undefined at index', index);
      return null;
    }

    const geometry = route.geometry || {};
    const summary = route.summary || {};

    // Validate geometry has coordinates
    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
      console.warn(`⚠️ Route ${index} has invalid geometry structure:`, {
        hasGeometry: !!route.geometry,
        hasCoordinates: !!geometry.coordinates,
        isArray: Array.isArray(geometry.coordinates)
      });
      // Return a minimal valid route object
      return {
        routeIndex: index,
        distance: summary.distance || 0,
        duration: summary.duration || 0,
        geometry: { coordinates: [] },
        elevationMetrics: {
          average: 0,
          minimum: 0,
          maximum: 0,
          lowLyingPercentage: 0,
          elevationGain: 0,
          elevationLoss: 0
        },
        steepnessAnalysis: { available: false },
        lowLyingSegments: [],
        safetyScore: 0,
        safetyLevel: { level: 'low', label: 'Invalid Route', color: '#999' },
        waytype: route.extras?.waytype,
        surface: route.extras?.surface,
        isRecommended: false,
        isInvalid: true
      };
    }

    // Extract elevation data from coordinates
    const elevations = this.extractElevationData(geometry);

    // Calculate elevation metrics
    const elevationMetrics = this.calculateElevationMetrics(elevations, elevationThreshold);

    // Analyze steepness data if available
    const steepnessAnalysis = this.analyzeSteepness(route.extras?.steepness);

    // Identify low-lying segments
    const lowLyingSegments = this.identifyLowLyingSegments(
      geometry.coordinates || [],
      elevations,
      elevationThreshold
    );

    // Calculate safety score (0-100)
    const safetyScore = this.calculateSafetyScore(
      elevationMetrics,
      steepnessAnalysis,
      summary.distance || 0
    );

    // Determine safety level
    const safetyLevel = this.getSafetyLevel(safetyScore);

    return {
      routeIndex: index,
      distance: summary.distance || 0, // in km
      duration: summary.duration || 0, // in seconds
      geometry,
      elevationMetrics,
      steepnessAnalysis,
      lowLyingSegments,
      safetyScore,
      safetyLevel,
      waytype: route.extras?.waytype,
      surface: route.extras?.surface,
      isRecommended: false // Will be set later
    };
  }

  /**
   * Extract elevation data from route geometry
   */
  static extractElevationData(geometry) {
    if (!geometry || !geometry.coordinates) {
      return [];
    }

    // ORS returns coordinates as [lon, lat, elevation] when elevation=true
    return geometry.coordinates
      .map(coord => coord[2]) // Extract elevation (3rd element)
      .filter(elev => elev !== undefined && elev !== null);
  }

  /**
   * Calculate elevation metrics for a route
   */
  static calculateElevationMetrics(elevations, threshold) {
    if (!elevations || elevations.length === 0) {
      return {
        average: 0,
        minimum: 0,
        maximum: 0,
        lowLyingPercentage: 0,
        elevationGain: 0,
        elevationLoss: 0
      };
    }

    const sum = elevations.reduce((acc, val) => acc + val, 0);
    const average = sum / elevations.length;
    const minimum = Math.min(...elevations);
    const maximum = Math.max(...elevations);

    // Calculate percentage of route below threshold
    const lowLyingCount = elevations.filter(elev => elev < threshold).length;
    const lowLyingPercentage = (lowLyingCount / elevations.length) * 100;

    // Calculate elevation gain and loss
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    return {
      average: Math.round(average * 10) / 10,
      minimum: Math.round(minimum * 10) / 10,
      maximum: Math.round(maximum * 10) / 10,
      lowLyingPercentage: Math.round(lowLyingPercentage * 10) / 10,
      elevationGain: Math.round(gain * 10) / 10,
      elevationLoss: Math.round(loss * 10) / 10
    };
  }

  /**
   * Analyze steepness data from ORS extras
   */
  static analyzeSteepness(steepnessData) {
    if (!steepnessData || !steepnessData.values) {
      return { available: false };
    }

    // Steepness values: array of [startIndex, endIndex, steepnessCategory]
    // Categories typically: 0 (flat), 1-15 (various steepness levels)
    const summary = steepnessData.summary || [];

    return {
      available: true,
      summary: summary.map(item => ({
        value: item.value,
        distance: item.distance,
        percentage: item.amount
      }))
    };
  }

  /**
   * Identify low-lying segments along the route
   */
  static identifyLowLyingSegments(coordinates, elevations, threshold) {
    const segments = [];
    let currentSegment = null;

    for (let i = 0; i < elevations.length; i++) {
      const elevation = elevations[i];
      const coord = coordinates[i];

      if (elevation < threshold) {
        // Start new segment or continue existing one
        if (!currentSegment) {
          currentSegment = {
            start: i,
            end: i,
            startCoord: coord,
            endCoord: coord,
            minElevation: elevation,
            avgElevation: elevation,
            elevations: [elevation]
          };
        } else {
          // Continue segment
          currentSegment.end = i;
          currentSegment.endCoord = coord;
          currentSegment.minElevation = Math.min(currentSegment.minElevation, elevation);
          currentSegment.elevations.push(elevation);
        }
      } else {
        // End current segment if exists
        if (currentSegment) {
          const sum = currentSegment.elevations.reduce((a, b) => a + b, 0);
          currentSegment.avgElevation = Math.round((sum / currentSegment.elevations.length) * 10) / 10;
          currentSegment.length = currentSegment.elevations.length;
          delete currentSegment.elevations; // Don't need to store all elevations
          segments.push(currentSegment);
          currentSegment = null;
        }
      }
    }

    // Close final segment if exists
    if (currentSegment) {
      const sum = currentSegment.elevations.reduce((a, b) => a + b, 0);
      currentSegment.avgElevation = Math.round((sum / currentSegment.elevations.length) * 10) / 10;
      currentSegment.length = currentSegment.elevations.length;
      delete currentSegment.elevations;
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Calculate overall safety score for a route (0-100)
   */
  static calculateSafetyScore(elevationMetrics, steepnessAnalysis, distance) {
    let score = 0;

    // Factor 1: Average elevation (40% weight)
    // Higher elevation is safer
    // Scale: 0-50m elevation = 0-40 points
    const elevationScore = Math.min((elevationMetrics.average / 50) * 40, 40);
    score += elevationScore;

    // Factor 2: Low-lying percentage (40% weight)
    // Lower percentage is better
    // 0% low-lying = 40 points, 100% low-lying = 0 points
    const lowLyingScore = (100 - elevationMetrics.lowLyingPercentage) * 0.4;
    score += lowLyingScore;

    // Factor 3: Minimum elevation (20% weight)
    // Higher minimum is safer
    // Scale: 0-25m minimum = 0-20 points
    const minElevationScore = Math.min((elevationMetrics.minimum / 25) * 20, 20);
    score += minElevationScore;

    // Penalty: Very long routes (reduce safety perception)
    if (distance > 50) {
      score -= 5; // -5 points for routes > 50km
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Determine safety level from score
   */
  static getSafetyLevel(score) {
    if (score >= 80) return { level: 'high', label: 'High Safety', color: '#4CAF50' };
    if (score >= 60) return { level: 'medium', label: 'Moderate Safety', color: '#FF9800' };
    return { level: 'low', label: 'Low Safety', color: '#F44336' };
  }

  /**
   * Get elevation threshold for a specific state
   */
  static getElevationThreshold(state) {
    if (!state) return LOW_ELEVATION_THRESHOLD;

    const stateKey = state.toUpperCase().replace(/ /g, '_');
    return STATE_ELEVATION_THRESHOLDS[stateKey] || LOW_ELEVATION_THRESHOLD;
  }

  /**
   * Calculate straight-line distance between two points in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.degToRad(lat2 - lat1);
    const dLon = this.degToRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  static degToRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Format duration in seconds to human-readable string
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  }

  /**
   * Generate cache key for route
   */
  static getCacheKey(origin, destination) {
    const originKey = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}`;
    const destKey = `${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    return `floodroute_${originKey}_${destKey}`;
  }

  /**
   * Cache route result
   */
  static async cacheRoute(key, result) {
    try {
      const cacheData = {
        result,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache route:', error);
    }
  }

  /**
   * Get cached route result
   */
  static async getCachedRoute(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { result, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return result;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached route:', error);
      return null;
    }
  }

  /**
   * Clear all cached routes
   */
  static async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const routeKeys = keys.filter(key => key.startsWith('floodroute_'));
      await AsyncStorage.multiRemove(routeKeys);
      console.log(`Cleared ${routeKeys.length} cached routes`);
    } catch (error) {
      console.warn('Failed to clear route cache:', error);
    }
  }

  /**
   * Decode polyline (if needed for visualization)
   * ORS returns GeoJSON by default, but this can handle encoded polylines
   */
  static decodePolyline(encoded) {
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coordinates.push({
        latitude: lat / 1E5,
        longitude: lng / 1E5
      });
    }

    return coordinates;
  }
}

export default FloodSafeRoutingService;
