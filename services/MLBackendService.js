/**
 * ML Backend Service
 * Connects React Native app to Python ML backend server
 * Provides flood prediction using trained ML models
 */

import Constants from 'expo-constants';

// Backend URL configuration
// All platforms (iOS and Android, dev and prod) use the same production URL
// This ensures consistent behavior across all environments
const BACKEND_CONFIG = {
  // Production backend (Google Cloud Run deployment)
  production: 'https://floodaid-backend-497410110873.asia-southeast1.run.app',

  // Optional: Ngrok tunnel URL for local backend testing
  // Set this when using ngrok: 'https://your-subdomain.ngrok.io'
  ngrok: null
};

/**
 * Get the backend URL
 * Returns production URL unless ngrok is configured for local testing
 */
const getBackendURL = () => {
  // If ngrok URL is set, use it (for local backend testing)
  if (BACKEND_CONFIG.ngrok) {
    console.log('🌐 Using ngrok tunnel for local testing');
    return BACKEND_CONFIG.ngrok;
  }

  // All platforms use production URL
  return BACKEND_CONFIG.production;
};

const ML_BACKEND_URL = getBackendURL();

// Log the backend URL being used for debugging
console.log(`📡 ML Backend URL configured: ${ML_BACKEND_URL}`);
console.log(`   All platforms using unified production backend`);

// Request timeout (60 seconds) - increased to handle batched state processing
const REQUEST_TIMEOUT = 60000;

/**
 * ML Backend Service
 * Provides methods to interact with the Python ML backend
 */
class MLBackendService {
  /**
   * Check if backend is available
   */
  async healthCheck() {
    try {
      console.log(`🔍 Checking backend health at ${ML_BACKEND_URL}/api/health`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for health check

      const response = await fetch(`${ML_BACKEND_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Backend health check passed:', data.status);

      return {
        success: true,
        available: data.status === 'healthy',
        data: data
      };

    } catch (error) {
      console.warn('⚠️ Backend health check failed:', error.message);

      return {
        success: false,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Predict flood risk for a single location
   *
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string} date - Optional date for prediction (ISO format)
   * @returns {Promise} Prediction result
   */
  async predictFloodRisk(latitude, longitude, date = null) {
    try {
      console.log(`🔮 Requesting ML prediction from backend for lat=${latitude}, lon=${longitude}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const requestBody = {
        latitude: latitude,
        longitude: longitude
      };

      if (date) {
        requestBody.date = date;
      }

      const response = await fetch(`${ML_BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Prediction failed');
      }

      console.log(`✅ Backend prediction successful: ${data.risk_level} risk (${(data.flood_probability * 100).toFixed(1)}%)`);

      // Parse enhanced feature explanations if available
      const result = {
        success: true,
        ...data
      };

      // Include SHAP-based feature explanations
      if (data.feature_explanations) {
        result.feature_explanations = data.feature_explanations;

        // Also combine into contributing_factors for compatibility
        result.contributing_factors = [
          ...(data.feature_explanations.risk_increasing || []),
          ...(data.feature_explanations.risk_decreasing || [])
        ];

        console.log(`✅ SHAP explanations included: ${result.contributing_factors.length} factors`);
        console.log(`   - Risk-increasing: ${data.feature_explanations.risk_increasing?.length || 0}`);
        console.log(`   - Protective: ${data.feature_explanations.risk_decreasing?.length || 0}`);
      }

      return result;

    } catch (error) {
      console.error('❌ Backend prediction failed:', error.message);

      // Check if it's a timeout error
      if (error.name === 'AbortError') {
        throw new Error('Backend request timed out. Please check your connection.');
      }

      throw error;
    }
  }

  /**
   * Predict flood risk for multiple locations (batch)
   *
   * @param {Array} locations - Array of location objects with latitude, longitude, label
   * @returns {Promise} Batch prediction results
   */
  async predictBatch(locations) {
    try {
      console.log(`🔮 Requesting batch prediction for ${locations.length} locations`);

      if (locations.length > 20) {
        throw new Error('Maximum 20 locations allowed per batch request');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2); // Double timeout for batch

      const response = await fetch(`${ML_BACKEND_URL}/api/predict-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ locations }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Batch prediction failed');
      }

      console.log(`✅ Batch prediction successful for ${data.total_locations} locations`);

      return data;

    } catch (error) {
      console.error('❌ Batch prediction failed:', error.message);

      if (error.name === 'AbortError') {
        throw new Error('Batch prediction timed out. Please try with fewer locations.');
      }

      throw error;
    }
  }

  /**
   * Get backend model information
   *
   * @returns {Promise} Model information
   */
  async getModelsInfo() {
    try {
      console.log('📊 Fetching backend models information');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${ML_BACKEND_URL}/api/models`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch models info: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Models info retrieved:', data);

      return data;

    } catch (error) {
      console.error('❌ Failed to fetch models info:', error.message);
      throw error;
    }
  }

  /**
   * Get current backend URL
   * @returns {string} Backend URL
   */
  getBackendURL() {
    return ML_BACKEND_URL;
  }

  /**
   * Check if using local development server
   * @returns {boolean}
   */
  isLocalServer() {
    return ML_BACKEND_URL.includes('localhost') || ML_BACKEND_URL.includes('10.0.2.2');
  }

  /**
   * Update ngrok URL for testing on physical devices
   * @param {string} ngrokURL - Ngrok tunnel URL
   */
  setNgrokURL(ngrokURL) {
    BACKEND_CONFIG.ngrok = ngrokURL;
    console.log(`🌐 Ngrok URL updated: ${ngrokURL}`);
  }
}

// Export singleton instance
const mlBackendService = new MLBackendService();
export default mlBackendService;
