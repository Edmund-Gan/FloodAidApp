// services/ApiService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const OPEN_METEO_URL = Constants.expoConfig?.extra?.openMeteoApiUrl || 'https://api.open-meteo.com/v1';
// Note: External ML APIs removed - using embedded ML service instead

class ApiService {
  constructor() {
    // Note: Removed HTTP client for ML APIs - using embedded ML service
    // Only keeping weather data functionality
  }

  // Note: All ML prediction APIs removed - using embedded ML service instead
  // Keeping only weather data APIs and mock data generators for development

  // Weather Data from Open Meteo
  async getWeatherData(lat, lon) {
    try {
      const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,precipitation,rain,relative_humidity_2m,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max',
        current_weather: true,
        timezone: 'Asia/Kuala_Lumpur'
      };

      const response = await axios.get(`${OPEN_METEO_URL}/forecast`, { 
        params,
        timeout: 15000 // 15 seconds timeout
      });
      return response.data;
    } catch (error) {
      console.error('Weather API Error:', error);
      return null;
    }
  }

  // Enhanced Weather Data for 31-Feature ML Model Compatibility
  async getTrainingModelData(lat, lon, forecastDays = 7) {
    console.log(`🌤️ Getting Enhanced 31-Feature ML compatible weather data for ${lat}, ${lon}`);
    
    try {
      // Primary request with all required parameters for 31-feature model
      const enhancedParams = {
        latitude: lat,
        longitude: lon,
        // Comprehensive hourly parameters for 31-feature model
        hourly: [
          'temperature_2m',
          'precipitation', 
          'rain',
          'relative_humidity_2m',
          'wind_speed_10m',
          'wind_gusts_10m',
          'wind_direction_10m',
          'surface_pressure',
          'cloud_cover',
          'visibility',
          'dewpoint_2m'
        ].join(','),
        
        // Enhanced daily parameters
        daily: [
          'temperature_2m_max',
          'temperature_2m_min', 
          'precipitation_sum',
          'rain_sum',
          'precipitation_hours',
          'wind_speed_10m_max',
          'wind_gusts_10m_max'
        ].join(','),
        
        forecast_days: Math.min(forecastDays, 7),
        current_weather: true,
        timezone: 'Asia/Kuala_Lumpur'
      };

      console.log('🚀 Making enhanced 31-feature weather API request...');
      
      const response = await axios.get(`${OPEN_METEO_URL}/forecast`, { 
        params: enhancedParams,
        timeout: 20000 // Increased timeout for comprehensive data
      });
      
      if (!response.data) {
        throw new Error('No enhanced weather data received');
      }
      
      console.log('✅ Enhanced 31-feature weather data retrieved successfully');
      
      // Get additional river discharge data from flood API
      const riverData = await this.getRiverDischargeData(lat, lon);
      
      // Process and structure data for enhanced ML model
      return this.processWeatherForEnhancedML(response.data, riverData, lat, lon);
      
    } catch (error) {
      console.error('❌ Error getting enhanced 31-feature weather data:', error);
      
      // Fallback: try basic weather request with core parameters
      try {
        console.log('🔄 Attempting fallback to core weather parameters...');
        
        const coreParams = {
          latitude: lat,
          longitude: lon,
          hourly: 'temperature_2m,precipitation,rain,relative_humidity_2m,wind_speed_10m',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum',
          forecast_days: 3,
          current_weather: true,
          timezone: 'Asia/Kuala_Lumpur'
        };
        
        const fallbackResponse = await axios.get(`${OPEN_METEO_URL}/forecast`, {
          params: coreParams,
          timeout: 15000
        });
        
        if (fallbackResponse.data) {
          console.log('✅ Fallback weather data retrieved successfully');
          return this.processWeatherForEnhancedML(fallbackResponse.data, null, lat, lon);
        }
        
      } catch (fallbackError) {
        console.error('❌ Fallback weather request also failed:', fallbackError);
      }
      
      throw new Error(`Failed to fetch enhanced weather data: ${error.message}`);
    }
  }

  // Process weather data for Enhanced 31-Feature ML model compatibility
  processWeatherForEnhancedML(rawData, riverData, lat, lon) {
    console.log('🔄 Processing weather data for Enhanced 31-Feature ML compatibility...');
    
    try {
      const processed = {
        location: {
          latitude: rawData.latitude,
          longitude: rawData.longitude,
          elevation: rawData.elevation || 50,
          timezone: rawData.timezone
        },
        
        current: {
          temperature: rawData.current_weather?.temperature || 0,
          windspeed: rawData.current_weather?.windspeed || 0,
          winddirection: rawData.current_weather?.winddirection || 0,
          weathercode: rawData.current_weather?.weathercode || 0,
          time: rawData.current_weather?.time || new Date().toISOString()
        },
        
        // Enhanced features for 31-feature ML model
        features: this.extractEnhancedMLFeatures(rawData, riverData, lat, lon),
        
        // Enhanced forecast with monsoon awareness
        forecast: this.extractEnhancedForecastFeatures(rawData),
        
        // Enhanced risk indicators
        risk_indicators: this.calculateEnhancedRiskIndicators(rawData),
        
        // New: Monsoon information
        monsoon_info: this.calculateMonsoonFeatures(new Date())
      };
      
      console.log('✅ Weather data processed for Enhanced 31-Feature ML model');
      return processed;
      
    } catch (error) {
      console.error('❌ Error processing enhanced weather data:', error);
      return null;
    }
  }

  // Extract ML model features from weather data
  extractMLFeatures(data) {
    try {
      const hourly = data.hourly || {};
      
      // Get last 24 hours of data for current conditions
      const last24Hours = 24;
      
      return {
        // Temperature features
        temp_avg: this.calculateAverage(hourly.temperature_2m, last24Hours),
        temp_max: this.calculateMax(hourly.temperature_2m, last24Hours),
        temp_min: this.calculateMin(hourly.temperature_2m, last24Hours),
        
        // Precipitation features (key for flood prediction) - PAST data
        rainfall_24h: this.calculateSum(hourly.rain, last24Hours), // Historical data
        rainfall_24h_past: this.calculateSum(hourly.rain, last24Hours), // Explicit past data
        precipitation_24h: this.calculateSum(hourly.precipitation, last24Hours),
        rainfall_intensity: this.calculateAverage(hourly.rain, 6), // Last 6 hours
        
        // Humidity and pressure
        humidity_avg: this.calculateAverage(hourly.relative_humidity_2m, last24Hours),
        pressure_avg: this.calculateAverage(hourly.surface_pressure, last24Hours),
        pressure_trend: this.calculateTrend(hourly.surface_pressure, last24Hours),
        
        // Wind features
        wind_speed_avg: this.calculateAverage(hourly.wind_speed_10m, last24Hours),
        wind_speed_max: this.calculateMax(hourly.wind_speed_10m, last24Hours),
        wind_gusts_max: this.calculateMax(hourly.windgusts_10m, last24Hours),
        
        // Additional features
        cloud_cover_avg: this.calculateAverage(hourly.cloud_cover, last24Hours),
        visibility_avg: this.calculateAverage(hourly.visibility, last24Hours),
        dewpoint_avg: this.calculateAverage(hourly.dewpoint_2m, last24Hours)
      };
      
    } catch (error) {
      console.error('Error extracting ML features:', error);
      return null;
    }
  }

  // Extract forecast features for flood timeframe prediction
  extractForecastFeatures(data) {
    try {
      const daily = data.daily || {};
      const forecastDays = daily.time?.length || 0;
      
      if (forecastDays === 0) {
        console.log('No daily forecast data available');
        return [];
      }
      
      const forecast = [];
      
      for (let i = 0; i < forecastDays; i++) {
        // Handle missing fields gracefully with fallback values
        const precipitationSum = daily.precipitation_sum?.[i] || 0;
        const rainSum = daily.rain_sum?.[i] || precipitationSum; // Use precipitation if rain_sum missing
        const precipitationProb = daily.precipitation_probability_max?.[i] || 0;
        const windSpeedMax = daily.wind_speed_10m_max?.[i] || 0;
        
        forecast.push({
          date: daily.time?.[i] || new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          temp_max: daily.temperature_2m_max?.[i] || 30,
          temp_min: daily.temperature_2m_min?.[i] || 24,
          precipitation_sum: precipitationSum,
          rain_sum: rainSum,
          precipitation_probability: precipitationProb,
          wind_speed_max: windSpeedMax,
          
          // Calculate daily flood risk indicators
          flood_risk_score: this.calculateDailyFloodRisk(
            precipitationSum,
            rainSum,
            precipitationProb
          )
        });
      }
      
      return forecast;
      
    } catch (error) {
      console.error('Error extracting forecast features:', error);
      return [];
    }
  }

  // Calculate risk indicators for flood prediction
  calculateRiskIndicators(data) {
    try {
      const features = this.extractMLFeatures(data);
      const forecast = this.extractForecastFeatures(data);
      
      // Define thresholds based on Malaysian flood patterns
      const HEAVY_RAIN_THRESHOLD = 20; // mm/day
      const EXTREME_RAIN_THRESHOLD = 50; // mm/day
      const HIGH_HUMIDITY_THRESHOLD = 80; // %
      
      return {
        // Current risk factors
        heavy_rain_warning: features.rainfall_24h > HEAVY_RAIN_THRESHOLD,
        extreme_rain_warning: features.rainfall_24h > EXTREME_RAIN_THRESHOLD,
        high_humidity_warning: features.humidity_avg > HIGH_HUMIDITY_THRESHOLD,
        
        // Forecast risk factors
        consecutive_rain_days: this.countConsecutiveRainDays(forecast),
        peak_rainfall_day: this.findPeakRainfallDay(forecast),
        total_forecast_rain: forecast.reduce((sum, day) => sum + (day.rain_sum || 0), 0),
        
        // Risk scores
        current_risk_score: this.calculateCurrentRiskScore(features),
        forecast_risk_scores: forecast.map(day => day.flood_risk_score)
      };
      
    } catch (error) {
      console.error('Error calculating risk indicators:', error);
      return null;
    }
  }

  // Calculate daily flood risk score
  calculateDailyFloodRisk(precipitation, rainfall, probability) {
    const precipitationScore = Math.min(precipitation / 50, 1); // Normalize to 0-1
    const rainfallScore = Math.min(rainfall / 40, 1);
    const probabilityScore = (probability || 0) / 100;
    
    // Weighted average (rainfall is most important)
    return (rainfallScore * 0.5 + precipitationScore * 0.3 + probabilityScore * 0.2);
  }

  // Calculate current risk score based on features
  calculateCurrentRiskScore(features) {
    try {
      let score = 0;
      
      // Rainfall contribution (0-40 points)
      score += Math.min((features.rainfall_24h || 0) / 50 * 40, 40);
      
      // Humidity contribution (0-20 points)
      score += Math.min((features.humidity_avg || 0) / 100 * 20, 20);
      
      // Pressure trend contribution (0-20 points)
      if (features.pressure_trend < -2) score += 20; // Falling pressure
      else if (features.pressure_trend < 0) score += 10;
      
      // Wind speed contribution (0-10 points)
      score += Math.min((features.wind_speed_max || 0) / 50 * 10, 10);
      
      // Temperature stability (0-10 points)
      const tempRange = (features.temp_max || 0) - (features.temp_min || 0);
      if (tempRange > 10) score += 10; // High temperature variation
      
      return Math.min(score / 100, 1); // Normalize to 0-1
      
    } catch (error) {
      console.error('Error calculating current risk score:', error);
      return 0;
    }
  }

  // Helper functions for statistical calculations
  calculateAverage(array, lastN = null) {
    if (!array || array.length === 0) return 0;
    const data = lastN ? array.slice(-lastN) : array;
    const filtered = data.filter(val => val !== null && val !== undefined);
    return filtered.length > 0 ? filtered.reduce((sum, val) => sum + val, 0) / filtered.length : 0;
  }

  calculateSum(array, lastN = null) {
    if (!array || array.length === 0) return 0;
    const data = lastN ? array.slice(-lastN) : array;
    const filtered = data.filter(val => val !== null && val !== undefined);
    return filtered.reduce((sum, val) => sum + val, 0);
  }

  calculateMax(array, lastN = null) {
    if (!array || array.length === 0) return 0;
    const data = lastN ? array.slice(-lastN) : array;
    const filtered = data.filter(val => val !== null && val !== undefined);
    return filtered.length > 0 ? Math.max(...filtered) : 0;
  }

  calculateMin(array, lastN = null) {
    if (!array || array.length === 0) return 0;
    const data = lastN ? array.slice(-lastN) : array;
    const filtered = data.filter(val => val !== null && val !== undefined);
    return filtered.length > 0 ? Math.min(...filtered) : 0;
  }

  calculateTrend(array, lastN = 12) {
    if (!array || array.length < 2) return 0;
    const data = lastN ? array.slice(-lastN) : array;
    const filtered = data.filter(val => val !== null && val !== undefined);
    
    if (filtered.length < 2) return 0;
    
    return filtered[filtered.length - 1] - filtered[0];
  }

  countConsecutiveRainDays(forecast) {
    let consecutive = 0;
    let maxConsecutive = 0;
    
    for (const day of forecast) {
      if ((day.rain_sum || 0) > 5) { // 5mm threshold
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 0;
      }
    }
    
    return maxConsecutive;
  }

  findPeakRainfallDay(forecast) {
    let peakDay = 0;
    let peakRainfall = 0;
    
    forecast.forEach((day, index) => {
      if ((day.rain_sum || 0) > peakRainfall) {
        peakRainfall = day.rain_sum || 0;
        peakDay = index;
      }
    });
    
    return { day: peakDay, rainfall: peakRainfall };
  }

  // Enhanced 31-Feature ML Model Functions
  
  // Extract Enhanced ML features including monsoon and temporal features
  extractEnhancedMLFeatures(data, riverData, lat, lon) {
    try {
      const hourly = data.hourly || {};
      const daily = data.daily || {};
      const last24Hours = 24;
      
      // Original weather features (15)
      const originalFeatures = {
        latitude: lat,
        longitude: lon,
        elevation: data.elevation || 50,
        temp_max: this.calculateMax(hourly.temperature_2m, last24Hours),
        temp_min: this.calculateMin(hourly.temperature_2m, last24Hours),
        temp_mean: this.calculateAverage(hourly.temperature_2m, last24Hours),
        precipitation_sum: this.calculateSum(hourly.precipitation, last24Hours),
        rain_sum: this.calculateSum(hourly.rain, last24Hours),
        precipitation_hours: this.calculatePrecipitationHours(hourly.precipitation, last24Hours),
        wind_speed_max: this.calculateMax(hourly.wind_speed_10m, last24Hours),
        wind_gusts_max: this.calculateMax(hourly.wind_gusts_10m, last24Hours),
        wind_direction: this.calculateAverage(hourly.wind_direction_10m, last24Hours),
        river_discharge: riverData?.river_discharge || this.estimateRiverDischarge(lat, lon),
        river_discharge_mean: riverData?.river_discharge_mean || this.estimateRiverDischarge(lat, lon) * 0.8,
        river_discharge_median: riverData?.river_discharge_median || this.estimateRiverDischarge(lat, lon) * 0.7
      };
      
      // Monsoon & temporal features (16)
      const monsoonFeatures = this.calculateMonsoonFeatures(new Date());
      const temporalFeatures = this.calculateMonthlyFeatures(new Date());
      
      return {
        ...originalFeatures,
        ...monsoonFeatures,
        ...temporalFeatures
      };
      
    } catch (error) {
      console.error('Error extracting enhanced ML features:', error);
      return null;
    }
  }
  
  // Calculate monsoon pattern features
  calculateMonsoonFeatures(date) {
    const month = date.getMonth() + 1; // 1-12
    const dayOfYear = this.getDayOfYear(date);
    
    let monsoonSeason, monsoonPhase, daysSinceMonsoonStart, monsoonIntensity;
    
    // Malaysian monsoon seasons based on documentation
    if (month >= 11 || month <= 3) {
      // Northeast Monsoon (Nov-Mar)
      monsoonSeason = 0;
      if (month === 11) {
        monsoonPhase = 0; // Early
        daysSinceMonsoonStart = date.getDate();
      } else if (month === 12 || month === 1) {
        monsoonPhase = 1; // Peak
        daysSinceMonsoonStart = month === 12 ? 30 + date.getDate() : 60 + date.getDate();
      } else {
        monsoonPhase = 2; // Late
        daysSinceMonsoonStart = 90 + date.getDate();
      }
      monsoonIntensity = 0.36; // 36.24% flood rate
    } else if (month >= 5 && month <= 9) {
      // Southwest Monsoon (May-Sep)
      monsoonSeason = 1;
      if (month === 5) {
        monsoonPhase = 0; // Early
        daysSinceMonsoonStart = date.getDate();
      } else if (month === 6 || month === 7) {
        monsoonPhase = 1; // Peak
        daysSinceMonsoonStart = month === 6 ? 30 + date.getDate() : 60 + date.getDate();
      } else {
        monsoonPhase = 2; // Late
        daysSinceMonsoonStart = month === 8 ? 90 + date.getDate() : 120 + date.getDate();
      }
      monsoonIntensity = 0.10; // 10.20% flood rate
    } else {
      // Inter-monsoon (Apr, Oct)
      monsoonSeason = 2;
      monsoonPhase = 3; // Transition
      daysSinceMonsoonStart = date.getDate();
      monsoonIntensity = 0.38; // 37.56% flood rate
    }
    
    return {
      monsoon_season_encoded: monsoonSeason,
      monsoon_phase_encoded: monsoonPhase,
      days_since_monsoon_start: daysSinceMonsoonStart,
      monsoon_intensity: monsoonIntensity
    };
  }
  
  // Calculate monthly temporal features (one-hot encoded)
  calculateMonthlyFeatures(date) {
    const month = date.getMonth() + 1; // 1-12
    
    return {
      is_january: month === 1 ? 1 : 0,
      is_february: month === 2 ? 1 : 0,
      is_march: month === 3 ? 1 : 0,
      is_april: month === 4 ? 1 : 0,
      is_may: month === 5 ? 1 : 0,
      is_june: month === 6 ? 1 : 0,
      is_july: month === 7 ? 1 : 0,
      is_august: month === 8 ? 1 : 0,
      is_september: month === 9 ? 1 : 0,
      is_october: month === 10 ? 1 : 0,
      is_november: month === 11 ? 1 : 0,
      is_december: month === 12 ? 1 : 0
    };
  }
  
  // Get river discharge data from Open Meteo Flood API
  async getRiverDischargeData(lat, lon) {
    try {
      const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'river_discharge',
        forecast_days: 1
      };
      
      const response = await axios.get(`${OPEN_METEO_URL}/flood`, { 
        params,
        timeout: 10000
      });
      
      if (response.data?.hourly?.river_discharge) {
        const discharge = response.data.hourly.river_discharge;
        return {
          river_discharge: this.calculateAverage(discharge, 24),
          river_discharge_mean: this.calculateAverage(discharge),
          river_discharge_median: this.calculateMedian(discharge)
        };
      }
      
      return null;
    } catch (error) {
      console.log('River discharge data not available, using estimates');
      return null;
    }
  }
  
  // Enhanced forecast features with monsoon awareness
  extractEnhancedForecastFeatures(data) {
    try {
      const daily = data.daily || {};
      const forecastDays = daily.time?.length || 0;
      
      if (forecastDays === 0) {
        return [];
      }
      
      const forecast = [];
      
      for (let i = 0; i < forecastDays; i++) {
        const date = new Date(daily.time[i]);
        const monsoonInfo = this.calculateMonsoonFeatures(date);
        
        forecast.push({
          date: daily.time[i],
          temp_max: daily.temperature_2m_max?.[i] || 30,
          temp_min: daily.temperature_2m_min?.[i] || 24,
          precipitation_sum: daily.precipitation_sum?.[i] || 0,
          rain_sum: daily.rain_sum?.[i] || 0,
          precipitation_hours: daily.precipitation_hours?.[i] || 0,
          wind_speed_max: daily.wind_speed_10m_max?.[i] || 0,
          wind_gusts_max: daily.wind_gusts_10m_max?.[i] || 0,
          
          // Enhanced flood risk with monsoon awareness
          flood_risk_score: this.calculateEnhancedDailyFloodRisk(
            daily.precipitation_sum?.[i] || 0,
            daily.rain_sum?.[i] || 0,
            monsoonInfo.monsoon_intensity
          ),
          
          // Monsoon context for this day
          monsoon_season: this.getMonsoonSeasonName(monsoonInfo.monsoon_season_encoded),
          monsoon_intensity: monsoonInfo.monsoon_intensity
        });
      }
      
      return forecast;
      
    } catch (error) {
      console.error('Error extracting enhanced forecast features:', error);
      return [];
    }
  }
  
  // Enhanced risk indicators with monsoon patterns
  calculateEnhancedRiskIndicators(data) {
    try {
      const features = this.extractEnhancedMLFeatures(data, null, data.latitude, data.longitude);
      const forecast = this.extractEnhancedForecastFeatures(data);
      const monsoonInfo = this.calculateMonsoonFeatures(new Date());
      
      return {
        // Enhanced current risk factors
        heavy_rain_warning: features.rain_sum > 20,
        extreme_rain_warning: features.rain_sum > 50,
        high_humidity_warning: features.temp_mean > 25 && features.rain_sum > 10,
        monsoon_peak_warning: monsoonInfo.monsoon_phase_encoded === 1,
        
        // Enhanced forecast risk factors
        consecutive_rain_days: this.countConsecutiveRainDays(forecast),
        peak_rainfall_day: this.findPeakRainfallDay(forecast),
        total_forecast_rain: forecast.reduce((sum, day) => sum + (day.rain_sum || 0), 0),
        monsoon_amplified_risk: monsoonInfo.monsoon_intensity > 0.3,
        
        // Enhanced risk scores
        current_risk_score: this.calculateEnhancedCurrentRiskScore(features, monsoonInfo),
        forecast_risk_scores: forecast.map(day => day.flood_risk_score),
        monsoon_risk_multiplier: monsoonInfo.monsoon_intensity
      };
      
    } catch (error) {
      console.error('Error calculating enhanced risk indicators:', error);
      return null;
    }
  }

  // Helper functions for enhanced features
  
  calculatePrecipitationHours(precipitationArray, lastN = null) {
    if (!precipitationArray) return 0;
    const data = lastN ? precipitationArray.slice(-lastN) : precipitationArray;
    return data.filter(val => val > 0.1).length; // Hours with >0.1mm precipitation
  }
  
  estimateRiverDischarge(lat, lon) {
    // Rough estimation based on location and season
    const baseDischarge = 2.5; // m³/s
    const monsoonInfo = this.calculateMonsoonFeatures(new Date());
    return baseDischarge * (1 + monsoonInfo.monsoon_intensity);
  }
  
  calculateMedian(array) {
    if (!array || array.length === 0) return 0;
    const filtered = array.filter(val => val !== null && val !== undefined);
    const sorted = filtered.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  
  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }
  
  getMonsoonSeasonName(encoded) {
    switch (encoded) {
      case 0: return 'Northeast Monsoon';
      case 1: return 'Southwest Monsoon';
      case 2: return 'Inter-monsoon';
      default: return 'Unknown';
    }
  }
  
  calculateEnhancedDailyFloodRisk(precipitation, rainfall, monsoonIntensity) {
    const precipitationScore = Math.min(precipitation / 50, 1);
    const rainfallScore = Math.min(rainfall / 40, 1);
    const monsoonMultiplier = 1 + monsoonIntensity;
    
    return Math.min((precipitationScore * 0.4 + rainfallScore * 0.6) * monsoonMultiplier, 1);
  }
  
  calculateEnhancedCurrentRiskScore(features, monsoonInfo) {
    let score = 0;
    
    // Base weather risk (60%)
    score += Math.min((features.rain_sum || 0) / 50 * 0.3, 0.3);
    score += Math.min((features.precipitation_sum || 0) / 60 * 0.2, 0.2);
    score += Math.min((features.wind_speed_max || 0) / 40 * 0.1, 0.1);
    
    // Monsoon amplification (40%)
    const monsoonRisk = monsoonInfo.monsoon_intensity * 0.4;
    score += monsoonRisk;
    
    return Math.min(score, 1);
  }
  
  // Enhanced mock data generator for 31-feature development
  getMockTrainingModelData(lat, lon, forecastDays) {
    console.log('🔄 Generating enhanced 31-feature mock training model data...');
    
    const monsoonInfo = this.calculateMonsoonFeatures(new Date());
    const monthlyInfo = this.calculateMonthlyFeatures(new Date());
    
    return {
      location: { latitude: lat, longitude: lon, elevation: 50, timezone: 'Asia/Kuala_Lumpur' },
      current: {
        temperature: 28 + Math.random() * 6,
        windspeed: 5 + Math.random() * 15,
        winddirection: Math.random() * 360,
        weathercode: Math.random() > 0.7 ? 61 : 1,
        time: new Date().toISOString()
      },
      features: {
        // Original 15 features
        latitude: lat,
        longitude: lon,
        elevation: 50,
        temp_max: 32 + Math.random() * 3,
        temp_min: 24 + Math.random() * 3,
        temp_mean: 28 + Math.random() * 4,
        precipitation_sum: Math.random() * 45,
        rain_sum: Math.random() * 40,
        precipitation_hours: Math.floor(Math.random() * 12),
        wind_speed_max: 10 + Math.random() * 20,
        wind_gusts_max: 15 + Math.random() * 25,
        wind_direction: Math.random() * 360,
        river_discharge: 2 + Math.random() * 3,
        river_discharge_mean: 1.8 + Math.random() * 2.5,
        river_discharge_median: 1.5 + Math.random() * 2,
        
        // Monsoon features (4)
        ...monsoonInfo,
        
        // Monthly features (12)
        ...monthlyInfo
      },
      forecast: Array.from({ length: forecastDays }, (_, i) => {
        const forecastDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const dailyMonsoon = this.calculateMonsoonFeatures(forecastDate);
        
        return {
          date: forecastDate.toISOString().split('T')[0],
          temp_max: 30 + Math.random() * 5,
          temp_min: 23 + Math.random() * 4,
          precipitation_sum: Math.random() * 30,
          rain_sum: Math.random() * 25,
          precipitation_hours: Math.floor(Math.random() * 8),
          wind_speed_max: 10 + Math.random() * 15,
          wind_gusts_max: 12 + Math.random() * 20,
          flood_risk_score: this.calculateEnhancedDailyFloodRisk(
            Math.random() * 30,
            Math.random() * 25,
            dailyMonsoon.monsoon_intensity
          ),
          monsoon_season: this.getMonsoonSeasonName(dailyMonsoon.monsoon_season_encoded),
          monsoon_intensity: dailyMonsoon.monsoon_intensity
        };
      }),
      risk_indicators: {
        heavy_rain_warning: Math.random() > 0.6,
        extreme_rain_warning: Math.random() > 0.8,
        high_humidity_warning: Math.random() > 0.5,
        monsoon_peak_warning: monsoonInfo.monsoon_phase_encoded === 1,
        consecutive_rain_days: Math.floor(Math.random() * 4),
        peak_rainfall_day: { day: Math.floor(Math.random() * forecastDays), rainfall: Math.random() * 30 },
        total_forecast_rain: Math.random() * 100,
        monsoon_amplified_risk: monsoonInfo.monsoon_intensity > 0.3,
        current_risk_score: Math.random(),
        forecast_risk_scores: Array.from({ length: forecastDays }, () => Math.random()),
        monsoon_risk_multiplier: monsoonInfo.monsoon_intensity
      },
      monsoon_info: {
        season: this.getMonsoonSeasonName(monsoonInfo.monsoon_season_encoded),
        phase: monsoonInfo.monsoon_phase_encoded,
        intensity: monsoonInfo.monsoon_intensity,
        days_since_start: monsoonInfo.days_since_monsoon_start
      }
    };
  }

  // Air Quality Data
  async getAirQualityData(lat, lon) {
    try {
      const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
        timezone: 'Asia/Kuala_Lumpur'
      };

      const response = await axios.get(`${OPEN_METEO_URL}/air-quality`, { params });
      return response.data;
    } catch (error) {
      console.error('Air Quality API Error:', error);
      return null;
    }
  }

  // Marine Weather Data
  async getMarineData(lat, lon) {
    try {
      const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'wave_height,wave_period,wave_direction',
        daily: 'wave_height_max',
        timezone: 'Asia/Kuala_Lumpur'
      };

      const response = await axios.get(`${OPEN_METEO_URL}/marine`, { params });
      return response.data;
    } catch (error) {
      console.error('Marine API Error:', error);
      return null;
    }
  }

  // Cache Management
  async cacheData(key, data) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Cache Error:', error);
    }
  }

  async getCachedData(key, maxAge = 3600000) { // Default 1 hour cache
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;
      
      const cacheItem = JSON.parse(cached);
      const age = Date.now() - cacheItem.timestamp;
      
      if (age < maxAge) {
        return cacheItem.data;
      }
      
      return null;
    } catch (error) {
      console.error('Cache Retrieval Error:', error);
      return null;
    }
  }

  // Enhanced Mock Data Generators (31-Feature Model Compatible)
  getMockEnhancedPrediction(lat, lon) {
    const riskLevels = ['Low', 'Medium', 'High'];
    const probability = Math.random();
    const monsoonInfo = this.calculateMonsoonFeatures(new Date());
    const riskLevel = probability >= 0.7 ? 'High' : probability >= 0.4 ? 'Medium' : 'Low';
    
    return {
      success: true,
      risk_level: riskLevel,
      flood_probability: Number(probability.toFixed(4)),
      confidence: probability <= 0.2 || probability >= 0.7 ? 'High' : 'Medium',
      location_info: {
        state: this.getStateFromCoordinates(lat, lon),
        coordinates: [lat, lon]
      },
      weather_summary: {
        temp_max: 30 + Math.random() * 5,
        precipitation_sum: Math.random() * 45,
        rain_sum: Math.random() * 40,
        wind_speed_max: 10 + Math.random() * 20,
        wind_gusts_max: 15 + Math.random() * 25,
        river_discharge: 2 + Math.random() * 3,
        monsoon_season: this.getMonsoonSeasonName(monsoonInfo.monsoon_season_encoded)
      },
      prediction_details: {
        model_used: Math.random() > 0.5 ? 'XGBoost' : 'Random Forest',
        model_key: this.getStateFromCoordinates(lat, lon),
        features_count: 31,
        f1_score: 0.8095,
        prediction_date: new Date().toISOString().split('T')[0],
        binary_prediction: probability > 0.5 ? 1 : 0
      },
      api_info: {
        version: '2.0',
        model_type: 'Enhanced 31-Feature (Mock)',
        performance_improvement: '38.35%',
        f1_score: 0.8095
      }
    };
  }

  // Legacy Mock Data (for fallback compatibility)
  getMockPrediction() {
    const riskLevels = ['Low', 'Moderate', 'High', 'Very High'];
    const probability = Math.random();
    
    return {
      risk_level: riskLevels[Math.floor(probability * 4)],
      flood_probability: probability,
      confidence: 0.75 + Math.random() * 0.2,
      timeframe_hours: 6 + Math.random() * 48,
      contributing_factors: [
        'Heavy rainfall expected',
        'River levels rising',
        'Saturated soil conditions',
        'Poor drainage capacity'
      ].slice(0, 2 + Math.floor(Math.random() * 2)),
      weather_summary: {
        current_temp: 25 + Math.random() * 8,
        rainfall_24h: Math.random() * 100,
        wind_speed: 5 + Math.random() * 25
      }
    };
  }

  getMockEnhancedMultiplePredictions(locations) {
    return {
      success: true,
      total_locations: locations.length,
      results: locations.map((loc, index) => this.getMockEnhancedPrediction(loc.latitude, loc.longitude)),
      api_info: {
        version: '2.0',
        model_type: 'Enhanced 31-Feature (Mock)',
        performance_improvement: '38.35%'
      }
    };
  }

  getMockMultiplePredictions(locations) {
    return {
      predictions: locations.map(loc => ({
        label: loc.label,
        risk_level: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
        probability: Math.random() * 0.8 + 0.1
      }))
    };
  }

  // Helper methods for enhanced features
  getStateFromCoordinates(lat, lon) {
    // Simple coordinate-based state mapping for Malaysia
    if (lat >= 4.0 && lat <= 7.5 && lon >= 115.0 && lon <= 119.5) return 'SABAH';
    if (lat >= 0.8 && lat <= 5.0 && lon >= 109.0 && lon <= 115.5) return 'SARAWAK';
    if (lat >= 3.0 && lat <= 3.3 && lon >= 101.5 && lon <= 101.8) return 'WILAYAH PERSEKUTUAN';
    if (lat >= 1.0 && lat <= 2.8 && lon >= 102.5 && lon <= 104.5) return 'JOHOR';
    if (lat >= 2.8 && lat <= 4.0 && lon >= 100.8 && lon <= 102.0) return 'SELANGOR';
    return 'SELANGOR'; // Default fallback
  }

  // Note: API health checks removed - using embedded ML service

  getMockRegionalRisks() {
    const districts = [
      'Puchong', 'Subang Jaya', 'Petaling Jaya', 'Shah Alam', 
      'Klang', 'Ampang', 'Cheras', 'Kajang'
    ];
    
    return {
      districts: districts.map(name => ({
        name,
        risk_level: ['Low', 'Moderate', 'High', 'Very High'][Math.floor(Math.random() * 4)],
        probability: Math.random()
      }))
    };
  }

  getMockHistoricalData(district) {
    const years = [2020, 2021, 2022, 2023, 2024];
    
    return {
      district,
      flood_events: years.map(year => ({
        year,
        severity: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
        duration_days: 1 + Math.floor(Math.random() * 7),
        affected_areas: Math.floor(Math.random() * 20) + 5,
        rainfall_mm: 50 + Math.random() * 200
      })),
      risk_factors: [
        'Low elevation',
        'River proximity',
        'Poor drainage infrastructure',
        'Urban development',
        'Monsoon exposure'
      ].slice(0, 3 + Math.floor(Math.random() * 2))
    };
  }
}

// services/DatabaseService.js
class DatabaseService {
  constructor() {
    this.initDatabase();
  }

  async initDatabase() {
    try {
      // Initialize database structure
      const dbStructure = {
        locations: [],
        predictions: [],
        preferences: {
          notificationsEnabled: true,
          riskThreshold: 0.6,
          language: 'en',
          units: 'metric'
        },
        userProfile: {
          name: '',
          familySize: 4,
          hasChildren: false,
          hasElderlyMembers: false,
          specialNeeds: []
        }
      };

      const existing = await AsyncStorage.getItem('db_initialized');
      if (!existing) {
        await AsyncStorage.setItem('db_initialized', 'true');
        await AsyncStorage.setItem('db_structure', JSON.stringify(dbStructure));
      }
    } catch (error) {
      console.error('Database Init Error:', error);
    }
  }

  // Location Management
  async saveLocation(location) {
    try {
      const locations = await this.getLocations();
      locations.push({
        ...location,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await AsyncStorage.setItem('user_locations', JSON.stringify(locations));
      return true;
    } catch (error) {
      console.error('Save Location Error:', error);
      return false;
    }
  }

  async getLocations() {
    try {
      const locations = await AsyncStorage.getItem('user_locations');
      return locations ? JSON.parse(locations) : [];
    } catch (error) {
      console.error('Get Locations Error:', error);
      return [];
    }
  }

  async updateLocation(id, updates) {
    try {
      const locations = await this.getLocations();
      const index = locations.findIndex(loc => loc.id === id);
      if (index !== -1) {
        locations[index] = {
          ...locations[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        await AsyncStorage.setItem('user_locations', JSON.stringify(locations));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update Location Error:', error);
      return false;
    }
  }

  async deleteLocation(id) {
    try {
      const locations = await this.getLocations();
      const filtered = locations.filter(loc => loc.id !== id);
      await AsyncStorage.setItem('user_locations', JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Delete Location Error:', error);
      return false;
    }
  }

  // Prediction History
  async savePrediction(locationId, prediction) {
    try {
      const predictions = await this.getPredictions();
      predictions.push({
        id: Date.now(),
        locationId,
        ...prediction,
        createdAt: new Date().toISOString()
      });
      
      // Keep only last 100 predictions
      const recent = predictions.slice(-100);
      await AsyncStorage.setItem('prediction_history', JSON.stringify(recent));
      return true;
    } catch (error) {
      console.error('Save Prediction Error:', error);
      return false;
    }
  }

  async getPredictions(locationId = null) {
    try {
      const predictions = await AsyncStorage.getItem('prediction_history');
      const parsed = predictions ? JSON.parse(predictions) : [];
      
      if (locationId) {
        return parsed.filter(p => p.locationId === locationId);
      }
      return parsed;
    } catch (error) {
      console.error('Get Predictions Error:', error);
      return [];
    }
  }

  // User Preferences
  async savePreference(key, value) {
    try {
      await AsyncStorage.setItem(`pref_${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Save Preference Error:', error);
      return false;
    }
  }

  async getPreference(key, defaultValue = null) {
    try {
      const value = await AsyncStorage.getItem(`pref_${key}`);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error('Get Preference Error:', error);
      return defaultValue;
    }
  }

  // User Profile
  async saveUserProfile(profile) {
    try {
      await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
      return true;
    } catch (error) {
      console.error('Save Profile Error:', error);
      return false;
    }
  }

  async getUserProfile() {
    try {
      const profile = await AsyncStorage.getItem('user_profile');
      return profile ? JSON.parse(profile) : {
        name: 'Alice Chen',
        familySize: 4,
        hasChildren: true,
        hasElderlyMembers: false,
        specialNeeds: []
      };
    } catch (error) {
      console.error('Get Profile Error:', error);
      return null;
    }
  }

  // Clear All Data
  async clearAllData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      await this.initDatabase();
      return true;
    } catch (error) {
      console.error('Clear Data Error:', error);
      return false;
    }
  }
}

// Export singleton instances
export const apiService = new ApiService();
export const databaseService = new DatabaseService();