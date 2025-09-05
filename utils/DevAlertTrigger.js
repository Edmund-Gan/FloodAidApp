import floodAlertService from './FloodAlertService';
import { notificationService } from './NotificationService';
import { PRECIPITATION_THRESHOLDS, RISK_LEVELS } from './constants';

class DevAlertTrigger {
  constructor() {
    this.isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
    this.testScenarios = this.createTestScenarios();
    this.testLocations = this.createTestLocations();
    this.enablePushNotifications = true; // Enable push notifications for dev alerts
  }

  /**
   * Create predefined test scenarios for different flood conditions
   */
  createTestScenarios() {
    const now = new Date();
    const locations = {
      puchong: { lat: 3.1390, lon: 101.6869, name: 'Puchong, Selangor' },
      klcc: { lat: 3.1578, lon: 101.7123, name: 'KLCC, Kuala Lumpur' },
      johorBahru: { lat: 1.4927, lon: 103.7414, name: 'Johor Bahru, Johor' },
      kota_kinabalu: { lat: 5.9788, lon: 116.0753, name: 'Kota Kinabalu, Sabah' },
      kuching: { lat: 1.5535, lon: 110.3593, name: 'Kuching, Sarawak' }
    };

    return {
      immediate_heavy_rain: {
        name: 'Immediate Heavy Rain',
        description: 'Simulates heavy rainfall happening now',
        location: locations.puchong,
        weatherData: {
          current_conditions: {
            precipitation: 65, // Heavy rain threshold exceeded
            temperature: 26,
            humidity: 95,
            wind_speed: 15,
            wind_direction: 'SW',
            pressure: 1005
          },
          forecast_24h: {
            max_temperature: 29,
            min_temperature: 24,
            precipitation_sum: 120,
            precipitation_hours: 8,
            wind_speed_max: 25
          },
          river_data: {
            discharge: 350,
            level: 7.2,
            normal_range: '4-6'
          }
        },
        floodPeriods: [], // No future periods - happening now
        expectedCountdown: 0
      },

      urgent_6hour_warning: {
        name: 'Urgent 6-Hour Warning',
        description: 'Heavy rain expected in 4 hours',
        location: locations.klcc,
        weatherData: {
          current_conditions: {
            precipitation: 8, // Light current rain
            temperature: 28,
            humidity: 85,
            wind_speed: 12,
            wind_direction: 'W',
            pressure: 1008
          },
          forecast_24h: {
            max_temperature: 31,
            min_temperature: 25,
            precipitation_sum: 80,
            precipitation_hours: 6,
            wind_speed_max: 20
          },
          river_data: {
            discharge: 280,
            level: 6.8,
            normal_range: '4-6'
          }
        },
        floodPeriods: [{
          start: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          end: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
          maxPrecipitation: 55
        }],
        expectedCountdown: 4 * 60 * 60 * 1000
      },

      warning_12hour: {
        name: 'Warning 12-Hour Forecast',
        description: 'Moderate rain expected in 10 hours',
        location: locations.johorBahru,
        weatherData: {
          current_conditions: {
            precipitation: 2, // Light drizzle
            temperature: 29,
            humidity: 78,
            wind_speed: 8,
            wind_direction: 'SE',
            pressure: 1012
          },
          forecast_24h: {
            max_temperature: 32,
            min_temperature: 26,
            precipitation_sum: 45,
            precipitation_hours: 4,
            wind_speed_max: 15
          },
          river_data: {
            discharge: 220,
            level: 5.5,
            normal_range: '4-6'
          }
        },
        floodPeriods: [{
          start: new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString(),
          end: new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString(),
          maxPrecipitation: 35
        }],
        expectedCountdown: 10 * 60 * 60 * 1000
      },

      advisory_24hour: {
        name: 'Advisory 24-Hour Watch',
        description: 'Light rain possible tomorrow morning',
        location: locations.kota_kinabalu,
        weatherData: {
          current_conditions: {
            precipitation: 0.5, // Very light rain
            temperature: 30,
            humidity: 70,
            wind_speed: 6,
            wind_direction: 'E',
            pressure: 1015
          },
          forecast_24h: {
            max_temperature: 33,
            min_temperature: 27,
            precipitation_sum: 25,
            precipitation_hours: 3,
            wind_speed_max: 12
          },
          river_data: {
            discharge: 180,
            level: 4.8,
            normal_range: '4-6'
          }
        },
        floodPeriods: [{
          start: new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString(),
          end: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          maxPrecipitation: 15
        }],
        expectedCountdown: 20 * 60 * 60 * 1000
      },

      multiple_periods: {
        name: 'Multiple Rain Periods',
        description: 'Several rain periods over next 48 hours',
        location: locations.kuching,
        weatherData: {
          current_conditions: {
            precipitation: 5, // Light rain
            temperature: 27,
            humidity: 88,
            wind_speed: 10,
            wind_direction: 'NW',
            pressure: 1009
          },
          forecast_24h: {
            max_temperature: 30,
            min_temperature: 24,
            precipitation_sum: 95,
            precipitation_hours: 12,
            wind_speed_max: 18
          },
          river_data: {
            discharge: 320,
            level: 6.5,
            normal_range: '4-6'
          }
        },
        floodPeriods: [
          {
            start: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
            end: new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString(),
            maxPrecipitation: 25
          },
          {
            start: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString(),
            end: new Date(now.getTime() + 22 * 60 * 60 * 1000).toISOString(),
            maxPrecipitation: 45
          }
        ],
        expectedCountdown: 6 * 60 * 60 * 1000
      }
    };
  }

  /**
   * Trigger a test flood alert for development/testing
   * @param {string} scenarioKey - Key of test scenario
   * @param {Function} callback - Optional callback for alert updates
   * @returns {Promise} - Alert object
   */
  async triggerTestAlert(scenarioKey = 'urgent_6hour_warning', callback = null) {
    if (!this.isDevelopment) {
      console.warn('Dev alert triggers only work in development mode');
      return null;
    }

    const scenario = this.testScenarios[scenarioKey];
    if (!scenario) {
      console.error(`Unknown test scenario: ${scenarioKey}`);
      return null;
    }

    console.log(`🧪 Dev Alert: Triggering "${scenario.name}" scenario`);
    console.log(`📍 Location: ${scenario.location.name}`);
    console.log(`📋 Description: ${scenario.description}`);

    // Mock the weather service response
    this.mockWeatherService(scenario.weatherData, scenario.floodPeriods);

    // Generate the alert using FloodAlertService
    const alert = await this.generateMockAlert(scenario);

    // Add callback if provided
    if (callback) {
      floodAlertService.addAlertCallback(callback);
    }

    // Store the alert in the service
    const locationKey = `${scenario.location.lat}_${scenario.location.lng}`;
    floodAlertService.activeAlerts.set(locationKey, alert);

    // Trigger callbacks
    floodAlertService.alertCallbacks.forEach(cb => cb(alert));

    // Send push notification if enabled
    if (this.enablePushNotifications) {
      await this.sendDevPushNotification(alert);
    }

    console.log(`✅ Dev Alert Generated:`, {
      severity: alert.severity,
      countdown: alert.countdownDisplay,
      riskLevel: alert.riskLevel,
      pushNotification: this.enablePushNotifications
    });

    return alert;
  }

  /**
   * Generate mock alert based on scenario
   * @param {Object} scenario - Test scenario
   * @returns {Object} - Mock alert object
   */
  async generateMockAlert(scenario) {
    const now = new Date();
    const { location, weatherData, floodPeriods } = scenario;
    
    // Determine if flooding is imminent
    const currentRainfall = weatherData.current_conditions.precipitation;
    const isImminent = currentRainfall > PRECIPITATION_THRESHOLDS.MODERATE;
    
    let floodTimeframe, countdownTime, riskLevel, severity;

    if (isImminent) {
      floodTimeframe = {
        start: now,
        end: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        description: 'Flood conditions detected now'
      };
      countdownTime = 0;
      riskLevel = currentRainfall > PRECIPITATION_THRESHOLDS.HEAVY ? 
                  RISK_LEVELS.VERY_HIGH : RISK_LEVELS.HIGH;
      severity = 'immediate';
    } else if (floodPeriods && floodPeriods.length > 0) {
      const nextPeriod = floodPeriods[0];
      const startTime = new Date(nextPeriod.start);
      const endTime = new Date(nextPeriod.end);
      
      floodTimeframe = {
        start: startTime,
        end: endTime,
        description: this.formatFloodTimeframe(startTime, endTime)
      };
      
      countdownTime = Math.max(0, startTime.getTime() - now.getTime());
      riskLevel = nextPeriod.maxPrecipitation > PRECIPITATION_THRESHOLDS.HEAVY ? 
                  RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM;
      severity = this.calculateSeverity(countdownTime);
    }

    return {
      id: `dev_alert_${location.lat}_${location.lng}_${Date.now()}`,
      location: {
        name: location.name,
        coordinates: { lat: location.lat, lng: location.lng }
      },
      floodTimeframe,
      countdownTime,
      countdownDisplay: this.formatCountdown(countdownTime),
      riskLevel,
      severity,
      expectedRainfall: floodPeriods?.[0]?.maxPrecipitation || currentRainfall,
      currentConditions: {
        rainfall: currentRainfall,
        temperature: weatherData.current_conditions.temperature,
        humidity: weatherData.current_conditions.humidity
      },
      preparationGuidance: this.getPreparationGuidance(countdownTime, riskLevel),
      timestamp: now.toISOString(),
      isActive: true,
      isDevelopmentAlert: true
    };
  }

  /**
   * Mock weather service for testing
   */
  mockWeatherService(weatherData, floodPeriods) {
    // This would typically mock the actual weather service calls
    // For now, it's just a placeholder for future implementation
    console.log('🌦️ Mocking weather service with test data');
  }

  /**
   * Trigger random test alert for demo purposes
   */
  async triggerRandomAlert(callback = null) {
    const scenarioKeys = Object.keys(this.testScenarios);
    const randomKey = scenarioKeys[Math.floor(Math.random() * scenarioKeys.length)];
    return await this.triggerTestAlert(randomKey, callback);
  }

  /**
   * Create test locations for probability-based testing
   */
  createTestLocations() {
    return [
      { lat: 3.1390, lon: 101.6869, name: 'Puchong, Selangor' },
      { lat: 3.1578, lon: 101.7123, name: 'KLCC, Kuala Lumpur' },
      { lat: 1.4927, lon: 103.7414, name: 'Johor Bahru, Johor' },
      { lat: 5.9788, lon: 116.0753, name: 'Kota Kinabalu, Sabah' },
      { lat: 1.5535, lon: 110.3593, name: 'Kuching, Sarawak' },
      { lat: 5.4141, lon: 100.3288, name: 'Georgetown, Penang' },
      { lat: 3.8077, lon: 103.3260, name: 'Kuantan, Pahang' },
      { lat: 6.1254, lon: 102.2386, name: 'Kota Bharu, Kelantan' }
    ];
  }

  /**
   * Generate probability-based flood alert
   * @param {number} floodProbability - Flood probability (0-100)
   * @param {number} timeframeHours - Hours until flood (0-72)
   * @param {Object} location - Location object {lat, lng, name}
   * @param {Function} callback - Callback for alert updates
   * @returns {Promise} - Generated alert
   */
  async generateProbabilityBasedAlert(floodProbability, timeframeHours, location, callback = null) {
    if (!this.isDevelopment) {
      console.warn('Dev alert triggers only work in development mode');
      return null;
    }

    console.log(`🧪 Generating probability-based alert:`, {
      probability: `${floodProbability}%`,
      timeframe: `${timeframeHours}h`,
      location: location.name
    });

    try {
      // Generate realistic weather conditions based on probability
      const weatherConditions = this.generateWeatherFromProbability(floodProbability, timeframeHours);
      
      // Generate flood periods based on timeframe
      const floodPeriods = this.generateFloodPeriods(timeframeHours, floodProbability);
      
      // Create the alert
      const alert = await this.generateProbabilityAlert({
        location,
        floodProbability,
        timeframeHours,
        weatherConditions,
        floodPeriods
      });

      // Add callback if provided
      if (callback) {
        floodAlertService.addAlertCallback(callback);
      }

      // Store the alert in the service
      const locationKey = `${location.lat}_${location.lng}`;
      floodAlertService.activeAlerts.set(locationKey, alert);

      // Trigger callbacks
      floodAlertService.alertCallbacks.forEach(cb => cb(alert));

      // Send push notification if enabled
      if (this.enablePushNotifications) {
        await this.sendDevPushNotification(alert);
      }

      console.log(`✅ Probability-based alert generated:`, {
        severity: alert.severity,
        countdown: alert.countdownDisplay,
        riskLevel: alert.riskLevel,
        pushNotification: this.enablePushNotifications
      });

      return alert;
    } catch (error) {
      console.error('❌ Error generating probability-based alert:', error);
      throw error;
    }
  }

  /**
   * Generate weather conditions based on flood probability
   * @param {number} probability - Flood probability (0-100)
   * @param {number} timeframeHours - Hours until flood
   * @returns {Object} - Weather conditions
   */
  generateWeatherFromProbability(probability, timeframeHours) {
    // Base conditions
    let precipitation, temperature, humidity, pressure, windSpeed;
    
    if (probability >= 90) {
      // Very high probability - extreme conditions
      precipitation = 70 + Math.random() * 30; // 70-100mm/h
      humidity = 95 + Math.random() * 5;
      pressure = 995 + Math.random() * 10;
      windSpeed = 20 + Math.random() * 15;
    } else if (probability >= 75) {
      // High probability - heavy conditions
      precipitation = 40 + Math.random() * 30; // 40-70mm/h
      humidity = 90 + Math.random() * 8;
      pressure = 1000 + Math.random() * 10;
      windSpeed = 15 + Math.random() * 15;
    } else if (probability >= 50) {
      // Moderate probability
      precipitation = 15 + Math.random() * 25; // 15-40mm/h
      humidity = 80 + Math.random() * 15;
      pressure = 1005 + Math.random() * 15;
      windSpeed = 10 + Math.random() * 15;
    } else if (probability >= 25) {
      // Low probability
      precipitation = 5 + Math.random() * 15; // 5-20mm/h
      humidity = 70 + Math.random() * 20;
      pressure = 1008 + Math.random() * 12;
      windSpeed = 5 + Math.random() * 15;
    } else {
      // Very low probability
      precipitation = Math.random() * 8; // 0-8mm/h
      humidity = 60 + Math.random() * 25;
      pressure = 1010 + Math.random() * 10;
      windSpeed = 3 + Math.random() * 12;
    }

    // Adjust for immediate vs future flooding
    if (timeframeHours === 0) {
      // If immediate, increase current precipitation
      precipitation *= 1.2;
    } else if (timeframeHours <= 2) {
      // If very soon, keep high precipitation
      precipitation *= 1.1;
    } else {
      // If later, reduce current precipitation but keep conditions unstable
      precipitation *= 0.7;
    }

    temperature = 25 + Math.random() * 8; // 25-33°C

    return {
      current_conditions: {
        precipitation: Math.max(0, precipitation),
        temperature,
        humidity,
        wind_speed: windSpeed,
        wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
        pressure
      },
      forecast_24h: {
        max_temperature: temperature + 2 + Math.random() * 3,
        min_temperature: temperature - 3 - Math.random() * 3,
        precipitation_sum: precipitation * (2 + Math.random() * 4),
        precipitation_hours: Math.min(12, Math.max(1, precipitation / 5)),
        wind_speed_max: windSpeed * 1.5
      },
      river_data: {
        discharge: 100 + (probability / 100) * 300 + Math.random() * 100,
        level: 5 + (probability / 100) * 4 + Math.random() * 2,
        normal_range: '4-6'
      }
    };
  }

  /**
   * Generate flood periods based on timeframe
   * @param {number} timeframeHours - Hours until flood
   * @param {number} probability - Flood probability
   * @returns {Array} - Array of flood periods
   */
  generateFloodPeriods(timeframeHours, probability) {
    if (timeframeHours === 0) {
      return []; // No future periods - happening now
    }

    const now = new Date();
    const startTime = new Date(now.getTime() + timeframeHours * 60 * 60 * 1000);
    
    // Duration based on probability
    let durationHours;
    if (probability >= 80) {
      durationHours = 6 + Math.random() * 6; // 6-12 hours
    } else if (probability >= 60) {
      durationHours = 4 + Math.random() * 4; // 4-8 hours
    } else if (probability >= 40) {
      durationHours = 2 + Math.random() * 4; // 2-6 hours
    } else {
      durationHours = 1 + Math.random() * 3; // 1-4 hours
    }

    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    
    // Max precipitation based on probability
    const maxPrecipitation = probability >= 80 ? 60 + Math.random() * 40 :
                            probability >= 60 ? 40 + Math.random() * 20 :
                            probability >= 40 ? 20 + Math.random() * 20 :
                            10 + Math.random() * 15;

    return [{
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      maxPrecipitation,
      duration: durationHours
    }];
  }

  /**
   * Generate probability-based alert object
   * @param {Object} params - Alert generation parameters
   * @returns {Object} - Generated alert
   */
  async generateProbabilityAlert({ location, floodProbability, timeframeHours, weatherConditions, floodPeriods }) {
    const now = new Date();
    const probabilityDecimal = floodProbability / 100;
    
    // Determine current rainfall from conditions
    const currentRainfall = weatherConditions.current_conditions.precipitation;
    const isImminent = timeframeHours === 0 || currentRainfall > PRECIPITATION_THRESHOLDS.MODERATE;
    
    let floodTimeframe, countdownTime, riskLevel, severity;

    if (isImminent) {
      // Current flooding conditions
      floodTimeframe = {
        start: now,
        end: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        description: 'Flood conditions detected now'
      };
      countdownTime = 0;
      riskLevel = probabilityDecimal > 0.8 ? RISK_LEVELS.VERY_HIGH : RISK_LEVELS.HIGH;
      severity = 'immediate';
    } else {
      // Predicted flooding
      const startTime = new Date(now.getTime() + timeframeHours * 60 * 60 * 1000);
      const endTime = floodPeriods[0] ? new Date(floodPeriods[0].end) : 
                     new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
      
      floodTimeframe = {
        start: startTime,
        end: endTime,
        description: this.formatFloodTimeframe(startTime, endTime)
      };
      
      countdownTime = Math.max(0, startTime.getTime() - now.getTime());
      
      // Risk level based on probability
      if (probabilityDecimal >= 0.8) {
        riskLevel = RISK_LEVELS.VERY_HIGH;
      } else if (probabilityDecimal >= 0.6) {
        riskLevel = RISK_LEVELS.HIGH;
      } else if (probabilityDecimal >= 0.4) {
        riskLevel = RISK_LEVELS.MEDIUM;
      } else {
        riskLevel = RISK_LEVELS.LOW;
      }
      
      severity = this.calculateSeverity(countdownTime);
    }

    return {
      id: `prob_alert_${location.lat}_${location.lng}_${Date.now()}`,
      location: {
        name: location.name,
        coordinates: { lat: location.lat, lng: location.lng }
      },
      floodTimeframe,
      countdownTime,
      countdownDisplay: this.formatCountdown(countdownTime),
      riskLevel,
      severity,
      expectedRainfall: floodPeriods[0]?.maxPrecipitation || currentRainfall,
      currentConditions: {
        rainfall: currentRainfall,
        temperature: weatherConditions.current_conditions.temperature,
        humidity: weatherConditions.current_conditions.humidity
      },
      preparationGuidance: this.getPreparationGuidance(countdownTime, riskLevel),
      timestamp: now.toISOString(),
      isActive: true,
      isDevelopmentAlert: true,
      generatedFromProbability: floodProbability,
      generatedWeatherData: weatherConditions
    };
  }

  /**
   * Get available test locations
   */
  getTestLocations() {
    return this.testLocations;
  }

  /**
   * Get all available test scenarios (legacy support)
   */
  getAvailableScenarios() {
    return Object.entries(this.testScenarios).map(([key, scenario]) => ({
      key,
      name: scenario.name,
      description: scenario.description,
      location: scenario.location.name
    }));
  }

  /**
   * Get timeframe options for testing
   */
  getTimeframeOptions() {
    return [
      { value: 0, label: 'Immediate (Now)', description: 'Flood conditions detected now' },
      { value: 2, label: '2 Hours', description: 'Flooding expected in 2 hours' },
      { value: 6, label: '6 Hours', description: 'Flooding expected in 6 hours' },
      { value: 12, label: '12 Hours', description: 'Flooding expected in 12 hours' },
      { value: 24, label: '1 Day', description: 'Flooding expected tomorrow' },
      { value: 48, label: '2 Days', description: 'Flooding expected in 2 days' },
      { value: 72, label: '3 Days', description: 'Flooding expected in 3 days' }
    ];
  }

  /**
   * Get probability options for testing
   */
  getProbabilityOptions() {
    return [
      { value: 10, label: '10%', description: 'Very Low Risk', color: '#4CAF50' },
      { value: 25, label: '25%', description: 'Low Risk', color: '#8BC34A' },
      { value: 40, label: '40%', description: 'Moderate Risk', color: '#FFC107' },
      { value: 60, label: '60%', description: 'High Risk', color: '#FF9800' },
      { value: 75, label: '75%', description: 'Very High Risk', color: '#FF5722' },
      { value: 90, label: '90%', description: 'Extreme Risk', color: '#F44336' }
    ];
  }

  /**
   * Send push notification for development alert
   * @param {Object} alert - Alert object
   */
  async sendDevPushNotification(alert) {
    try {
      if (alert.severity === 'immediate') {
        // Send immediate notification
        await notificationService.sendImmediateAlert(
          'DEV: FLOOD ALERT - IMMEDIATE ACTION REQUIRED',
          `Test alert: Flooding at ${alert.location.name}. This is a development test.`,
          {
            type: 'dev_flood_alert',
            severity: alert.severity,
            location: alert.location.name,
            isDevelopmentAlert: true
          }
        );
      } else {
        // Send scheduled notification
        await notificationService.scheduleAdvancedFloodAlert({
          id: alert.id,
          severity: alert.severity,
          location: { name: alert.location.name },
          riskLevel: alert.riskLevel,
          countdownTime: alert.countdownTime || 0,
          countdownDisplay: alert.countdownDisplay || 'Monitor conditions'
        });
      }
      
      console.log(`📱 Push notification sent for dev alert: ${alert.severity} level`);
    } catch (error) {
      console.error('Error sending dev push notification:', error);
    }
  }

  /**
   * Send immediate test push notification
   */
  async sendTestPushNotification() {
    if (!this.isDevelopment) return;
    
    try {
      await notificationService.sendImmediateAlert(
        'TEST: FloodAid Notification System',
        'This is a test notification to verify push notifications are working on your device.',
        {
          type: 'test_notification',
          isDevelopmentAlert: true,
          timestamp: new Date().toISOString()
        }
      );
      
      console.log('📱 Test push notification sent successfully');
      return true;
    } catch (error) {
      console.error('Failed to send test push notification:', error);
      return false;
    }
  }

  /**
   * Enable/disable push notifications for dev alerts
   * @param {boolean} enabled - Whether to enable push notifications
   */
  setPushNotificationsEnabled(enabled) {
    this.enablePushNotifications = enabled;
    console.log(`📱 Dev push notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get push notification status
   * @returns {boolean} - Whether push notifications are enabled
   */
  isPushNotificationsEnabled() {
    return this.enablePushNotifications;
  }

  /**
   * Clear all test alerts
   */
  clearTestAlerts() {
    if (!this.isDevelopment) return;
    
    console.log('🧹 Clearing all development alerts');
    floodAlertService.stopAllMonitoring();
  }

  /**
   * Helper methods (duplicated from FloodAlertService for independence)
   */
  formatFloodTimeframe(start, end) {
    const startFormat = start.toLocaleDateString('en-MY') + ' ' + 
                       start.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    const endFormat = end.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    
    return `${startFormat} - ${endFormat}`;
  }

  calculateSeverity(countdownTime) {
    const hours = countdownTime / (1000 * 60 * 60);
    
    if (hours <= 2) return 'immediate';
    if (hours <= 6) return 'urgent'; 
    if (hours <= 12) return 'warning';
    return 'advisory';
  }

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

  getPreparationGuidance(countdownTime, riskLevel) {
    const hours = countdownTime / (1000 * 60 * 60);

    if (hours <= 2) {
      return {
        priority: 'immediate',
        message: 'Take immediate action - flood imminent',
        actions: ['Move to higher ground', 'Secure important documents', 'Prepare emergency kit'],
        timeEstimate: '15-30 minutes'
      };
    } else if (hours <= 6) {
      return {
        priority: 'urgent',
        message: 'Prepare now - flooding expected within 6 hours',
        actions: ['Review evacuation plan', 'Charge devices', 'Store water and food', 'Move vehicles'],
        timeEstimate: '1-2 hours'
      };
    } else if (hours <= 12) {
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
}

// Create singleton instance
const devAlertTrigger = new DevAlertTrigger();

export default devAlertTrigger;