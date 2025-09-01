// services/ApiService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.100:8000/api';
const OPEN_METEO_URL = Constants.expoConfig?.extra?.openMeteoApiUrl || 'https://api.open-meteo.com/v1';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000, // Increased timeout to 15 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Flood Prediction APIs
  async getPrediction(lat, lon) {
    try {
      const response = await this.client.get(`/predict/${lat}/${lon}`);
      await this.cacheData(`prediction_${lat}_${lon}`, response.data);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      const cached = await this.getCachedData(`prediction_${lat}_${lon}`);
      if (cached) return cached;
      
      // Return mock data for development
      return this.getMockPrediction();
    }
  }

  async getMultipleLocationPredictions(locations) {
    try {
      const response = await this.client.post('/predict/multiple', { locations });
      return response.data;
    } catch (error) {
      return this.getMockMultiplePredictions(locations);
    }
  }

  async getRegionalRisks(region) {
    try {
      const response = await this.client.get(`/regional/${region}`);
      return response.data;
    } catch (error) {
      return this.getMockRegionalRisks();
    }
  }

  async getHistoricalData(district) {
    try {
      const response = await this.client.get(`/historical/${district}`);
      return response.data;
    } catch (error) {
      return this.getMockHistoricalData(district);
    }
  }

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

  // Enhanced Weather Data for ML Training Model Compatibility
  async getTrainingModelData(lat, lon, forecastDays = 7) {
    console.log(`🌤️ Getting ML training compatible weather data for ${lat}, ${lon}`);
    
    try {
      const params = {
        latitude: lat,
        longitude: lon,
        // Simplified hourly parameters - only ML essentials to avoid timeout
        hourly: 'temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m',
        
        // Essential daily parameters only
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
        
        // Reduced forecast days to speed up request
        forecast_days: 3,
        current_weather: true,
        timezone: 'Asia/Kuala_Lumpur'
        // Removed past_days to reduce request size
      };

      console.log('🚀 Making enhanced weather API request...');
      
      // Increase timeout to 15 seconds for weather API calls
      const response = await axios.get(`${OPEN_METEO_URL}/forecast`, { 
        params,
        timeout: 15000 // 15 seconds timeout
      });
      
      if (!response.data) {
        throw new Error('No weather data received');
      }
      
      console.log('✅ Enhanced weather data retrieved successfully');
      
      // Process and structure data for ML model
      return this.processWeatherForML(response.data);
      
    } catch (error) {
      console.error('❌ Error getting enhanced training model weather data:', error);
      
      // Fallback: try basic weather request with minimal parameters
      try {
        console.log('🔄 Attempting fallback to basic weather request...');
        
        const basicParams = {
          latitude: lat,
          longitude: lon,
          hourly: 'temperature_2m,precipitation',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
          forecast_days: 1,
          current_weather: true,
          timezone: 'Asia/Kuala_Lumpur'
        };
        
        const fallbackResponse = await axios.get(`${OPEN_METEO_URL}/forecast`, {
          params: basicParams,
          timeout: 10000 // Shorter timeout for fallback
        });
        
        if (fallbackResponse.data) {
          console.log('✅ Fallback weather data retrieved successfully');
          return this.processWeatherForML(fallbackResponse.data);
        }
        
      } catch (fallbackError) {
        console.error('❌ Fallback weather request also failed:', fallbackError);
      }
      
      // If both requests fail, throw error to force retry or user notification
      throw new Error(`Failed to fetch real weather data: ${error.message}`);
    }
  }

  // Process weather data for ML model compatibility
  processWeatherForML(rawData) {
    console.log('🔄 Processing weather data for ML compatibility...');
    
    try {
      const processed = {
        location: {
          latitude: rawData.latitude,
          longitude: rawData.longitude,
          elevation: rawData.elevation,
          timezone: rawData.timezone
        },
        
        current: {
          temperature: rawData.current_weather?.temperature || 0,
          windspeed: rawData.current_weather?.windspeed || 0,
          winddirection: rawData.current_weather?.winddirection || 0,
          weathercode: rawData.current_weather?.weathercode || 0,
          time: rawData.current_weather?.time || new Date().toISOString()
        },
        
        // Features for ML model (last 24 hours average)
        features: this.extractMLFeatures(rawData),
        
        // 7-day forecast for flood prediction
        forecast: this.extractForecastFeatures(rawData),
        
        // Flood risk indicators
        risk_indicators: this.calculateRiskIndicators(rawData)
      };
      
      console.log('✅ Weather data processed for ML model');
      return processed;
      
    } catch (error) {
      console.error('❌ Error processing weather data:', error);
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
        
        // Precipitation features (key for flood prediction)
        rainfall_24h: this.calculateSum(hourly.rain, last24Hours),
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

  // Mock data generator for development
  getMockTrainingModelData(lat, lon, forecastDays) {
    console.log('🔄 Generating mock training model data...');
    
    return {
      location: { latitude: lat, longitude: lon, elevation: 50, timezone: 'Asia/Kuala_Lumpur' },
      current: {
        temperature: 28 + Math.random() * 6,
        windspeed: 5 + Math.random() * 15,
        winddirection: Math.random() * 360,
        weathercode: Math.random() > 0.7 ? 61 : 1, // 61 = rain, 1 = clear
        time: new Date().toISOString()
      },
      features: {
        temp_avg: 28 + Math.random() * 4,
        temp_max: 32 + Math.random() * 3,
        temp_min: 24 + Math.random() * 3,
        rainfall_24h: Math.random() * 40,
        precipitation_24h: Math.random() * 45,
        rainfall_intensity: Math.random() * 15,
        humidity_avg: 70 + Math.random() * 20,
        pressure_avg: 1010 + Math.random() * 10,
        pressure_trend: -2 + Math.random() * 4,
        wind_speed_avg: 5 + Math.random() * 10,
        wind_speed_max: 10 + Math.random() * 20,
        wind_gusts_max: 15 + Math.random() * 25,
        cloud_cover_avg: Math.random() * 100,
        visibility_avg: 5000 + Math.random() * 5000,
        dewpoint_avg: 20 + Math.random() * 8
      },
      forecast: Array.from({ length: forecastDays }, (_, i) => ({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temp_max: 30 + Math.random() * 5,
        temp_min: 23 + Math.random() * 4,
        precipitation_sum: Math.random() * 30,
        rain_sum: Math.random() * 25,
        precipitation_probability: Math.random() * 100,
        wind_speed_max: 10 + Math.random() * 15,
        flood_risk_score: Math.random()
      })),
      risk_indicators: {
        heavy_rain_warning: Math.random() > 0.6,
        extreme_rain_warning: Math.random() > 0.8,
        high_humidity_warning: Math.random() > 0.5,
        consecutive_rain_days: Math.floor(Math.random() * 4),
        peak_rainfall_day: { day: Math.floor(Math.random() * forecastDays), rainfall: Math.random() * 30 },
        total_forecast_rain: Math.random() * 100,
        current_risk_score: Math.random(),
        forecast_risk_scores: Array.from({ length: forecastDays }, () => Math.random())
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

  // Mock Data Generators
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

  getMockMultiplePredictions(locations) {
    return {
      predictions: locations.map(loc => ({
        label: loc.label,
        risk_level: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
        probability: Math.random() * 0.8 + 0.1
      }))
    };
  }

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