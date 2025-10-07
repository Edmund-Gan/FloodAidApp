/**
 * EmbeddedMLService.js - Embedded Machine Learning Service for Flood Prediction
 * Replaces external Python API with embedded JavaScript ML model
 * Port of coordinate_flood_api.py 31-feature model logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import modelConfig from '../assets/ml-models/model-config.json';
import XGBoostEngine from './XGBoostEngine';
import { getRiskLevel } from '../utils/RiskCalculations';

class EmbeddedMLService {
  constructor() {
    this.modelConfig = null;
    this.xgboostEngine = null; // Real ML model engine
    this.isInitialized = false;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the embedded ML service and load model configuration
   */
  async initialize() {
    try {
      console.log('Initializing EmbeddedMLService with REAL ML models...');

      // Use directly imported model configuration (for compatibility)
      this.modelConfig = modelConfig;

      // Initialize REAL XGBoost engine with actual trained models
      try {
        this.xgboostEngine = new XGBoostEngine();
        const stats = this.xgboostEngine.getStatistics();
        console.log(`🚀 REAL ML: ${stats.totalModels} models, ${(stats.averageF1Score * 100).toFixed(1)}% avg F1`);
        console.log('❌ REMOVED: Fake 80.95% rule-based claims');
      } catch (mlError) {
        console.error('XGBoost engine failed, falling back to rules:', mlError);
        this.xgboostEngine = null;
      }

      this.isInitialized = true;
      console.log('EmbeddedMLService initialized successfully');

    } catch (error) {
      console.error('Error initializing EmbeddedMLService:', error);
      throw error;
    }
  }

  /**
   * Get Malaysian state from coordinates using fallback coordinate detection
   * Port of _fallback_coordinate_detection from Python
   */
  getStateFromCoordinates(latitude, longitude) {
    // Sabah (North Borneo)
    if (latitude >= 4.0 && latitude <= 7.5 && longitude >= 115.0 && longitude <= 119.5) {
      return 'SABAH';
    }
    
    // Sarawak (Northwest Borneo)
    if (latitude >= 0.8 && latitude <= 5.0 && longitude >= 109.0 && longitude <= 115.5) {
      return 'SARAWAK';
    }
    
    // Peninsular Malaysia states
    if (latitude >= 1.0 && latitude <= 6.8 && longitude >= 99.0 && longitude <= 105.0) {
      // Kelantan (Northeast)
      if (latitude >= 4.5 && latitude <= 6.8 && longitude >= 101.0 && longitude <= 102.5) {
        return 'KELANTAN';
      }
      
      // Terengganu (East coast)
      if (latitude >= 4.0 && latitude <= 5.8 && longitude >= 102.5 && longitude <= 103.8) {
        return 'TERENGGANU';
      }
      
      // Pahang (Central-East)
      if (latitude >= 2.5 && latitude <= 4.8 && longitude >= 101.0 && longitude <= 103.5) {
        return 'PAHANG';
      }
      
      // Perak (West coast)
      if (latitude >= 3.5 && latitude <= 5.8 && longitude >= 100.0 && longitude <= 101.5) {
        return 'PERAK';
      }
      
      // Selangor (Central west)
      if (latitude >= 2.8 && latitude <= 4.0 && longitude >= 100.8 && longitude <= 102.0) {
        return 'SELANGOR';
      }
      
      // Kuala Lumpur / Wilayah Persekutuan
      if (latitude >= 3.0 && latitude <= 3.3 && longitude >= 101.5 && longitude <= 101.8) {
        return 'WILAYAH PERSEKUTUAN';
      }
      
      // Johor (South)
      if (latitude >= 1.0 && latitude <= 2.8 && longitude >= 102.5 && longitude <= 104.5) {
        return 'JOHOR';
      }
      
      // Kedah (Northwest)
      if (latitude >= 5.0 && latitude <= 6.8 && longitude >= 99.5 && longitude <= 101.0) {
        return 'KEDAH';
      }
      
      // Perlis (Far north)
      if (latitude >= 6.2 && latitude <= 6.8 && longitude >= 99.8 && longitude <= 100.3) {
        return 'PERLIS';
      }
      
      // Pulau Pinang (Northwest coast)
      if (latitude >= 5.1 && latitude <= 5.6 && longitude >= 100.0 && longitude <= 100.5) {
        return 'PULAU PINANG';
      }
      
      // Melaka (Southwest coast)
      if (latitude >= 2.0 && latitude <= 2.5 && longitude >= 102.0 && longitude <= 102.5) {
        return 'MELAKA';
      }
      
      // Negeri Sembilan (Central)
      if (latitude >= 2.3 && latitude <= 3.2 && longitude >= 101.5 && longitude <= 102.8) {
        return 'NEGERI SEMBILAN';
      }
    }
    
    // Default to Selangor if cannot determine
    console.warn(`Could not determine state for coordinates ${latitude}, ${longitude}. Defaulting to SELANGOR`);
    return 'SELANGOR';
  }

  /**
   * Calculate monsoon features based on date
   * Port of _calculate_monsoon_features from Python
   */
  calculateMonsoonFeatures(date) {
    const targetDate = new Date(date);
    const month = targetDate.getMonth() + 1; // 1-12
    const dayOfYear = this.getDayOfYear(targetDate);
    
    let monsoonSeason, monsoonPhase, daysSinceMonsoonStart, monsoonIntensity, monsoonName;
    
    // Determine monsoon season using model config
    if (this.modelConfig.monsoon_patterns.northeast.months.includes(month)) {
      // Northeast monsoon
      monsoonSeason = this.modelConfig.monsoon_patterns.northeast.season_code;
      monsoonIntensity = this.modelConfig.monsoon_patterns.northeast.intensity;
      monsoonName = 'Northeast';
      
      if (month === 11 || month === 12) {
        monsoonPhase = 0; // Early
      } else if (month === 1) {
        monsoonPhase = 1; // Peak
      } else { // Feb-Mar
        monsoonPhase = 2; // Late
      }
    } else if (this.modelConfig.monsoon_patterns.southwest.months.includes(month)) {
      // Southwest monsoon
      monsoonSeason = this.modelConfig.monsoon_patterns.southwest.season_code;
      monsoonIntensity = this.modelConfig.monsoon_patterns.southwest.intensity;
      monsoonName = 'Southwest';
      
      if (month === 5 || month === 6) {
        monsoonPhase = 0; // Early
      } else if (month === 7 || month === 8) {
        monsoonPhase = 1; // Peak
      } else { // Sep
        monsoonPhase = 2; // Late
      }
    } else {
      // Inter-monsoon
      monsoonSeason = this.modelConfig.monsoon_patterns.inter_monsoon.season_code;
      monsoonIntensity = this.modelConfig.monsoon_patterns.inter_monsoon.intensity;
      monsoonName = 'Inter-monsoon';
      monsoonPhase = 3; // Transition
    }
    
    // Calculate days since monsoon start
    let monsoonStart;
    if (monsoonSeason === 0) { // Northeast starts Nov 1
      if (month >= 11) {
        monsoonStart = new Date(targetDate.getFullYear(), 10, 1); // November 1
      } else { // Jan-Mar of next year
        monsoonStart = new Date(targetDate.getFullYear() - 1, 10, 1);
      }
    } else if (monsoonSeason === 1) { // Southwest starts May 1
      monsoonStart = new Date(targetDate.getFullYear(), 4, 1); // May 1
    } else { // Inter-monsoon (Apr or Oct)
      if (month === 4) {
        monsoonStart = new Date(targetDate.getFullYear(), 3, 1); // April 1
      } else { // October
        monsoonStart = new Date(targetDate.getFullYear(), 9, 1); // October 1
      }
    }
    
    daysSinceMonsoonStart = Math.floor((targetDate - monsoonStart) / (1000 * 60 * 60 * 24));
    
    return {
      monsoon_season_encoded: monsoonSeason,
      monsoon_phase_encoded: monsoonPhase,
      days_since_monsoon_start: daysSinceMonsoonStart,
      monsoon_intensity: monsoonIntensity,
      monsoon_name: monsoonName
    };
  }

  /**
   * Create monthly one-hot encoded features
   * Port of _create_monthly_features from Python
   */
  createMonthlyFeatures(date) {
    const targetDate = new Date(date);
    const month = targetDate.getMonth() + 1; // 1-12
    
    const monthlyFeatures = {};
    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                   'july', 'august', 'september', 'october', 'november', 'december'];
    
    months.forEach((monthName, index) => {
      monthlyFeatures[`is_${monthName}`] = month === (index + 1) ? 1.0 : 0.0;
    });
    
    return monthlyFeatures;
  }

  /**
   * Extract weather features from weather data
   * Simplified version for embedded use with default fallbacks
   */
  extractWeatherFeatures(weatherData, latitude, longitude) {
    const features = {};
    
    // Set coordinates
    features.latitude = latitude;
    features.longitude = longitude;
    
    // Use default values from config or provided weather data
    const defaults = this.modelConfig.default_values;
    
    if (weatherData && weatherData.features) {
      // Use provided weather data
      features.elevation = weatherData.features.elevation || defaults.elevation;
      features.temp_max = weatherData.features.temp_max || defaults.temp_max;
      features.temp_min = weatherData.features.temp_min || defaults.temp_min;
      features.temp_mean = weatherData.features.temp_mean || defaults.temp_mean;
      features.precipitation_sum = weatherData.features.precipitation_sum || defaults.precipitation_sum;
      features.rain_sum = weatherData.features.rain_sum || defaults.rain_sum;
      features.precipitation_hours = weatherData.features.precipitation_hours || defaults.precipitation_hours;
      features.wind_speed_max = weatherData.features.wind_speed_max || defaults.wind_speed_max;
      features.wind_gusts_max = weatherData.features.wind_gusts_max || defaults.wind_gusts_max;
      features.wind_direction = weatherData.features.wind_direction || defaults.wind_direction;
      features.river_discharge = weatherData.features.river_discharge || defaults.river_discharge;
      features.river_discharge_mean = weatherData.features.river_discharge_mean || defaults.river_discharge_mean;
      features.river_discharge_median = weatherData.features.river_discharge_median || defaults.river_discharge_median;
    } else {
      // Use all default values
      Object.assign(features, defaults);
    }
    
    return features;
  }

  /**
   * Create the complete 31-feature vector for prediction
   * Port of _create_feature_vector from Python
   */
  createFeatureVector(weatherData, latitude, longitude, date) {
    try {
      // Extract weather features (15 features)
      const weatherFeatures = this.extractWeatherFeatures(weatherData, latitude, longitude);
      
      // Calculate monsoon features (4 features)
      const monsoonFeatures = this.calculateMonsoonFeatures(date);
      
      // Create monthly features (12 features)
      const monthlyFeatures = this.createMonthlyFeatures(date);
      
      // Combine all features in the required order
      const featureOrder = this.modelConfig.feature_order;
      const allFeatures = { ...weatherFeatures, ...monsoonFeatures, ...monthlyFeatures };
      
      const featureVector = [];
      
      featureOrder.forEach(featureName => {
        if (featureName in allFeatures) {
          featureVector.push(allFeatures[featureName]);
        } else {
          console.warn(`Missing feature: ${featureName}, using default value 0.0`);
          featureVector.push(0.0);
        }
      });
      
      // Validate feature vector
      if (featureVector.length !== 31) {
        throw new Error(`Feature vector has ${featureVector.length} features, expected 31`);
      }
      
      // Check for null/NaN values
      if (featureVector.some(val => val === null || val === undefined || isNaN(val))) {
        throw new Error('Feature vector contains null/NaN values');
      }
      
      console.log(`Created feature vector with ${featureVector.length} features`);
      return featureVector;
      
    } catch (error) {
      console.error('Error creating feature vector:', error);
      throw error;
    }
  }

  /**
   * Embedded ML prediction using rule-based system
   * (Since we can't easily port complex ML models, we use enhanced rule-based system)
   */
  async predictFloodRisk(latitude, longitude, date = null, weatherData = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Use current date if not provided
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      console.log(`Predicting flood risk for coordinates: ${latitude}, ${longitude} on ${targetDate}`);

      // Validate coordinates
      if (latitude === null || latitude === undefined || longitude === null || longitude === undefined ||
          isNaN(latitude) || isNaN(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
      }
      
      // Check cache first
      const cacheKey = `prediction_${latitude}_${longitude}_${targetDate}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('Using cached prediction');
          return cached.data;
        }
      }
      
      // Determine Malaysian state
      const detectedState = this.getStateFromCoordinates(latitude, longitude);
      
      // Create feature vector
      const featureVector = this.createFeatureVector(weatherData, latitude, longitude, targetDate);
      
      // Calculate flood probability using REAL XGBoost models (not fake rules!)
      let prediction, contributingFactors;

      if (this.xgboostEngine) {
        // Use REAL trained ML models with actual 83-90% F1-scores
        const mlPrediction = this.xgboostEngine.predict(featureVector, detectedState);
        prediction = {
          probability: mlPrediction.probability,
          confidence: mlPrediction.confidence,
          risk_level: this.getRiskLevel(mlPrediction.probability),
          modelUsed: mlPrediction.modelUsed,
          actualPerformance: mlPrediction.actualPerformance
        };
        contributingFactors = mlPrediction.contributingFactors;
        console.log(`🤖 REAL ML: ${mlPrediction.modelUsed} model, ${(mlPrediction.actualPerformance.f1_score * 100).toFixed(1)}% F1-score`);
      } else {
        // Fallback to old rule-based system (should not happen in production)
        console.warn('⚠️ Using fallback rules (REAL models failed to load)');
        prediction = this.calculateFloodProbabilityRuleBased(featureVector, detectedState, targetDate);
        contributingFactors = this.calculateFeatureContributions(featureVector, 8);
      }
      
      // Get model metadata
      const monsoonFeatures = this.calculateMonsoonFeatures(targetDate);
      const weatherFeatures = this.extractWeatherFeatures(weatherData, latitude, longitude);
      
      // Prepare response in same format as Python API
      const response = {
        success: true,
        risk_level: prediction.risk_level,
        flood_probability: Math.round(prediction.probability * 10000) / 10000, // Round to 4 decimal places
        confidence: prediction.confidence,
        location_info: {
          state: detectedState,
          coordinates: [latitude, longitude]
        },
        weather_summary: {
          temp_max: weatherFeatures.temp_max,
          precipitation_sum: weatherFeatures.precipitation_sum,
          rain_sum: weatherFeatures.rain_sum,
          wind_speed_max: weatherFeatures.wind_speed_max,
          wind_gusts_max: weatherFeatures.wind_gusts_max,
          river_discharge: weatherFeatures.river_discharge,
          monsoon_season: monsoonFeatures.monsoon_name
        },
        prediction_details: {
          model_used: prediction.modelUsed || 'Fallback Rules',
          model_key: detectedState,
          features_count: 31,
          f1_score: prediction.actualPerformance ? prediction.actualPerformance.f1_score : this.modelConfig.f1_score,
          prediction_date: targetDate,
          binary_prediction: prediction.probability > 0.5 ? 1 : 0,
          using_real_ml: this.xgboostEngine !== null,
          actual_performance: prediction.actualPerformance
        },
        api_info: {
          version: this.xgboostEngine ? 'Real-XGBoost-Models-v1.0' : this.modelConfig.model_version,
          model_type: this.xgboostEngine ? 'XGBoost Ensemble (100 trees)' : 'Rule-Based Fallback',
          performance_improvement: this.xgboostEngine ? 'REAL 83-90% F1-scores' : 'Fallback rules'
        },
        contributing_factors: contributingFactors
      };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });
      
      console.log(`Prediction successful - Risk: ${response.risk_level}, Probability: ${(response.flood_probability * 100).toFixed(1)}%`);
      return response;
      
    } catch (error) {
      console.error('Error in embedded flood prediction:', error);
      return {
        success: false,
        error: `Embedded prediction failed: ${error.message}`,
        coordinates: [latitude, longitude]
      };
    }
  }

  /**
   * Enhanced rule-based flood probability calculation
   * Uses insights from the 31-feature ML model
   */
  calculateFloodProbabilityRuleBased(featureVector, state, date) {
    // Feature vector indices based on feature order
    const features = {
      latitude: featureVector[0],
      longitude: featureVector[1],
      temp_max: featureVector[2],
      temp_min: featureVector[3],
      temp_mean: featureVector[4],
      precipitation_sum: featureVector[5],
      rain_sum: featureVector[6],
      precipitation_hours: featureVector[7],
      wind_speed_max: featureVector[8],
      wind_gusts_max: featureVector[9],
      wind_direction: featureVector[10],
      river_discharge: featureVector[11],
      river_discharge_mean: featureVector[12],
      river_discharge_median: featureVector[13],
      elevation: featureVector[14],
      monsoon_season_encoded: featureVector[15],
      monsoon_phase_encoded: featureVector[16],
      days_since_monsoon_start: featureVector[17],
      monsoon_intensity: featureVector[18]
    };
    
    let probability = 0.1; // Base probability
    
    // Weather-based rules (60% of final score)
    
    // Rainfall contribution (most important - 25%)
    if (features.rain_sum > 50) probability += 0.25;
    else if (features.rain_sum > 20) probability += 0.15;
    else if (features.rain_sum > 10) probability += 0.08;
    
    // Precipitation contribution (15%)
    if (features.precipitation_sum > 60) probability += 0.15;
    else if (features.precipitation_sum > 30) probability += 0.10;
    else if (features.precipitation_sum > 15) probability += 0.05;
    
    // Precipitation duration (10%)
    if (features.precipitation_hours > 12) probability += 0.10;
    else if (features.precipitation_hours > 6) probability += 0.06;
    else if (features.precipitation_hours > 3) probability += 0.03;
    
    // Wind conditions (5%)
    if (features.wind_gusts_max > 40) probability += 0.05;
    else if (features.wind_speed_max > 30) probability += 0.03;
    
    // River discharge (5%)
    if (features.river_discharge > 80) probability += 0.05;
    else if (features.river_discharge > 60) probability += 0.03;
    
    // Location-based adjustments (20% of final score)
    const stateMultiplier = this.modelConfig.state_risk_multipliers[state] || 1.0;
    probability *= stateMultiplier;
    
    // Monsoon-based adjustments (20% of final score)
    const monsoonMultiplier = 1 + (features.monsoon_intensity * 0.5);
    probability *= monsoonMultiplier;
    
    // Peak monsoon phase bonus
    if (features.monsoon_phase_encoded === 1) { // Peak phase
      probability *= 1.1;
    }
    
    // Ensure probability is within bounds
    probability = Math.min(Math.max(probability, 0.0), 0.95);
    
    // Determine risk level based on thresholds
    let riskLevel, confidence;
    
    // Base confidence on F1-score (0.8095) and adjust based on prediction certainty
    const baseConfidence = this.modelConfig.f1_score; // 0.8095
    
    if (probability >= this.modelConfig.risk_thresholds.high) {
      riskLevel = 'High';
      confidence = baseConfidence; // High confidence when probability is high
    } else if (probability >= this.modelConfig.risk_thresholds.medium) {
      riskLevel = 'Medium';
      confidence = baseConfidence * 0.9; // Slightly reduced confidence for medium risk
    } else {
      riskLevel = 'Low';
      confidence = probability <= 0.2 ? baseConfidence : baseConfidence * 0.85; // Good confidence for clear low risk
    }
    
    // Debug log for confidence tracking
    console.log(`Confidence calculated: ${confidence.toFixed(4)} (${(confidence * 100).toFixed(1)}%)`);
    
    return {
      probability: probability,
      risk_level: riskLevel,
      confidence: confidence,
      features_used: features
    };
  }

  /**
   * Helper function to get day of year
   */
  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  /**
   * Convert technical ML features into user-friendly explanations
   * Provides context and actionable information for non-technical users
   */
  getUserFriendlyExplanation(featureName, featureValue, contributionScore) {
    // Get current date for context
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Convert feature value and contribution to meaningful context
    const isHighContribution = contributionScore > 0.05;
    const isMediumContribution = contributionScore > 0.02;
    
    switch (featureName) {
      case 'days_since_monsoon_start':
        const daysSince = Math.round(Math.abs(featureValue));
        if (month >= 11 || month <= 3) {
          return {
            title: "Active Northeast Monsoon period",
            description: `Currently day ${daysSince} of monsoon season, the highest risk period for flooding in Malaysia`
          };
        } else if (month >= 5 && month <= 9) {
          return {
            title: "Southwest Monsoon period", 
            description: `Day ${daysSince} of current monsoon, bringing moderate flood risk`
          };
        } else {
          return {
            title: "Inter-monsoon transition",
            description: `Day ${daysSince} since last monsoon, unstable weather patterns increase flood risk`
          };
        }
      
      case 'monsoon_season_encoded':
      case 'monsoon_phase_encoded':
        if (month >= 11 || month <= 3) {
          return {
            title: "Peak flood season active",
            description: "Northeast Monsoon brings 36% higher flood rates across Malaysia"
          };
        } else if (month >= 5 && month <= 9) {
          return {
            title: "Southwest Monsoon period",
            description: "Moderate flood risk with seasonal rainfall patterns"
          };
        } else {
          return {
            title: "Monsoon transition period",
            description: "Unpredictable weather patterns with elevated flood risk"
          };
        }
      
      case 'monsoon_intensity':
        const intensity = Math.round(Math.abs(featureValue * 100));
        if (intensity > 30) {
          return {
            title: "High monsoon intensity",
            description: `Current intensity at ${intensity}%, significantly above normal levels`
          };
        } else {
          return {
            title: "Moderate monsoon activity",
            description: `Intensity at ${intensity}%, within typical seasonal range`
          };
        }
      
      case 'precipitation_sum':
        const precip = Math.round(Math.abs(featureValue));
        if (precip > 50) {
          return {
            title: "Extreme rainfall detected",
            description: `${precip}mm of total precipitation, well above safe thresholds (>50mm)`
          };
        } else if (precip > 30) {
          return {
            title: "Heavy rainfall conditions",
            description: `${precip}mm of precipitation in the forecast period`
          };
        } else if (precip > 15) {
          return {
            title: "Moderate rainfall expected",
            description: `${precip}mm of precipitation, contributing to flood risk`
          };
        } else {
          return {
            title: "Light precipitation",
            description: `${precip}mm detected, minimal direct impact`
          };
        }
      
      case 'rain_sum':
        const rain = Math.round(Math.abs(featureValue));
        if (rain > 40) {
          return {
            title: "Extreme rainfall warning",
            description: `${rain}mm of rain in 24 hours, exceeding critical flood thresholds`
          };
        } else if (rain > 20) {
          return {
            title: "Heavy rain conditions",
            description: `${rain}mm in the last 24 hours, significantly above safe levels`
          };
        } else if (rain > 10) {
          return {
            title: "Moderate rainfall",
            description: `${rain}mm recorded, adding to cumulative flood risk`
          };
        } else {
          return {
            title: "Light rainfall",
            description: `${rain}mm detected, low direct contribution`
          };
        }
      
      case 'precipitation_hours':
        const hours = Math.round(Math.abs(featureValue));
        if (hours > 12) {
          return {
            title: "Extended rainfall period",
            description: `Rain expected for ${hours} hours, increasing soil saturation and flood risk`
          };
        } else if (hours > 8) {
          return {
            title: "Prolonged rain conditions",
            description: `${hours} hours of precipitation, contributing to flood buildup`
          };
        } else {
          return {
            title: "Short rain period",
            description: `${hours} hours of precipitation expected`
          };
        }
      
      case 'wind_speed_max':
        const windSpeed = Math.round(Math.abs(featureValue));
        if (windSpeed > 50) {
          return {
            title: "Extreme wind conditions",
            description: `Maximum winds of ${windSpeed} km/h, can worsen flooding by pushing water inland`
          };
        } else if (windSpeed > 30) {
          return {
            title: "Strong wind activity",
            description: `Winds up to ${windSpeed} km/h may increase rainfall intensity and flood impact`
          };
        } else if (windSpeed > 20) {
          return {
            title: "Moderate winds detected",
            description: `${windSpeed} km/h winds contributing to weather instability`
          };
        } else {
          return {
            title: "Light wind conditions",
            description: `${windSpeed} km/h, minimal impact on flood risk`
          };
        }
      
      case 'wind_gusts_max':
        const gusts = Math.round(Math.abs(featureValue));
        if (gusts > 60) {
          return {
            title: "Dangerous wind gusts",
            description: `Up to ${gusts} km/h gusts can cause storm surge and worsen coastal flooding`
          };
        } else if (gusts > 40) {
          return {
            title: "Strong wind gusts",
            description: `Gusts reaching ${gusts} km/h may intensify storm conditions`
          };
        } else {
          return {
            title: "Moderate wind gusts",
            description: `${gusts} km/h gusts detected`
          };
        }
      
      case 'wind_direction':
        const direction = Math.round(Math.abs(featureValue));
        if (direction >= 45 && direction <= 135) {
          return {
            title: "Wind from the northeast",
            description: "Bringing heavy rain clouds from the sea - increases flood risk"
          };
        } else if (direction >= 225 && direction <= 315) {
          return {
            title: "Wind from the southwest",
            description: "Bringing moisture from the ocean during rainy season"
          };
        } else {
          return {
            title: "Wind affecting weather",
            description: "Current wind patterns may influence rainfall in your area"
          };
        }
      
      case 'river_discharge':
      case 'river_discharge_mean':
      case 'river_discharge_median':
        const discharge = Math.abs(featureValue).toFixed(1);
        if (discharge > 5.0) {
          return {
            title: "High river water levels",
            description: `Rivers are flowing much higher than normal - major flood risk`
          };
        } else if (discharge > 3.0) {
          return {
            title: "Rising river levels",
            description: `River water levels are above normal - increasing flood risk`
          };
        } else if (discharge > 1.5) {
          return {
            title: "Moderate river flow",
            description: `River levels are slightly elevated but manageable`
          };
        } else {
          return {
            title: "Normal river levels",
            description: `Rivers are flowing at safe levels`
          };
        }
      
      case 'temp_max':
        const tempMax = Math.round(Math.abs(featureValue));
        if (tempMax > 35) {
          return {
            title: "Very hot weather",
            description: `Extreme heat (${tempMax}°C) can lead to sudden heavy storms`
          };
        } else if (tempMax > 32) {
          return {
            title: "Hot weather",
            description: `High temperature (${tempMax}°C) may trigger thunderstorms`
          };
        } else {
          return {
            title: `Temperature ${tempMax}°C`,
            description: "Current temperature affecting weather patterns"
          };
        }
      
      case 'temp_min':
        const tempMin = Math.round(Math.abs(featureValue));
        return {
          title: "Overnight temperature",
          description: `${tempMin}°C minimum temperature affects moisture in the air`
        };
      
      case 'temp_mean':
        const tempMean = Math.round(Math.abs(featureValue));
        return {
          title: "Daily temperature",
          description: `${tempMean}°C average temperature affects weather patterns`
        };
      
      case 'elevation':
        const elev = Math.round(Math.abs(featureValue));
        if (elev < 10) {
          return {
            title: "Very low area",
            description: `Your location is very close to sea level - high flood risk`
          };
        } else if (elev < 50) {
          return {
            title: "Low-lying area",
            description: `Your area is at low elevation - higher chance of flooding`
          };
        } else if (elev < 100) {
          return {
            title: "Moderate elevation warning",
            description: `Still at risk during heavy rains despite being ${elev}m above sea level`
          };
        } else {
          return {
            title: "Higher ground - safer",
            description: `Your elevated location (${elev}m) provides good protection from flooding`
          };
        }
      
      case 'latitude':
        const lat = Math.abs(featureValue).toFixed(2);
        if (Math.abs(featureValue) > 5.0) {
          return {
            title: "Northern region",
            description: `Your area has higher flood risk during monsoon season`
          };
        } else if (Math.abs(featureValue) > 3.0) {
          return {
            title: "Central region",
            description: `Your location experiences varied flood patterns throughout the year`
          };
        } else {
          return {
            title: "Southern region",
            description: `Your area has different flood risk patterns`
          };
        }
      
      case 'longitude':
        const lon = Math.abs(featureValue).toFixed(2);
        if (Math.abs(featureValue) > 110) {
          return {
            title: "East Malaysia area",
            description: `Your region in Borneo has different flood patterns`
          };
        } else if (Math.abs(featureValue) > 103) {
          return {
            title: "East coastal area",
            description: `Your location faces higher flood risk during monsoon season`
          };
        } else {
          return {
            title: "Coastal flood-prone area",
            description: `Your location is more exposed to flooding during rainy season`
          };
        }
      
      // Monthly factors
      case 'is_january': return month === 1 ? { title: "Peak January flood risk", description: "Historically one of the highest flood months in Malaysia" } : { title: "January pattern influence", description: "Historical January weather patterns affecting prediction" };
      case 'is_february': return month === 2 ? { title: "February monsoon period", description: "Continued Northeast Monsoon brings elevated risk" } : { title: "February pattern influence", description: "February historical patterns in analysis" };
      case 'is_march': return month === 3 ? { title: "Late monsoon period", description: "March typically sees continued Northeast Monsoon effects" } : { title: "March pattern influence", description: "March seasonal patterns contributing to assessment" };
      case 'is_april': return month === 4 ? { title: "Inter-monsoon transition", description: "April's unstable weather increases flood unpredictability" } : { title: "April pattern influence", description: "Inter-monsoon transition patterns" };
      case 'is_may': return month === 5 ? { title: "Southwest Monsoon onset", description: "May marks beginning of Southwest Monsoon season" } : { title: "May pattern influence", description: "Southwest Monsoon onset patterns" };
      case 'is_june': return month === 6 ? { title: "Southwest Monsoon active", description: "June typically brings moderate rainfall patterns" } : { title: "June pattern influence", description: "Southwest Monsoon patterns" };
      case 'is_july': return month === 7 ? { title: "Mid-monsoon period", description: "July's Southwest Monsoon brings regional variations" } : { title: "July pattern influence", description: "Mid-monsoon seasonal patterns" };
      case 'is_august': return month === 8 ? { title: "Southwest Monsoon continues", description: "August maintains seasonal rainfall patterns" } : { title: "August pattern influence", description: "Continued monsoon patterns" };
      case 'is_september': return month === 9 ? { title: "Late Southwest Monsoon", description: "September often sees intensified rainfall" } : { title: "September pattern influence", description: "Late monsoon intensification patterns" };
      case 'is_october': return month === 10 ? { title: "Inter-monsoon transition", description: "October's weather transition increases instability" } : { title: "October pattern influence", description: "Monsoon transition patterns" };
      case 'is_november': return month === 11 ? { title: "Northeast Monsoon onset", description: "November marks start of highest flood risk period" } : { title: "November pattern influence", description: "Northeast Monsoon onset patterns" };
      case 'is_december': return month === 12 ? { title: "Peak Northeast Monsoon", description: "December historically shows highest flood activity" } : { title: "December pattern influence", description: "Peak monsoon season patterns" };
      
      default:
        // Smart fallback with pattern-based descriptions for unmapped features
        const readableName = featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Determine category-specific description based on feature name patterns
        let categoryDescription = "";
        if (featureName.includes('temp') || featureName.includes('temperature')) {
          categoryDescription = "Temperature patterns affect atmospheric conditions and rainfall intensity";
        } else if (featureName.includes('wind')) {
          categoryDescription = "Wind conditions influence storm movement and precipitation patterns";
        } else if (featureName.includes('rain') || featureName.includes('precip')) {
          categoryDescription = "Rainfall measurements directly impact flood development in your area";
        } else if (featureName.includes('monsoon')) {
          categoryDescription = "Monsoon patterns significantly affect seasonal flood risk";
        } else if (featureName.includes('river') || featureName.includes('discharge')) {
          categoryDescription = "Water levels affect drainage capacity and flood potential";
        } else if (featureName.includes('elevation') || featureName.includes('altitude')) {
          categoryDescription = "Ground elevation affects how quickly water accumulates";
        } else if (featureName.includes('humidity') || featureName.includes('moisture')) {
          categoryDescription = "Atmospheric moisture levels influence rainfall development";
        } else if (featureName.includes('pressure')) {
          categoryDescription = "Atmospheric pressure affects weather system stability";
        } else {
          categoryDescription = isHighContribution
            ? "Major contributing factor to current flood risk assessment"
            : isMediumContribution
            ? "Contributing factor in flood risk calculation"
            : "Minor influence on flood prediction";
        }

        return {
          title: readableName,
          description: categoryDescription
        };
    }
  }

  /**
   * Calculate feature contributions for a prediction based on feature importance and values
   * Embedded version of the Python API's get_feature_contributions method
   */
  calculateFeatureContributions(featureVector, topN = 8) {
    try {
      if (!this.modelConfig.feature_importance_weights) {
        console.warn('Feature importance weights not available in config');
        return [];
      }

      const featureOrder = this.modelConfig.feature_order;
      const importanceWeights = this.modelConfig.feature_importance_weights;
      const readableNames = this.modelConfig.feature_readable_names;

      // Extract monsoon season value from feature vector for risk analysis
      let monsoonSeason = null;
      const monsoonSeasonIndex = featureOrder.indexOf('monsoon_season');
      if (monsoonSeasonIndex !== -1 && monsoonSeasonIndex < featureVector.length) {
        monsoonSeason = featureVector[monsoonSeasonIndex];
      }

      // Calculate contribution scores (importance * abs(feature_value))
      const contributions = [];
      
      for (let i = 0; i < featureOrder.length && i < featureVector.length; i++) {
        const featureName = featureOrder[i];
        const importance = importanceWeights[featureName] || 0;
        const featureValue = featureVector[i];
        const contributionScore = importance * Math.abs(featureValue);
        
        // Determine impact level based on improved contribution score thresholds
        let impactLevel = 'Low';
        if (contributionScore > 0.1 || importance > 0.05) {
          impactLevel = 'High';
        } else if (contributionScore > 0.03 || importance > 0.025) {
          impactLevel = 'Medium';
        }
        
        // Determine risk direction based on feature type and values with enhanced logic
        let riskDirection = 'Increases';
        
        // Enhanced protective factor identification
        if (featureName === 'elevation' && featureValue > 100) {
          riskDirection = 'Decreases'; // Higher elevation reduces flood risk (100m+ is genuinely protective)
        } else if (featureName.startsWith('temp_') && Math.abs(featureValue) < 20) {
          riskDirection = 'Decreases'; // Very low temperatures indicate stable conditions
        } else if (featureName === 'wind_direction') {
          riskDirection = 'Contributes to'; // Wind direction is directional factor
        } else if (contributionScore < 0.01) {
          riskDirection = 'Minimal impact on'; // Very low contribution
        }
        
        // Check for inter-monsoon periods (lower risk)
        else if (featureName.includes('monsoon') && monsoonSeason !== null && monsoonSeason === 2) {
          riskDirection = 'Decreases'; // Inter-monsoon periods typically have lower flood risk
        }
        
        // Low values of risky factors can be protective
        else if (featureName === 'rain_sum' && Math.abs(featureValue) < 5) {
          riskDirection = 'Decreases'; // Very little rain is protective
        } else if (featureName === 'precipitation_sum' && Math.abs(featureValue) < 10) {
          riskDirection = 'Decreases'; // Low precipitation is protective
        } else if (featureName === 'river_discharge' && Math.abs(featureValue) < 1) {
          riskDirection = 'Decreases'; // Low river discharge is protective
        } else if (featureName === 'wind_speed_max' && Math.abs(featureValue) < 10) {
          riskDirection = 'Decreases'; // Calm weather conditions
        } else if (featureName === 'monsoon_intensity' && Math.abs(featureValue) < 0.1) {
          riskDirection = 'Decreases'; // Low monsoon intensity
        }
        
        // Override with known high-risk factors when values are significant
        else if (['rain_sum', 'precipitation_sum', 'precipitation_hours', 'river_discharge', 'monsoon_intensity', 'wind_speed_max', 'wind_gusts_max'].includes(featureName)) {
          if (Math.abs(featureValue) > 0.1) {
            riskDirection = 'Increases';
          }
        }
        
        // Get user-friendly explanation for this feature
        const userFriendlyExplanation = this.getUserFriendlyExplanation(featureName, featureValue, contributionScore);
        
        contributions.push({
          feature: userFriendlyExplanation, // Now contains {title, description}
          technical_name: readableNames[featureName] || featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          raw_feature: featureName,
          importance: Math.round(importance * 10000) / 10000, // Round to 4 decimal places
          feature_value: Math.round(featureValue * 1000) / 1000, // Round to 3 decimal places
          contribution_score: Math.round(contributionScore * 10000) / 10000,
          impact_level: impactLevel,
          risk_direction: riskDirection,
          rank: i + 1
        });
      }
      
      // Sort by contribution score and return top N
      contributions.sort((a, b) => b.contribution_score - a.contribution_score);
      const topFactors = contributions.slice(0, topN);

      // Structure factors for Risk Assessment UI compatibility
      return this.structureContributingFactors(topFactors);

    } catch (error) {
      console.error('Error calculating feature contributions:', error);
      return [];
    }
  }

  /**
   * Structure contributing factors for Risk Assessment UI
   * @param {Array} factors - Array of contributing factors
   * @returns {Object} - Structured factors with risk/protective separation
   */
  structureContributingFactors(factors) {
    if (!Array.isArray(factors) || factors.length === 0) {
      return {
        structured: true,
        riskFactors: [],
        protectiveFactors: [],
        legacy_text: []
      };
    }

    // Separate risk and protective factors
    const riskFactors = [];
    const protectiveFactors = [];

    for (const factor of factors) {
      // Determine if this is a protective factor
      const isProtective = this.isProtectiveFactor(factor.raw_feature, factor.feature_value);

      // Create structured factor object
      const structuredFactor = {
        raw_feature: factor.raw_feature,
        technical_name: factor.raw_feature,
        importance: factor.importance,
        feature_value: factor.feature_value,
        contribution_score: factor.contribution_score,
        impact_level: factor.impact_level,
        risk_direction: isProtective ? 'Decreases' : 'Increases',
        feature: {
          title: this.getReadableFeatureName(factor.raw_feature),
          description: this.getFactorDescription(factor.raw_feature, factor.feature_value)
        }
      };

      if (isProtective) {
        protectiveFactors.push(structuredFactor);
      } else {
        riskFactors.push(structuredFactor);
      }
    }

    return {
      structured: true,
      riskFactors: riskFactors,
      protectiveFactors: protectiveFactors,
      legacy_text: factors // Maintain backward compatibility
    };
  }

  /**
   * Check if a factor is protective (reduces flood risk)
   * @param {string} featureName - Feature name
   * @param {number} featureValue - Feature value
   * @returns {boolean} - True if protective
   */
  isProtectiveFactor(featureName, featureValue) {
    // High elevation reduces flood risk
    if (featureName === 'elevation' && featureValue > 100) {
      return true;
    }

    // Low precipitation during dry periods
    if ((featureName === 'precipitation_sum' || featureName === 'rain_sum') && featureValue < 5) {
      return true;
    }

    // Low monsoon intensity
    if (featureName === 'monsoon_intensity' && featureValue < 0.2) {
      return true;
    }

    return false;
  }

  /**
   * Get readable feature name from technical name
   * @param {string} featureName - Technical feature name
   * @returns {string} - Human readable name
   */
  getReadableFeatureName(featureName) {
    const nameMapping = {
      'latitude': 'Location (Latitude)',
      'longitude': 'Location (Longitude)',
      'temp_max': 'Maximum Temperature',
      'temp_min': 'Minimum Temperature',
      'temp_mean': 'Average Temperature',
      'precipitation_sum': 'Total Precipitation',
      'rain_sum': 'Total Rainfall',
      'precipitation_hours': 'Hours of Rain',
      'wind_speed_max': 'Maximum Wind Speed',
      'wind_gusts_max': 'Maximum Wind Gusts',
      'wind_direction': 'Wind Direction',
      'river_discharge': 'River Discharge Rate',
      'river_discharge_mean': 'Average River Discharge',
      'river_discharge_median': 'Median River Discharge',
      'elevation': 'Ground Elevation',
      'monsoon_season_encoded': 'Monsoon Season',
      'monsoon_phase_encoded': 'Monsoon Phase',
      'days_since_monsoon_start': 'Days Since Monsoon Started',
      'monsoon_intensity': 'Monsoon Intensity',
      'is_january': 'January Period',
      'is_february': 'February Period',
      'is_march': 'March Period',
      'is_april': 'April Period',
      'is_may': 'May Period',
      'is_june': 'June Period',
      'is_july': 'July Period',
      'is_august': 'August Period',
      'is_september': 'September Period',
      'is_october': 'October Period',
      'is_november': 'November Period',
      'is_december': 'December Period'
    };

    return nameMapping[featureName] || featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get contextual description for a factor
   * @param {string} featureName - Feature name
   * @param {number} featureValue - Feature value
   * @returns {string} - Contextual description
   */
  getFactorDescription(featureName, featureValue) {
    const value = Math.round(featureValue * 100) / 100;

    switch (featureName) {
      case 'precipitation_sum':
        if (value > 50) return `Heavy rainfall of ${value}mm significantly increases flood risk`;
        if (value > 20) return `Moderate rainfall of ${value}mm contributes to elevated flood risk`;
        return `Light rainfall of ${value}mm poses minimal flood threat`;

      case 'days_since_monsoon_start':
        if (value > 60) return `${Math.round(value)} days into monsoon - peak flood period`;
        return `${Math.round(value)} days since monsoon began - elevated risk period`;

      case 'elevation':
        if (value > 100) return `Elevated location at ${Math.round(value)}m provides natural protection`;
        return `Low elevation of ${Math.round(value)}m increases vulnerability`;

      case 'rain_sum':
        if (value > 30) return `Heavy rain (${value}mm) significantly increases flood risk`;
        if (value > 10) return `Moderate rain (${value}mm) elevates flood potential`;
        return `Light rain (${value}mm) poses minimal flood threat`;

      case 'wind_speed_max':
        if (value > 40) return `Very strong winds (${Math.round(value)} km/h) intensify storm conditions`;
        if (value > 20) return `Strong winds (${Math.round(value)} km/h) may worsen weather systems`;
        return `Calm winds (${Math.round(value)} km/h) indicate stable conditions`;

      case 'river_discharge':
        if (value > 5) return `High river levels (${value.toFixed(1)} m³/s) significantly increase flood risk`;
        if (value > 2) return `Elevated river discharge (${value.toFixed(1)} m³/s) raises flood potential`;
        return `Normal river levels (${value.toFixed(1)} m³/s) pose minimal threat`;

      case 'monsoon_intensity':
        if (value > 0.6) return `Very intense monsoon (${Math.round(value * 100)}%) brings severe flood risk`;
        if (value > 0.3) return `Active monsoon (${Math.round(value * 100)}%) increases flood likelihood`;
        return `Weak monsoon (${Math.round(value * 100)}%) reduces flood risk`;

      default:
        // More specific fallback based on feature name patterns
        if (featureName.includes('temp')) {
          return `Temperature conditions (${value}°C) affect atmospheric stability and rainfall patterns`;
        } else if (featureName.includes('wind')) {
          return `Wind patterns affect storm system movement and intensity`;
        } else if (featureName.includes('precipitation') || featureName.includes('rain')) {
          return `Rainfall patterns influence flood development in your area`;
        } else if (featureName.includes('monsoon')) {
          return `Seasonal monsoon patterns significantly impact regional flood risk`;
        } else if (featureName.includes('river')) {
          return `Waterway conditions affect flood risk through drainage capacity`;
        } else {
          return `Environmental conditions affect overall flood risk assessment`;
        }
    }
  }

  /**
   * Get risk level from probability
   * @param {number} probability - Flood probability (0-1)
   * @returns {string} - Risk level
   */
  getRiskLevel(probability) {
    return getRiskLevel(probability);
  }

  /**
   * Multiple location predictions
   */
  async predictMultipleLocations(locations, date = null) {
    try {
      console.log(`Predicting flood risk for ${locations.length} locations`);
      
      const results = [];
      
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const prediction = await this.predictFloodRisk(
          location.latitude, 
          location.longitude, 
          date,
          location.weatherData
        );
        
        results.push({
          ...prediction,
          location_label: location.label || `Location ${i + 1}`,
          request_index: i
        });
      }
      
      return {
        success: true,
        total_locations: locations.length,
        results: results,
        api_info: {
          version: this.modelConfig.model_version,
          model_type: 'Embedded 31-Feature',
          performance_improvement: this.modelConfig.performance_improvement
        }
      };
      
    } catch (error) {
      console.error('Error in multiple location predictions:', error);
      return {
        success: false,
        error: error.message,
        total_locations: locations.length
      };
    }
  }

  /**
   * Clear prediction cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Embedded ML cache cleared');
  }

  /**
   * Get service status and statistics
   */
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      model_version: this.modelConfig?.model_version || 'N/A',
      features_count: this.modelConfig?.features_count || 'N/A',
      f1_score: this.modelConfig?.f1_score || 'N/A',
      cache_size: this.cache.size,
      cache_timeout: this.cacheTimeout / 1000 / 60 // in minutes
    };
  }
}

// Export singleton instance
export const embeddedMLService = new EmbeddedMLService();
export default embeddedMLService;