/**
 * MockDataService.js - Centralized mock data generation
 * Single source of truth for all mock/test data across the app
 */

import { getPrecipitationIntensity, getRiverLevelStatus } from './RiskCalculations';
import { PRECIPITATION_THRESHOLDS, RIVER_LEVEL_THRESHOLDS } from './constants';

class MockDataService {
  /**
   * Generate mock ML prediction data
   * @returns {Object} - Mock ML prediction
   */
  static getMockMLPrediction() {
    return {
      flood_probability: 0.35,
      risk_level: 'Low',
      confidence: 0.78,
      timeframe_hours: 0,
      expected_duration_hours: 0,
      peak_probability: 0.40,
      contributing_factors: [
        'Current rainfall levels are normal',
        'No significant weather warnings',
        'River levels within normal range'
      ],
      weather_summary: {
        current_temp: 28,
        rainfall_24h: 2.1,
        wind_speed: 8.5
      },
      risk_indicators: {
        heavy_rain_warning: false,
        extreme_rain_warning: false,
        high_humidity_warning: false,
        consecutive_rain_days: 0,
        total_forecast_rain: 15.2,
        current_risk_score: 0.35
      },
      location: {
        lat: 3.0738,
        lon: 101.5183,
        display_name: 'Puchong, Selangor (Mock Data)',
        state: 'Selangor'
      },
      timestamp: new Date().toISOString(),
      model_version: 'mock-v1.0',
      data_sources: ['Mock GPS', 'Mock Weather API']
    };
  }

  /**
   * Generate mock weather data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Mock weather data
   */
  static getMockWeatherData(latitude, longitude) {
    return {
      latitude,
      longitude,
      current_conditions: {
        temperature: 28.5 + Math.random() * 4,
        humidity: 75 + Math.random() * 10,
        precipitation: Math.random() * 15,
        wind_speed: 8 + Math.random() * 8,
        wind_direction: 'SW',
        pressure: 1010 + Math.random() * 8,
      },
      forecast_24h: {
        max_temperature: 32 + Math.random() * 3,
        min_temperature: 24 + Math.random() * 3,
        precipitation_sum: Math.random() * 25,
        precipitation_hours: Math.floor(Math.random() * 8),
        wind_speed_max: 15 + Math.random() * 10,
      },
      river_data: {
        discharge: 200 + Math.random() * 100,
        level: 5 + Math.random() * 2,
        normal_range: '4-6',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate mock precipitation data
   * @returns {Object} - Mock precipitation data
   */
  static getMockPrecipitationData() {
    const current = Math.random() * 12;
    
    return {
      current,
      hourly: this.generateHourlyPrecipitation(),
      forecast24h: Math.random() * 30,
      intensity: getPrecipitationIntensity(current, PRECIPITATION_THRESHOLDS),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate mock river level data
   * @returns {Object} - Mock river level data
   */
  static getMockRiverLevelData() {
    const level = 4 + Math.random() * 4;
    
    return {
      current: level,
      normal_range: '4-6',
      discharge: 150 + Math.random() * 200,
      status: getRiverLevelStatus(level, RIVER_LEVEL_THRESHOLDS),
      trend: this.getRiverLevelTrend(level),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate mock elevation data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Mock elevation data
   */
  static getMockElevationData(latitude, longitude) {
    return {
      elevation: 10 + Math.random() * 100,
      latitude: latitude,
      longitude: longitude,
      timestamp: new Date().toISOString(),
      source: 'Mock Elevation API'
    };
  }

  /**
   * Generate mock river discharge data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} months - Number of months
   * @returns {Object} - Mock river discharge data
   */
  static getMockRiverDischargeData(latitude, longitude, months = 12) {
    const current = 150 + Math.random() * 100;
    return {
      current,
      statistics: {
        average: (140 + Math.random() * 60).toFixed(2),
        median: (145 + Math.random() * 50).toFixed(2),
        min: (80 + Math.random() * 30).toFixed(2),
        max: (250 + Math.random() * 100).toFixed(2),
        percentile: Math.round(40 + Math.random() * 40)
      },
      trend: {
        direction: Math.random() > 0.5 ? 'increasing' : 'decreasing',
        change_rate: (Math.random() * 5).toFixed(2)
      },
      status: 'normal',
      description: 'Normal range',
      data: this.generateHistoricalData(months),
      latitude,
      longitude,
      period: `${months} months`,
      unit: 'm³/s',
      timestamp: new Date().toISOString(),
      source: 'Mock River Discharge API'
    };
  }

  /**
   * Generate mock current river discharge
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Mock current river discharge
   */
  static getMockCurrentRiverDischarge(latitude, longitude) {
    return {
      current: 150 + Math.random() * 100,
      date: new Date().toISOString().split('T')[0],
      latitude: latitude,
      longitude: longitude,
      unit: 'm³/s',
      timestamp: new Date().toISOString(),
      source: 'Mock Flood API'
    };
  }

  /**
   * Generate mock timing forecast
   * @returns {Object} - Mock timing forecast
   */
  static getMockTimingForecast() {
    const forecast = this.generateHourlyForecast(48);
    
    return {
      forecast,
      peakRainfall: this.findPeakRainfall(forecast),
      floodRiskPeriods: this.identifyFloodRiskPeriods(forecast),
      recommendation: this.generateWeatherRecommendation(forecast),
    };
  }

  /**
   * Generate mock flood risk assessment
   * @returns {Object} - Mock assessment data
   */
  static getMockFloodRiskAssessment() {
    const currentPrecip = Math.random() * 20;
    const forecast24h = Math.random() * 40;
    
    return {
      currentRisk: {
        level: currentPrecip > 15 ? 'High' : currentPrecip > 10 ? 'Medium' : 'Low',
        probability: currentPrecip / 20 * 0.8,
        confidence: 0.75,
        score: Math.round(currentPrecip * 4),
        factors: ['Mock risk factor'],
        recommendation: 'Monitor conditions closely.'
      },
      currentConditions: {
        precipitation: currentPrecip,
        intensity: getPrecipitationIntensity(currentPrecip, PRECIPITATION_THRESHOLDS),
        temperature: 26 + Math.random() * 6,
        humidity: 70 + Math.random() * 25,
        riverLevel: 5 + Math.random() * 3,
        pressure: 1008 + Math.random() * 10
      },
      forecast: {
        next24h: forecast24h,
        hourlyData: this.generateHourlyForecast(48),
        criticalPeriods: [],
        peakRainfall: {
          time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          precipitation: Math.max(currentPrecip, Math.random() * 30),
          intensity: 'moderate'
        }
      },
      floodPrediction: {
        isFloodLikely: currentPrecip > PRECIPITATION_THRESHOLDS.MODERATE,
        riskLevel: currentPrecip > PRECIPITATION_THRESHOLDS.HEAVY ? 'High' : 'Medium',
        confidence: 0.75,
        timeToFlood: Math.random() * 24 * 60 * 60 * 1000,
        expectedDuration: 2 + Math.random() * 6
      },
      alerts: {
        thresholdExceeded: currentPrecip > PRECIPITATION_THRESHOLDS.MODERATE,
        severeWeatherWarning: currentPrecip > PRECIPITATION_THRESHOLDS.HEAVY,
        immediateAction: currentPrecip > PRECIPITATION_THRESHOLDS.EXTREME
      },
      lastUpdated: new Date().toISOString()
    };
  }

  // Helper methods

  static generateHourlyPrecipitation() {
    const hours = [];
    const baseTime = new Date();
    
    for (let i = 0; i < 24; i++) {
      const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
      const precipitation = Math.random() * 15;
      
      hours.push({
        time: time.toISOString(),
        precipitation,
        intensity: getPrecipitationIntensity(precipitation, PRECIPITATION_THRESHOLDS),
      });
    }
    
    return hours;
  }

  static generateHourlyForecast(hours = 48) {
    const forecast = [];
    const baseTemp = 28;
    const basePrecip = 2;
    
    for (let i = 0; i < hours; i++) {
      const time = new Date(Date.now() + i * 60 * 60 * 1000);
      
      // Simulate temperature variation
      const tempVariation = Math.sin(i * Math.PI / 12) * 3;
      const temperature = baseTemp + tempVariation + (Math.random() - 0.5) * 2;
      
      // Simulate precipitation variation
      const precipVariation = Math.random() * 10;
      const precipitation = Math.max(0, basePrecip + precipVariation - 5);
      
      forecast.push({
        time: time.toISOString(),
        temperature,
        precipitation,
        humidity: 70 + Math.random() * 20,
        windSpeed: 8 + Math.random() * 10,
        pressure: 1010 + Math.random() * 10,
        floodRisk: precipitation > PRECIPITATION_THRESHOLDS.MODERATE,
      });
    }
    
    return forecast;
  }

  static generateHistoricalData(months) {
    const data = [];
    const daysInMonth = 30;
    
    for (let i = 0; i < months * daysInMonth; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: 100 + Math.random() * 150 + Math.sin(i / 30) * 50
      });
    }
    
    return data.reverse();
  }

  static findPeakRainfall(forecast) {
    let peak = forecast[0];
    
    forecast.forEach(hour => {
      if (hour.precipitation > peak.precipitation) {
        peak = hour;
      }
    });
    
    return {
      time: peak.time,
      precipitation: peak.precipitation,
      intensity: getPrecipitationIntensity(peak.precipitation, PRECIPITATION_THRESHOLDS),
    };
  }

  static identifyFloodRiskPeriods(forecast) {
    const riskPeriods = [];
    let currentPeriod = null;
    
    forecast.forEach((hour) => {
      if (hour.floodRisk) {
        if (!currentPeriod) {
          currentPeriod = {
            start: hour.time,
            end: hour.time,
            maxPrecipitation: hour.precipitation,
          };
        } else {
          currentPeriod.end = hour.time;
          currentPeriod.maxPrecipitation = Math.max(currentPeriod.maxPrecipitation, hour.precipitation);
        }
      } else if (currentPeriod) {
        riskPeriods.push(currentPeriod);
        currentPeriod = null;
      }
    });
    
    if (currentPeriod) {
      riskPeriods.push(currentPeriod);
    }
    
    return riskPeriods;
  }

  static generateWeatherRecommendation(forecast) {
    const riskPeriods = this.identifyFloodRiskPeriods(forecast);
    
    if (riskPeriods.length === 0) {
      return 'Weather conditions are favorable with low flood risk.';
    }
    
    const nearestRisk = riskPeriods[0];
    const hoursToRisk = Math.round((new Date(nearestRisk.start) - new Date()) / (1000 * 60 * 60));
    
    if (hoursToRisk <= 2) {
      return 'Heavy rainfall expected within 2 hours. Take immediate precautions.';
    } else if (hoursToRisk <= 6) {
      return `Heavy rainfall expected in ${hoursToRisk} hours. Prepare flood safety measures.`;
    } else {
      return `Heavy rainfall forecasted in ${hoursToRisk} hours. Monitor conditions closely.`;
    }
  }

  static getRiverLevelTrend(level) {
    const random = Math.random();
    if (random > 0.6) return 'rising';
    if (random < 0.3) return 'falling';
    return 'stable';
  }
}

export default MockDataService;