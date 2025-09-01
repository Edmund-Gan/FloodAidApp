import { API_CONFIG } from '../utils/constants';

class FloodAPI {
  constructor(baseURL = API_CONFIG.BASE_URL) {
    this.baseURL = baseURL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  /**
   * Make HTTP request with error handling and retries
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise} - API response
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    };

    let lastError;
    
    for (let attempt = 1; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`Making request to: ${url} (attempt ${attempt})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        console.error(`API Request failed (attempt ${attempt}):`, error);
        
        // If it's the last attempt or a non-recoverable error, throw
        if (attempt === API_CONFIG.RETRY_ATTEMPTS || error.name === 'AbortError') {
          break;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw lastError;
  }

  /**
   * Health check endpoint
   * @returns {Promise} - Server status
   */
  async healthCheck() {
    return this.makeRequest('/');
  }

  /**
   * Get flood prediction for coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {string} targetDate - Optional target date (YYYY-MM-DD)
   * @returns {Promise} - Flood prediction data
   */
  async predictFlood(latitude, longitude, targetDate = null) {
    const body = {
      latitude,
      longitude,
      ...(targetDate && { target_date: targetDate }),
    };

    return this.makeRequest('/predict', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get Malaysian state from coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - State information
   */
  async getStateFromCoordinates(latitude, longitude) {
    const body = { latitude, longitude };
    
    return this.makeRequest('/locations/state', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get current weather data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - Weather data
   */
  async getCurrentWeather(latitude, longitude) {
    const body = { latitude, longitude };
    
    return this.makeRequest('/weather/current', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get flood hotspots across Malaysia
   * @returns {Promise} - Hotspot data
   */
  async getFloodHotspots() {
    return this.makeRequest('/hotspots');
  }

  /**
   * Get flood prediction for multiple locations (batch request)
   * @param {Array} locations - Array of location objects with latitude/longitude
   * @returns {Promise} - Array of predictions
   */
  async predictMultipleLocations(locations) {
    try {
      const predictions = await Promise.all(
        locations.map(async (location) => {
          try {
            const prediction = await this.predictFlood(
              location.coordinates.latitude,
              location.coordinates.longitude
            );
            return {
              locationId: location.id,
              success: true,
              data: prediction,
            };
          } catch (error) {
            console.error(`Failed to predict for location ${location.id}:`, error);
            return {
              locationId: location.id,
              success: false,
              error: error.message,
              data: this.getMockFloodPrediction(location.coordinates.latitude, location.coordinates.longitude),
            };
          }
        })
      );

      return predictions;
    } catch (error) {
      console.error('Batch prediction failed:', error);
      throw error;
    }
  }

  /**
   * Get current device location and predict flood risk
   * @param {Object} location - Current device location {latitude, longitude}
   * @returns {Promise} - Location and prediction data
   */
  async predictCurrentLocation(location) {
    try {
      const { latitude, longitude } = location;
      
      // Get flood prediction
      const prediction = await this.predictFlood(latitude, longitude);
      
      return {
        location,
        prediction,
        success: true,
      };
    } catch (error) {
      console.error('Failed to get current location prediction:', error);
      
      // Return mock data as fallback
      return {
        location,
        prediction: this.getMockFloodPrediction(location.latitude, location.longitude),
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mock flood prediction for offline/fallback mode
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Mock prediction data
   */
  getMockFloodPrediction(latitude, longitude) {
    // Generate semi-realistic mock data based on coordinates
    const baseRisk = 0.3 + (Math.sin(latitude * longitude) * 0.4);
    const probability = Math.max(0.05, Math.min(0.95, baseRisk));

    let riskLevel;
    if (probability >= 0.8) riskLevel = 'Very High';
    else if (probability >= 0.6) riskLevel = 'High';
    else if (probability >= 0.3) riskLevel = 'Medium';
    else riskLevel = 'Low';

    return {
      success: true,
      coordinates: { latitude, longitude },
      location_info: {
        latitude,
        longitude,
        state: 'SELANGOR',
        elevation: 50,
        state_confidence: 'medium',
        state_method: 'offline',
        is_malaysia: true,
      },
      flood_probability: probability,
      flood_prediction: probability > 0.5 ? 1 : 0,
      risk_level: riskLevel,
      confidence: 'Demo Mode',
      weather_summary: {
        current_temp_max: 30 + Math.random() * 6,
        current_temp_min: 24 + Math.random() * 4,
        current_precipitation: Math.random() * 20,
        current_wind_speed: 8 + Math.random() * 10,
        recent_7day_rainfall: 50 + Math.random() * 100,
        recent_avg_temp: 27 + Math.random() * 4,
        river_discharge: 150 + Math.random() * 200,
      },
      prediction_metadata: {
        model_type: 'offline',
        prediction_date: new Date().toISOString(),
        target_date: new Date().toISOString().split('T')[0],
        impossible_flood_filtered: false,
        offline_mode: true,
      },
    };
  }

  /**
   * Mock hotspots data for offline mode
   * @returns {Object} - Mock hotspots data
   */
  getMockHotspots() {
    return {
      hotspots: [
        {
          id: 1,
          latitude: 3.1390,
          longitude: 101.6869,
          district: 'Puchong',
          state: 'Selangor',
          risk_level: 'high',
          risk_probability: 0.78,
          last_updated: new Date().toISOString(),
        },
        {
          id: 2,
          latitude: 1.4927,
          longitude: 103.7414,
          district: 'Johor Bahru',
          state: 'Johor',
          risk_level: 'medium',
          risk_probability: 0.45,
          last_updated: new Date().toISOString(),
        },
        {
          id: 3,
          latitude: 5.4141,
          longitude: 100.3288,
          district: 'George Town',
          state: 'Penang',
          risk_level: 'low',
          risk_probability: 0.22,
          last_updated: new Date().toISOString(),
        },
      ],
      total_locations: 3,
      high_risk_count: 1,
      last_updated: new Date().toISOString(),
      offline_mode: true,
    };
  }

  /**
   * Check if API is available
   * @returns {Promise<boolean>} - Whether API is available
   */
  async isApiAvailable() {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      console.log('API not available:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const floodAPI = new FloodAPI();

export { FloodAPI };
export default floodAPI;