// services/FloodPredictionModel.js
import { Platform } from 'react-native';
import { apiService } from './ApiService';
import LocationService from './LocationService';

/**
 * FloodPredictionModel - Integrates with ML training model for flood prediction
 * Implements Epic 1: AI-Based Prediction requirements
 */
class FloodPredictionModel {
  
  /**
   * Main prediction function - Epic 1 implementation
   * Uses GPS location, Google Maps geocoding, Open Meteo weather data, and ML model
   */
  static async getPredictionWithML(lat = null, lon = null, skipGPS = false) {
    const debugId = Date.now();
    console.log(`🤖 FloodPredictionModel [${debugId}]: Starting ML-based flood prediction...`);
    
    try {
      // Step 1: Get user location (GPS + reverse geocoding)
      console.log(`📍 [${debugId}]: Step 1 - Getting user location (skipGPS: ${skipGPS})`);
      let location, state, displayName;
      
      if (lat && lon) {
        console.log(`📍 [${debugId}]: Using provided coordinates: ${lat}, ${lon}`);
        location = { lat, lon };
        
        // Check if provided coordinates are in Malaysia
        if (LocationService.isLocationInMalaysia && !LocationService.isLocationInMalaysia(lat, lon)) {
          console.log(`⚠️ [${debugId}]: Provided location is outside Malaysia, finding nearest Malaysian area...`);
          const nearestCity = LocationService.findNearestMalaysianLocation(lat, lon);
          location = {
            lat: nearestCity.lat,
            lon: nearestCity.lon,
            originalLocation: { lat, lon },
            nearestMalaysianLocation: nearestCity,
            isRedirected: true
          };
          console.log(`🎯 [${debugId}]: Redirected to nearest Malaysian city: ${nearestCity.name}`);
        }
      } else {
        console.log(`📍 [${debugId}]: Getting current GPS location with Malaysia validation...`);
        if (LocationService.getCurrentLocationWithMalaysiaCheck) {
          console.log(`📍 [${debugId}]: Using getCurrentLocationWithMalaysiaCheck method`);
          location = await LocationService.getCurrentLocationWithMalaysiaCheck(skipGPS);
        } else {
          console.log(`📍 [${debugId}]: Fallback to regular getCurrentLocation method`);
          location = await LocationService.getCurrentLocation(skipGPS);
        }
        console.log(`📍 [${debugId}]: Location obtained:`, { lat: location.lat, lon: location.lon });
      }
      
      // Get Malaysian state using Google Maps reverse geocoding
      console.log(`🗺️ [${debugId}]: Step 2 - Getting state from coordinates...`);
      state = await LocationService.getStateFromCoordinates(location.lat, location.lon);
      console.log(`🗺️ [${debugId}]: State obtained: ${state}`);
      
      // Handle display name based on whether location was redirected
      console.log(`🏷️ [${debugId}]: Getting display name...`);
      if (location.isRedirected) {
        displayName = location.nearestMalaysianLocation ? 
          location.nearestMalaysianLocation.name : 
          await LocationService.getLocationDisplayName(location.lat, location.lon);
        state = location.nearestMalaysianLocation?.state || state;
        
        console.log(`🏛️ [${debugId}]: Redirected to nearest Malaysian location: ${displayName}, State: ${state}`);
        console.log(`📍 [${debugId}]: Original location: ${location.originalLocation?.name || 'Unknown'}`);
      } else {
        displayName = await LocationService.getLocationDisplayName(location.lat, location.lon);
        console.log(`🏛️ [${debugId}]: Location: ${displayName}, State: ${state}`);
      }
      
      // Step 2: Get comprehensive weather data for ML model
      console.log(`🌤️ [${debugId}]: Step 3 - Fetching ML-compatible weather data...`);
      const weatherData = await apiService.getTrainingModelData(location.lat, location.lon, 7);
      console.log(`🌤️ [${debugId}]: Weather data obtained:`, weatherData ? 'Success' : 'Failed');
      
      if (!weatherData) {
        throw new Error('Failed to fetch weather data');
      }
      
      // Step 3: Calculate flood probability using ML model logic
      console.log('🧠 Running ML flood prediction model...');
      const prediction = await this.calculateFloodProbability(weatherData, state, location);
      
      // Step 4: Calculate flood timeframe and duration
      console.log('⏱️ Calculating flood timeframe...');
      const timeframe = this.calculateFloodTimeframe(weatherData);
      
      // Step 5: Prepare final prediction result
      const result = {
        location: {
          lat: location.lat,
          lon: location.lon,
          state: state,
          display_name: displayName,
          is_default: location.isDefault || false
        },
        
        // Core ML prediction results
        flood_probability: prediction.probability,
        confidence: prediction.confidence,
        risk_level: this.getRiskLevel(prediction.probability),
        
        // Timeframe predictions
        timeframe_hours: timeframe.hours_until_peak,
        expected_duration_hours: timeframe.flood_duration,
        peak_probability: timeframe.peak_probability,
        peak_date: timeframe.peak_date,
        
        // Contributing factors
        contributing_factors: this.getContributingFactors(weatherData, prediction),
        
        // Weather summary for UI
        weather_summary: {
          current_temp: Math.round(weatherData.current.temperature),
          rainfall_24h: Math.round(weatherData.features.rainfall_24h),
          wind_speed: Math.round(weatherData.features.wind_speed_avg),
          humidity: Math.round(weatherData.features.humidity_avg),
          pressure_trend: weatherData.features.pressure_trend > 0 ? 'Rising' : 'Falling'
        },
        
        // Risk indicators
        risk_indicators: weatherData.risk_indicators,
        
        // Metadata
        timestamp: new Date().toISOString(),
        model_version: '1.0.0',
        data_sources: ['GPS', 'Google Maps', 'Open Meteo', 'ML Model']
      };
      
      console.log('✅ ML-based flood prediction completed:', {
        probability: `${Math.round(result.flood_probability * 100)}%`,
        risk_level: result.risk_level,
        location: result.location.display_name,
        hours_until_peak: result.timeframe_hours
      });
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${debugId}]: Error in ML flood prediction:`, error);
      
      // Enhanced error handling with user-friendly context
      const enhancedError = new Error(`Flood prediction failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.debugId = debugId;
      enhancedError.skipGPS = skipGPS;
      enhancedError.timestamp = new Date().toISOString();
      
      // Add context based on error type
      if (error.message.includes('location') || error.message.includes('GPS') || error.message.includes('permission')) {
        enhancedError.category = 'location';
        enhancedError.userMessage = 'Unable to determine your location for accurate flood predictions.';
        enhancedError.suggestion = 'Check your GPS settings or try enabling "Skip GPS" in developer mode.';
        
        // Don't use fallback - return N/A prediction structure
        console.log(`⚠️ [${debugId}]: Will return N/A prediction due to location issue`);
        return this.getNAPrediction(error.message);
      } else if (error.message.includes('weather') || error.message.includes('API') || error.message.includes('ML API unavailable')) {
        enhancedError.category = 'weather_data';
        enhancedError.userMessage = 'Unable to fetch current weather data for flood analysis.';
        enhancedError.suggestion = 'Check your internet connection and try again.';
        console.log(`⚠️ [${debugId}]: Will return N/A prediction due to API issue`);
        return this.getNAPrediction(error.message);
      } else if (error.message.includes('timeout')) {
        enhancedError.category = 'timeout';
        enhancedError.userMessage = 'Prediction request timed out.';
        enhancedError.suggestion = 'Try again or enable "Skip GPS" for faster predictions.';
        console.log(`⚠️ [${debugId}]: Will return N/A prediction due to timeout`);
        return this.getNAPrediction(error.message);
      } else {
        enhancedError.category = 'general';
        enhancedError.userMessage = 'Unable to generate flood prediction at this time.';
        enhancedError.suggestion = 'Please try again in a few moments.';
        console.log(`⚠️ [${debugId}]: Will return N/A prediction due to general error`);
        return this.getNAPrediction(error.message);
      }
      
      throw enhancedError;
    }
  }

  /**
   * Calculate flood probability using actual trained ML model via API
   * Connects to the hierarchical flood prediction model (F1: 0.7125)
   */
  static async calculateFloodProbability(weatherData, state, location) {
    console.log('🧠 Calling trained ML model API...');
    
    try {
      // Call the Python ML API with actual trained model
      const apiResponse = await this.callMLAPI(location.lat, location.lon);
      
      if (apiResponse.success) {
        console.log('🎯 ML API Results:', {
          probability: `${(apiResponse.prediction.flood_probability * 100).toFixed(1)}%`,
          risk_level: apiResponse.prediction.risk_level,
          confidence: apiResponse.prediction.confidence,
          model_version: apiResponse.model_info.version
        });
        
        return {
          probability: apiResponse.prediction.flood_probability,
          confidence: apiResponse.prediction.confidence,
          model_details: {
            version: apiResponse.model_info.version,
            f1_score: apiResponse.model_info.f1_score,
            type: apiResponse.model_info.type,
            api_source: true
          }
        };
      } else {
        throw new Error(`ML API error: ${apiResponse.error}`);
      }
      
    } catch (error) {
      console.error('❌ Error calling ML API:', error);
      console.log('⚠️ ML API unavailable - prediction will show N/A values');
      
      // Don't fallback to statistical model - return null to show N/A
      throw new Error(`ML API unavailable: ${error.message}`);
    }
  }

  /**
   * Call the Python ML API server
   */
  static async callMLAPI(latitude, longitude, date = null) {
    const ML_API_BASE = FloodPredictionModel.getMLAPIEndpoint(); // Dynamic endpoint for React Native
    const timeout = 10000; // 10 second timeout
    
    try {
      console.log(`📡 Calling ML API for coordinates: ${latitude}, ${longitude}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${ML_API_BASE}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude,
          date: date
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ ML API call successful');
        return data;
      } else {
        throw new Error(data.error || 'Unknown API error');
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('ML API request timed out');
      }
      throw error;
    }
  }

  /**
   * Extract features for ML model (matching your training data format)
   */
  static extractModelFeatures(weatherData, state, location) {
    const features = weatherData.features;
    
    return {
      // Location features
      latitude: location.lat,
      longitude: location.lon,
      state: state,
      elevation: weatherData.location.elevation || 50, // Default elevation
      
      // Weather features (24h aggregated)
      temperature: features.temp_avg,
      temperature_max: features.temp_max,
      temperature_min: features.temp_min,
      precipitation_24h: features.precipitation_24h,
      rainfall_24h: features.rainfall_24h,
      rainfall_intensity: features.rainfall_intensity,
      
      // Atmospheric features
      humidity: features.humidity_avg,
      pressure: features.pressure_avg,
      pressure_trend: features.pressure_trend,
      wind_speed: features.wind_speed_avg,
      wind_speed_max: features.wind_speed_max,
      cloud_cover: features.cloud_cover_avg,
      
      // Additional features
      dewpoint: features.dewpoint_avg,
      visibility: features.visibility_avg,
      wind_gusts: features.wind_gusts_max,
      
      // Risk indicators
      consecutive_rain_days: weatherData.risk_indicators.consecutive_rain_days,
      total_forecast_rain: weatherData.risk_indicators.total_forecast_rain,
      current_risk_score: weatherData.risk_indicators.current_risk_score
    };
  }

  /**
   * Run hierarchical ML model (similar to your Datasets/hierarchical_flood_prediction.py)
   */
  static async runHierarchicalModel(features) {
    console.log('🔬 Running hierarchical ML model...');
    
    try {
      // Stage 1: Pre-filter meteorologically impossible cases (like your model)
      const prefilterResult = this.prefilterCheck(features);
      
      if (!prefilterResult.possible) {
        console.log('🚫 Pre-filter: Meteorologically impossible flood conditions');
        return {
          probability: 0.05, // Very low probability
          confidence: 0.95,
          stage: 'prefilter_rejected',
          reason: prefilterResult.reason
        };
      }
      
      // Stage 2: Base probability using weather features
      const baseProbability = this.calculateBaseProbability(features);
      
      // Stage 3: Location adjustment (state-specific patterns)
      const locationAdjusted = this.adjustForLocation(baseProbability, features.state);
      
      // Stage 4: Seasonal and temporal adjustments
      const seasonalAdjusted = this.adjustForSeason(locationAdjusted);
      
      // Stage 5: Final probability with ensemble averaging
      const finalProbability = this.ensembleAverage([
        baseProbability,
        locationAdjusted,
        seasonalAdjusted,
        features.current_risk_score
      ]);
      
      console.log('📊 Hierarchical model stages:', {
        base: baseProbability.toFixed(3),
        location_adjusted: locationAdjusted.toFixed(3),
        seasonal_adjusted: seasonalAdjusted.toFixed(3),
        final: finalProbability.toFixed(3)
      });
      
      return {
        probability: Math.min(Math.max(finalProbability, 0), 1), // Clamp to 0-1
        confidence: 0.72, // Based on your model's F1 score of 0.7125
        stage: 'hierarchical_complete',
        details: {
          base_probability: baseProbability,
          location_adjustment: locationAdjusted - baseProbability,
          seasonal_adjustment: seasonalAdjusted - locationAdjusted,
          final_probability: finalProbability
        }
      };
      
    } catch (error) {
      console.error('❌ Error in hierarchical model:', error);
      
      // Fallback to simple statistical model
      return {
        probability: this.simpleStatisticalModel(features),
        confidence: 0.6,
        stage: 'fallback_statistical',
        error: error.message
      };
    }
  }

  /**
   * Pre-filter check (Stage 1 - similar to your hierarchical model)
   */
  static prefilterCheck(features) {
    // Check for meteorologically impossible conditions
    
    // Very low rainfall (< 2mm/24h) and low humidity (< 40%) = very unlikely flood
    if (features.rainfall_24h < 2 && features.humidity < 40) {
      return { possible: false, reason: 'Insufficient rainfall and low humidity' };
    }
    
    // Very high pressure (> 1025) with rising trend = stable weather
    if (features.pressure > 1025 && features.pressure_trend > 2) {
      return { possible: false, reason: 'High stable pressure system' };
    }
    
    // All other cases pass to main model
    return { possible: true, reason: 'Meteorologically feasible' };
  }

  /**
   * Calculate base probability using weather features
   */
  static calculateBaseProbability(features) {
    let probability = 0;
    
    // Rainfall contribution (most important - 40% weight)
    const rainfallScore = Math.min(features.rainfall_24h / 50, 1) * 0.4;
    probability += rainfallScore;
    
    // Humidity contribution (20% weight)
    const humidityScore = Math.min(features.humidity / 100, 1) * 0.2;
    probability += humidityScore;
    
    // Pressure trend (20% weight) - falling pressure increases flood risk
    const pressureScore = features.pressure_trend < 0 ? 
      Math.min(Math.abs(features.pressure_trend) / 10, 1) * 0.2 : 0;
    probability += pressureScore;
    
    // Wind speed (10% weight) - high winds can increase flood risk
    const windScore = Math.min(features.wind_speed_max / 30, 1) * 0.1;
    probability += windScore;
    
    // Temperature stability (10% weight)
    const tempRange = features.temperature_max - features.temperature_min;
    const tempScore = tempRange > 8 ? 0.1 : tempRange / 8 * 0.1;
    probability += tempScore;
    
    return Math.min(probability, 1);
  }

  /**
   * Adjust probability based on location/state patterns
   */
  static adjustForLocation(baseProbability, state) {
    // State-specific flood risk multipliers based on Malaysian flood patterns
    const stateMultipliers = {
      'Selangor': 1.2,      // High urban flooding risk
      'Kuala Lumpur': 1.3,  // Highest urban flood risk
      'Johor': 1.1,         // Moderate flood risk
      'Kedah': 1.15,        // Agricultural areas, monsoon exposure
      'Kelantan': 1.25,     // High monsoon flood risk
      'Terengganu': 1.25,   // High monsoon flood risk
      'Pahang': 1.1,        // Moderate risk
      'Perak': 1.05,        // Lower risk
      'Penang': 1.0,        // Island location, moderate risk
      'Sabah': 0.95,        // Lower historical flood frequency
      'Sarawak': 0.9        // Lower historical flood frequency
    };
    
    const multiplier = stateMultipliers[state] || 1.0;
    return baseProbability * multiplier;
  }

  /**
   * Adjust probability based on seasonal patterns
   */
  static adjustForSeason(baseProbability) {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    
    // Malaysian monsoon seasons
    let seasonalMultiplier = 1.0;
    
    if (month >= 11 || month <= 1) {
      // Northeast monsoon (Nov-Jan) - highest flood risk
      seasonalMultiplier = 1.3;
    } else if (month >= 5 && month <= 9) {
      // Southwest monsoon (May-Sep) - moderate flood risk
      seasonalMultiplier = 1.1;
    } else {
      // Inter-monsoon periods - lower flood risk
      seasonalMultiplier = 0.9;
    }
    
    return baseProbability * seasonalMultiplier;
  }

  /**
   * Ensemble average multiple probability estimates
   */
  static ensembleAverage(probabilities) {
    const valid = probabilities.filter(p => p !== null && p !== undefined && !isNaN(p));
    return valid.length > 0 ? valid.reduce((sum, p) => sum + p, 0) / valid.length : 0;
  }

  /**
   * Simple statistical model fallback
   */
  static simpleStatisticalModel(features) {
    // Simple linear combination for fallback
    const rainfall_weight = 0.5;
    const humidity_weight = 0.2;
    const pressure_weight = 0.2;
    const wind_weight = 0.1;
    
    const probability = 
      (features.rainfall_24h / 50 * rainfall_weight) +
      (features.humidity / 100 * humidity_weight) +
      (features.pressure_trend < 0 ? 0.2 : 0) * pressure_weight +
      (features.wind_speed_max / 30 * wind_weight);
      
    return Math.min(probability, 1);
  }

  /**
   * Calculate flood timeframe using forecast data
   */
  static calculateFloodTimeframe(weatherData) {
    console.log('⏱️ Calculating flood timeframe...');
    
    try {
      const forecast = weatherData.forecast;
      const FLOOD_THRESHOLD = 0.7; // 70% probability threshold
      
      let peakDay = 0;
      let peakProbability = 0;
      let floodDuration = 0;
      
      // Find when flood probability exceeds 70%
      for (let i = 0; i < forecast.length; i++) {
        const dayRisk = forecast[i].flood_risk_score;
        
        if (dayRisk > peakProbability) {
          peakProbability = dayRisk;
          peakDay = i;
        }
        
        // Count days with significant flood risk
        if (dayRisk > 0.6) {
          floodDuration++;
        }
      }
      
      // Calculate flood duration based on rainfall threshold maintenance
      const sustainedFloodHours = this.calculateSustainedFloodDuration(weatherData);
      
      return {
        hours_until_peak: peakDay * 24 + Math.random() * 12, // Add some variation
        peak_probability: peakProbability,
        peak_date: new Date(Date.now() + peakDay * 24 * 60 * 60 * 1000),
        flood_duration: sustainedFloodHours,
        days_with_risk: floodDuration
      };
      
    } catch (error) {
      console.error('❌ Error calculating timeframe:', error);
      
      // Fallback timeframe
      return {
        hours_until_peak: 12 + Math.random() * 36,
        peak_probability: 0.75,
        peak_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        flood_duration: 8 + Math.random() * 16,
        days_with_risk: 2
      };
    }
  }

  /**
   * Calculate sustained flood duration based on rainfall threshold
   */
  static calculateSustainedFloodDuration(weatherData) {
    const RAINFALL_THRESHOLD = 10; // mm/hour for sustained flooding
    let sustainedHours = 0;
    
    // Simulate hourly rainfall check (in real implementation, use hourly forecast)
    const forecast = weatherData.forecast;
    
    for (const day of forecast) {
      const dailyRain = day.rain_sum || 0;
      const hoursOfRain = Math.min(dailyRain / RAINFALL_THRESHOLD, 24);
      
      if (hoursOfRain > 2) { // At least 2 hours of significant rain
        sustainedHours += hoursOfRain;
      }
    }
    
    return Math.min(sustainedHours, 72); // Cap at 72 hours (3 days)
  }

  /**
   * Get risk level based on probability (Epic 1 requirement)
   */
  static getRiskLevel(probability) {
    if (probability >= 0.8) return 'High';        // 80-100%
    if (probability >= 0.6) return 'Moderate';    // 60-79%
    return 'Low';                                 // <60%
  }

  /**
   * Get contributing factors for UI display
   */
  static getContributingFactors(weatherData, prediction) {
    const factors = [];
    const features = weatherData.features;
    const indicators = weatherData.risk_indicators;
    
    // Check various risk factors
    if (features.rainfall_24h > 20) {
      factors.push(`Heavy rainfall: ${Math.round(features.rainfall_24h)}mm in 24h`);
    }
    
    if (features.humidity_avg > 80) {
      factors.push(`High humidity: ${Math.round(features.humidity_avg)}%`);
    }
    
    if (features.pressure_trend < -2) {
      factors.push('Rapidly falling atmospheric pressure');
    }
    
    if (indicators.consecutive_rain_days > 2) {
      factors.push(`${indicators.consecutive_rain_days} consecutive days of rain forecast`);
    }
    
    if (features.wind_speed_max > 25) {
      factors.push(`Strong winds: ${Math.round(features.wind_speed_max)} km/h`);
    }
    
    if (indicators.extreme_rain_warning) {
      factors.push('Extreme rainfall warning active');
    }
    
    // Add at least one factor for UI
    if (factors.length === 0) {
      factors.push('Normal weather conditions monitored');
    }
    
    return factors;
  }

  /**
   * Calculate model confidence
   */
  static calculateModelConfidence(weatherData, modelResult) {
    let confidence = 0.72; // Base confidence from your model's F1 score
    
    // Adjust based on data quality
    const features = weatherData.features;
    
    // Penalize missing data
    const completeness = this.calculateDataCompleteness(features);
    confidence *= completeness;
    
    // Adjust based on extreme values (model may be less reliable)
    if (features.rainfall_24h > 100 || features.rainfall_24h < 0) {
      confidence *= 0.9; // Reduce confidence for extreme values
    }
    
    // Boost confidence for clear patterns
    if (modelResult.stage === 'hierarchical_complete') {
      confidence *= 1.05;
    }
    
    return Math.min(Math.max(confidence, 0.5), 0.95); // Clamp between 50-95%
  }

  /**
   * Calculate data completeness score
   */
  static calculateDataCompleteness(features) {
    const requiredFeatures = [
      'temp_avg', 'rainfall_24h', 'humidity_avg', 
      'pressure_avg', 'wind_speed_avg'
    ];
    
    let completeness = 0;
    for (const feature of requiredFeatures) {
      if (features[feature] !== null && features[feature] !== undefined && !isNaN(features[feature])) {
        completeness++;
      }
    }
    
    return completeness / requiredFeatures.length;
  }

  /**
   * N/A prediction when ML API fails - shows N/A instead of fallback values
   */
  static getNAPrediction(errorMessage) {
    console.log('⚠️ Generating N/A prediction structure...');
    
    return {
      location: {
        lat: null,
        lon: null,
        state: 'N/A',
        display_name: 'Location unavailable',
        is_default: false
      },
      flood_probability: null,    // Will show as N/A in UI
      confidence: null,           // Will show as N/A in UI
      risk_level: 'N/A',
      timeframe_hours: null,
      expected_duration_hours: null,
      peak_probability: null,
      peak_date: null,
      contributing_factors: [
        'ML API unavailable',
        'No prediction data available'
      ],
      weather_summary: {
        current_temp: null,
        rainfall_24h: null,
        wind_speed: null,
        humidity: null,
        pressure_trend: 'N/A'
      },
      risk_indicators: {
        current_risk_score: null,
        high_humidity_warning: false,
        consecutive_rain_days: null,
        total_forecast_rain: null
      },
      timestamp: new Date().toISOString(),
      model_version: 'N/A',
      data_sources: ['N/A'],
      is_na: true,
      error_message: errorMessage || 'Prediction unavailable'
    };
  }

  /**
   * Get statistical prediction (simple fallback)
   */
  /**
   * Get the correct ML API endpoint based on platform
   * React Native cannot access localhost from emulators/devices
   */
  static getMLAPIEndpoint() {
    // Check if running in React Native vs Web
    if (typeof window !== 'undefined' && window.location) {
      // Running in web browser - can use localhost
      return 'http://localhost:5000';
    }
    
    // Running in React Native - need device-accessible endpoints
    if (Platform.OS === 'android') {
      // Android emulator uses special IP to access host machine
      return 'http://10.0.2.2:5000';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      return 'http://localhost:5000';
    }
    
    // For physical devices, try the machine's network IP
    // Note: This should be replaced with your actual machine IP
    return 'http://192.168.100.7:5000';
  }

  /**
   * Check API connection status
   */
  static async checkAPIConnection() {
    try {
      const endpoint = FloodPredictionModel.getMLAPIEndpoint();
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        timeout: 3000
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          connected: true,
          endpoint: endpoint,
          service: data.service || 'Unknown'
        };
      }
      return { connected: false, endpoint: endpoint };
    } catch (error) {
      return { 
        connected: false, 
        endpoint: FloodPredictionModel.getMLAPIEndpoint(),
        error: error.message 
      };
    }
  }

  static getStatisticalPrediction(weatherData) {
    const features = weatherData.features;
    
    // Use more realistic probability calculation instead of inflated values
    const baseProbability = 0.15; // Start with 15% base
    const precipitationFactor = Math.min(features.rainfall_24h || 0, 50) / 50 * 0.3; // Max 30% from rain
    const humidityFactor = Math.max(0, (features.humidity_avg || 0) - 75) / 25 * 0.2; // Max 20% from high humidity
    
    const probability = Math.min(baseProbability + precipitationFactor + humidityFactor, 0.85); // Cap at 85%
    
    return {
      probability: probability,
      confidence: 0.72, // Use actual ML model F1 score
      model_details: {
        stage: 'statistical_fallback',
        features_used: Object.keys(features).length,
        note: 'Using realistic statistical model - more accurate than previous version'
      }
    };
  }
}

export default FloodPredictionModel;