import weatherService from '../services/WeatherService';
import FloodPredictionModel from '../services/FloodPredictionModel';
import { notificationService } from './NotificationService';
import { 
  PRECIPITATION_THRESHOLDS, 
  COUNTDOWN_THRESHOLDS, 
  NOTIFICATION_TYPES, 
  RISK_LEVELS,
  ML_ALERT_THRESHOLDS
} from './constants';

class FloodAlertService {
  constructor() {
    this.activeAlerts = new Map();
    this.monitoringIntervals = new Map();
    this.alertCallbacks = new Set();
    this.enableMLAlerts = true;
    this.mlAlertThreshold = ML_ALERT_THRESHOLDS.WARNING; // Default 60%
  }

  /**
   * Monitor location for flood risk based on rainfall thresholds
   * @param {Object} location - Location object with lat, lng, name
   * @param {Function} callback - Callback for alert updates
   */
  async startMonitoring(location, callback = null) {
    const locationKey = `${location.lat}_${location.lng}`;
    
    if (callback) {
      this.alertCallbacks.add(callback);
    }

    // Clear existing monitoring for this location
    if (this.monitoringIntervals.has(locationKey)) {
      clearInterval(this.monitoringIntervals.get(locationKey));
    }

    // Start real-time monitoring
    const intervalId = setInterval(async () => {
      await this.checkFloodRisk(location);
    }, 5 * 60 * 1000); // Check every 5 minutes

    this.monitoringIntervals.set(locationKey, intervalId);

    // Initial check
    await this.checkFloodRisk(location);
  }

  /**
   * Check flood risk for a specific location
   * @param {Object} location - Location object
   */
  async checkFloodRisk(location) {
    try {
      const locationKey = `${location.lat}_${location.lng}`;
      
      // Get current weather and forecast
      const weatherData = await weatherService.getCurrentWeather(location.lat, location.lng);
      const forecastData = await weatherService.getFloodTimingForecast(location.lat, location.lng, 48);
      
      // Check current rainfall threshold
      const currentRainfall = weatherData.current_conditions?.precipitation || 0;
      const isCurrentlyRaining = currentRainfall > PRECIPITATION_THRESHOLDS.LIGHT;
      
      // Find next significant rainfall period
      const nextFloodPeriod = this.findNextFloodPeriod(forecastData.floodRiskPeriods);
      
      // NEW: Check ML prediction if enabled
      let mlPrediction = null;
      let shouldTriggerMLAlert = false;
      
      if (this.enableMLAlerts) {
        try {
          mlPrediction = await FloodPredictionModel.getPredictionWithML(location.lat, location.lng);
          const probability = mlPrediction?.flood_probability || 0;
          shouldTriggerMLAlert = probability >= this.mlAlertThreshold;
          
          console.log(`🤖 ML Alert Check: ${Math.round(probability * 100)}% >= ${Math.round(this.mlAlertThreshold * 100)}% = ${shouldTriggerMLAlert}`);
        } catch (error) {
          console.error('Error getting ML prediction for alerts:', error);
        }
      }
      
      // Generate alert if weather OR ML indicates risk
      if (nextFloodPeriod || isCurrentlyRaining || shouldTriggerMLAlert) {
        const alert = await this.generateFloodAlert(location, weatherData, nextFloodPeriod, currentRainfall, mlPrediction);
        
        // Store alert
        this.activeAlerts.set(locationKey, alert);
        
        // Trigger alert callbacks
        this.alertCallbacks.forEach(callback => callback(alert));
        
        // Schedule notification if appropriate
        await this.scheduleFloodNotification(alert);
        
        return alert;
      } else {
        // Clear any existing alerts for this location
        if (this.activeAlerts.has(locationKey)) {
          this.activeAlerts.delete(locationKey);
          this.alertCallbacks.forEach(callback => callback(null));
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking flood risk:', error);
      return null;
    }
  }

  /**
   * Find the next significant flood period from forecast
   * @param {Array} floodRiskPeriods - Array of risk periods
   * @returns {Object|null} - Next flood period or null
   */
  findNextFloodPeriod(floodRiskPeriods) {
    if (!floodRiskPeriods || floodRiskPeriods.length === 0) {
      return null;
    }

    const now = new Date();
    
    // Sort periods by start time and find the next one
    const futurePeriods = floodRiskPeriods
      .filter(period => new Date(period.start) > now)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    return futurePeriods.length > 0 ? futurePeriods[0] : null;
  }

  /**
   * Generate comprehensive flood alert
   * @param {Object} location - Location object
   * @param {Object} weatherData - Current weather data
   * @param {Object} floodPeriod - Expected flood period
   * @param {number} currentRainfall - Current rainfall amount
   * @returns {Object} - Flood alert object
   */
  async generateFloodAlert(location, weatherData, floodPeriod, currentRainfall, mlPrediction = null) {
    const now = new Date();
    
    // Determine if flooding is imminent or predicted
    const isImminent = currentRainfall > PRECIPITATION_THRESHOLDS.MODERATE;
    
    let floodTimeframe, countdownTime, riskLevel, severity;
    
    if (isImminent) {
      // Current flooding conditions
      floodTimeframe = {
        start: now,
        end: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Next 2 hours
        description: 'Flood conditions detected now'
      };
      countdownTime = 0; // No preparation time left
      riskLevel = currentRainfall > PRECIPITATION_THRESHOLDS.HEAVY ? RISK_LEVELS.VERY_HIGH : RISK_LEVELS.HIGH;
      severity = 'immediate';
    } else if (floodPeriod) {
      // Predicted flooding
      const startTime = new Date(floodPeriod.start);
      const endTime = new Date(floodPeriod.end);
      
      floodTimeframe = {
        start: startTime,
        end: endTime,
        description: this.formatFloodTimeframe(startTime, endTime)
      };
      
      countdownTime = Math.max(0, startTime.getTime() - now.getTime());
      riskLevel = floodPeriod.maxPrecipitation > PRECIPITATION_THRESHOLDS.HEAVY ? 
                  RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM;
      severity = this.calculateSeverity(countdownTime);
    } else if (mlPrediction) {
      // ML-based prediction alert
      const probability = mlPrediction.flood_probability || 0;
      const timeframeHours = mlPrediction.timeframe_hours || 24;
      const futureTime = new Date(now.getTime() + timeframeHours * 60 * 60 * 1000);
      
      floodTimeframe = {
        start: now,
        end: futureTime,
        description: `ML model predicts ${Math.round(probability * 100)}% flood risk within ${timeframeHours} hours`
      };
      
      countdownTime = Math.max(0, timeframeHours * 60 * 60 * 1000 / 4); // Quarter of timeframe for preparation
      riskLevel = probability >= ML_ALERT_THRESHOLDS.HIGH ? RISK_LEVELS.HIGH : 
                  probability >= ML_ALERT_THRESHOLDS.WARNING ? RISK_LEVELS.MEDIUM : RISK_LEVELS.LOW;
      severity = probability >= ML_ALERT_THRESHOLDS.HIGH ? 'urgent' : 'warning';
    }

    return {
      id: `alert_${location.lat}_${location.lng}_${Date.now()}`,
      location: {
        name: location.name || 'Your Location',
        coordinates: { lat: location.lat, lng: location.lng }
      },
      floodTimeframe,
      countdownTime,
      countdownDisplay: this.formatCountdown(countdownTime),
      riskLevel,
      severity,
      expectedRainfall: floodPeriod?.maxPrecipitation || currentRainfall,
      currentConditions: {
        rainfall: currentRainfall,
        temperature: weatherData.current_conditions?.temperature || 28,
        humidity: weatherData.current_conditions?.humidity || 75
      },
      preparationGuidance: this.getPreparationGuidance(countdownTime, riskLevel),
      timestamp: now.toISOString(),
      isActive: true
    };
  }

  /**
   * Format flood timeframe for display
   * @param {Date} start - Start time
   * @param {Date} end - End time
   * @returns {string} - Formatted timeframe
   */
  formatFloodTimeframe(start, end) {
    const startFormat = start.toLocaleDateString('en-MY') + ' ' + 
                       start.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    const endFormat = end.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    
    return `${startFormat} - ${endFormat}`;
  }

  /**
   * Calculate alert severity based on countdown time
   * @param {number} countdownTime - Time until flood in milliseconds
   * @returns {string} - Severity level
   */
  calculateSeverity(countdownTime) {
    const hours = countdownTime / (1000 * 60 * 60);
    
    if (hours <= COUNTDOWN_THRESHOLDS.IMMEDIATE) return 'immediate';
    if (hours <= COUNTDOWN_THRESHOLDS.URGENT) return 'urgent';
    if (hours <= COUNTDOWN_THRESHOLDS.WARNING) return 'warning';
    return 'advisory';
  }

  /**
   * Format countdown display
   * @param {number} milliseconds - Countdown time in milliseconds
   * @returns {string} - Formatted countdown
   */
  formatCountdown(milliseconds) {
    if (milliseconds <= 0) {
      return 'Flood conditions now';
    }

    const totalHours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const remainingHours = totalHours % 24;
      return `${days}d ${remainingHours}h remaining`;
    } else if (totalHours > 0) {
      return `${totalHours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  /**
   * Get preparation guidance based on countdown time and risk level
   * @param {number} countdownTime - Time until flood
   * @param {string} riskLevel - Risk level
   * @returns {Object} - Preparation guidance
   */
  getPreparationGuidance(countdownTime, riskLevel) {
    const hours = countdownTime / (1000 * 60 * 60);

    if (hours <= COUNTDOWN_THRESHOLDS.IMMEDIATE) {
      return {
        priority: 'immediate',
        message: 'Take immediate action - flood imminent',
        actions: ['Move to higher ground', 'Secure important documents', 'Prepare emergency kit'],
        timeEstimate: '15-30 minutes'
      };
    } else if (hours <= COUNTDOWN_THRESHOLDS.URGENT) {
      return {
        priority: 'urgent',
        message: 'Prepare now - flooding expected within 6 hours',
        actions: ['Review evacuation plan', 'Charge devices', 'Store water and food', 'Move vehicles'],
        timeEstimate: '1-2 hours'
      };
    } else if (hours <= COUNTDOWN_THRESHOLDS.WARNING) {
      return {
        priority: 'warning',
        message: 'Begin preparations - flooding possible within 12 hours',
        actions: ['Check emergency supplies', 'Inform family', 'Monitor updates', 'Prepare sandbags'],
        timeEstimate: '2-3 hours'
      };
    } else {
      return {
        priority: 'advisory',
        message: 'Monitor conditions - flooding possible within 24 hours',
        actions: ['Review flood plan', 'Check weather updates', 'Prepare emergency kit', 'Stay informed'],
        timeEstimate: '30-60 minutes'
      };
    }
  }

  /**
   * Schedule push notification for flood alert
   * @param {Object} alert - Flood alert object
   */
  async scheduleFloodNotification(alert) {
    const { severity, location, countdownDisplay, riskLevel } = alert;

    let title, body, priority;

    switch (severity) {
      case 'immediate':
        title = '🚨 FLOOD ALERT - IMMEDIATE ACTION REQUIRED';
        body = `Flooding detected at ${location.name}. Take immediate precautions.`;
        priority = 'max';
        break;
      case 'urgent':
        title = '⚠️ Flood Warning - Action Needed';
        body = `${location.name}: ${riskLevel} flood risk. ${countdownDisplay} to prepare.`;
        priority = 'high';
        break;
      case 'warning':
        title = '🌧️ Flood Watch - Be Prepared';
        body = `${location.name}: Flood possible. ${countdownDisplay} to prepare.`;
        priority = 'normal';
        break;
      default:
        title = '📱 Flood Advisory';
        body = `${location.name}: Monitor conditions. ${countdownDisplay}`;
        priority = 'low';
    }

    await notificationService.sendImmediateAlert(title, body, {
      type: NOTIFICATION_TYPES.FLOOD_WARNING,
      severity,
      location: location.name,
      alertId: alert.id,
      priority
    });
  }

  /**
   * Get active alert for location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Object|null} - Active alert or null
   */
  getActiveAlert(lat, lng) {
    const locationKey = `${lat}_${lng}`;
    return this.activeAlerts.get(locationKey) || null;
  }

  /**
   * Get all active alerts
   * @returns {Array} - Array of active alerts
   */
  getAllActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Dismiss alert for location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  dismissAlert(lat, lng) {
    const locationKey = `${lat}_${lng}`;
    this.activeAlerts.delete(locationKey);
    this.alertCallbacks.forEach(callback => callback(null));
  }

  /**
   * Stop monitoring for location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  stopMonitoring(lat, lng) {
    const locationKey = `${lat}_${lng}`;
    
    if (this.monitoringIntervals.has(locationKey)) {
      clearInterval(this.monitoringIntervals.get(locationKey));
      this.monitoringIntervals.delete(locationKey);
    }
    
    this.activeAlerts.delete(locationKey);
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring() {
    this.monitoringIntervals.forEach(intervalId => clearInterval(intervalId));
    this.monitoringIntervals.clear();
    this.activeAlerts.clear();
    this.alertCallbacks.clear();
  }

  /**
   * Add alert callback
   * @param {Function} callback - Callback function
   */
  addAlertCallback(callback) {
    this.alertCallbacks.add(callback);
  }

  /**
   * Remove alert callback
   * @param {Function} callback - Callback function
   */
  removeAlertCallback(callback) {
    this.alertCallbacks.delete(callback);
  }

  /**
   * Set ML alert threshold for testing
   * @param {number} threshold - Probability threshold (0.5-0.95)
   */
  setMLAlertThreshold(threshold) {
    if (threshold >= ML_ALERT_THRESHOLDS.TESTING_MIN && threshold <= ML_ALERT_THRESHOLDS.TESTING_MAX) {
      this.mlAlertThreshold = threshold;
      console.log(`🤖 ML Alert threshold set to ${Math.round(threshold * 100)}%`);
    } else {
      console.warn(`⚠️ ML Alert threshold must be between ${ML_ALERT_THRESHOLDS.TESTING_MIN * 100}%-${ML_ALERT_THRESHOLDS.TESTING_MAX * 100}%`);
    }
  }

  /**
   * Enable/disable ML alerts
   * @param {boolean} enabled - Whether ML alerts are enabled
   */
  setMLAlertsEnabled(enabled) {
    this.enableMLAlerts = enabled;
    console.log(`🤖 ML Alerts ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current ML alert settings
   * @returns {Object} - Current ML settings
   */
  getMLAlertSettings() {
    return {
      enabled: this.enableMLAlerts,
      threshold: this.mlAlertThreshold,
      thresholdPercent: Math.round(this.mlAlertThreshold * 100)
    };
  }

  /**
   * Trigger test ML alert with specific probability
   * @param {number} testProbability - Test probability (0.5-0.95)
   * @param {Object} location - Location object
   */
  async triggerTestMLAlert(testProbability, location) {
    console.log(`🧪 Triggering test ML alert with ${Math.round(testProbability * 100)}% probability`);
    
    const mockMLPrediction = {
      flood_probability: testProbability,
      confidence: 0.85,
      timeframe_hours: 12,
      expected_duration_hours: 4,
      peak_probability: testProbability,
      contributing_factors: ['High ML prediction probability', 'Test scenario'],
      weather_summary: {
        current_temp: 28,
        humidity: 80,
        rainfall_24h: 5,
        wind_speed: 12
      },
      risk_indicators: ['Elevated flood risk detected by ML model'],
      location: location,
      timestamp: new Date().toISOString(),
      model_version: 'v2.0-test',
      data_sources: ['ML Model Test']
    };

    const alert = await this.generateFloodAlert(location, {
      current_conditions: {
        precipitation: 2, // Light rain
        temperature: 28,
        humidity: 80
      }
    }, null, 2, mockMLPrediction);

    // Trigger callbacks
    this.alertCallbacks.forEach(callback => callback(alert));
    
    return alert;
  }
}

// Create singleton instance
const floodAlertService = new FloodAlertService();

export default floodAlertService;