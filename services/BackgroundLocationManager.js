// services/BackgroundLocationManager.js
import { AppState } from 'react-native';
import LocationService from './LocationService';
import LocationCache from './LocationCache';

class BackgroundLocationManager {
  static instance = null;
  static isRunning = false;
  static updateInterval = null;
  static significantLocationWatcher = null;
  static appStateSubscription = null;
  
  static config = {
    updateIntervalMs: 2 * 60 * 1000, // 2 minutes
    significantDistanceThreshold: 100, // 100 meters
    backgroundUpdateIntervalMs: 5 * 60 * 1000, // 5 minutes when in background
    enableSignificantLocationChanges: true,
    enableBackgroundUpdates: true
  };

  /**
   * Initialize background location manager
   */
  static async initialize(userConfig = {}) {
    if (this.instance) {
      console.log('⚠️ BackgroundLocationManager already initialized');
      return;
    }

    this.config = { ...this.config, ...userConfig };
    this.instance = this;

    console.log('🔄 Initializing BackgroundLocationManager...');
    
    // Set up app state listener
    this.setupAppStateListener();
    
    // Start background location updates
    if (this.config.enableBackgroundUpdates) {
      await this.startBackgroundUpdates();
    }
    
    // Set up significant location changes
    if (this.config.enableSignificantLocationChanges) {
      await this.startSignificantLocationTracking();
    }
    
    console.log('✅ BackgroundLocationManager initialized');
    return this.instance;
  }

  /**
   * Set up app state listener for optimized GPS behavior
   */
  static setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log(`📱 App state changed to: ${nextAppState}`);
      
      switch (nextAppState) {
        case 'active':
          this.onAppActive();
          break;
        case 'background':
          this.onAppBackground();
          break;
        case 'inactive':
          // App is transitioning between states
          break;
      }
    });
  }

  /**
   * Handle app becoming active - start preemptive GPS
   */
  static async onAppActive() {
    console.log('🎯 App became active - starting preemptive GPS acquisition...');
    
    // Start immediate GPS acquisition with lower priority to not block UI
    this.preemptiveGPSAcquisition();
    
    // Resume normal update interval
    if (this.config.enableBackgroundUpdates && !this.updateInterval) {
      this.startPeriodicUpdates(this.config.updateIntervalMs);
    }
  }

  /**
   * Handle app going to background - reduce GPS usage
   */
  static onAppBackground() {
    console.log('📱 App went to background - reducing GPS usage...');
    
    // Switch to longer interval for background updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.startPeriodicUpdates(this.config.backgroundUpdateIntervalMs);
    }
  }

  /**
   * Start background location updates with periodic GPS refresh
   */
  static async startBackgroundUpdates() {
    if (this.isRunning) {
      console.log('⚠️ Background updates already running');
      return;
    }

    console.log('🔄 Starting background location updates...');
    this.isRunning = true;

    // Initial GPS acquisition
    this.preemptiveGPSAcquisition();

    // Start periodic updates
    this.startPeriodicUpdates(this.config.updateIntervalMs);
  }

  /**
   * Start periodic GPS updates
   */
  static startPeriodicUpdates(intervalMs) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.periodicLocationUpdate();
    }, intervalMs);

    console.log(`⏰ Periodic location updates started (${intervalMs/1000}s interval)`);
  }

  /**
   * Preemptive GPS acquisition for faster user experience
   */
  static async preemptiveGPSAcquisition() {
    try {
      console.log('🚀 Starting preemptive GPS acquisition...');
      
      // Use background priority to avoid blocking main operations
      const location = await LocationService.getCurrentLocation(false, 'background');
      
      if (location && !location.isCached) {
        console.log('✅ Preemptive GPS successful:', {
          lat: location.lat.toFixed(4),
          lon: location.lon.toFixed(4),
          accuracy: location.accuracy
        });
      } else if (location && location.isCached) {
        console.log('📦 Used cached location for preemptive update');
      }
      
    } catch (error) {
      console.warn('⚠️ Preemptive GPS failed (this is normal):', error.message);
    }
  }

  /**
   * Periodic background location update
   */
  static async periodicLocationUpdate() {
    try {
      console.log('📍 Periodic location update...');
      
      // Check if we have recent cached location
      const cached = await LocationCache.getLocationFromCache('FRESH');
      if (cached) {
        console.log('📦 Skipping GPS - fresh cache available');
        return;
      }

      // Acquire new location with background priority
      const location = await LocationService.getCurrentLocation(false, 'background');
      
      if (location && !location.isCached) {
        console.log('📍 Background location updated');
        
        // Trigger any callbacks for location updates
        this.notifyLocationUpdate(location);
      }
      
    } catch (error) {
      console.warn('⚠️ Periodic location update failed:', error.message);
    }
  }

  /**
   * Set up significant location change tracking
   */
  static async startSignificantLocationTracking() {
    try {
      console.log('🎯 Starting significant location change tracking...');
      
      this.significantLocationWatcher = await LocationService.watchLocation(
        this.onSignificantLocationChange.bind(this),
        {
          interval: 60000, // Check every minute
          distance: this.config.significantDistanceThreshold
        }
      );
      
      console.log('✅ Significant location tracking started');
      
    } catch (error) {
      console.warn('⚠️ Could not start significant location tracking:', error.message);
    }
  }

  /**
   * Handle significant location changes
   */
  static onSignificantLocationChange(location) {
    console.log('🎯 Significant location change detected:', {
      lat: location.lat.toFixed(4),
      lon: location.lon.accuracy,
      accuracy: location.accuracy
    });

    // Update cache immediately
    LocationCache.cacheLocation(location);
    
    // Notify listeners
    this.notifyLocationUpdate(location);
    
    // Trigger state/display name updates in background
    this.backgroundStateUpdate(location);
  }

  /**
   * Background state and display name update
   */
  static async backgroundStateUpdate(location) {
    try {
      // Update state information in background
      const state = await LocationService.getStateFromCoordinates(location.lat, location.lon);
      const displayName = await LocationService.getLocationDisplayName(location.lat, location.lon);
      
      console.log('🏛️ Background updated location info:', {
        state,
        displayName: displayName?.substring(0, 30) + '...'
      });
      
    } catch (error) {
      console.warn('⚠️ Background state update failed:', error);
    }
  }

  /**
   * Notify location update to listeners
   */
  static notifyLocationUpdate(location) {
    // This can be extended to notify React Context or other listeners
    console.log('📢 Location update available for listeners');
  }

  /**
   * Stop all background location services
   */
  static async stop() {
    console.log('🛑 Stopping BackgroundLocationManager...');
    
    this.isRunning = false;
    
    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Stop significant location tracking
    if (this.significantLocationWatcher) {
      try {
        await this.significantLocationWatcher.remove();
        this.significantLocationWatcher = null;
      } catch (error) {
        console.warn('Error stopping location watcher:', error);
      }
    }
    
    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    this.instance = null;
    console.log('✅ BackgroundLocationManager stopped');
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ BackgroundLocationManager configuration updated');
    
    // Restart with new configuration if running
    if (this.isRunning && this.updateInterval) {
      this.startPeriodicUpdates(this.config.updateIntervalMs);
    }
  }

  /**
   * Get current status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      hasUpdateInterval: !!this.updateInterval,
      hasSignificantLocationWatcher: !!this.significantLocationWatcher,
      hasAppStateSubscription: !!this.appStateSubscription,
      config: this.config
    };
  }

  /**
   * Optimize performance by cleaning up resources
   */
  static optimize() {
    LocationCache.cleanExpiredCache();
    LocationService.optimizePerformance();
    console.log('🚀 BackgroundLocationManager optimized');
  }
}

export default BackgroundLocationManager;