/**
 * ReliableLocationContext - Simplified, reliable location management
 *
 * This replaces the over-complex LocationContext with a clean, reliable approach
 * using the new ReliableLocationService and SimplifiedLocationCache.
 *
 * Key improvements:
 * - Simple, predictable location requests
 * - Clear user feedback during GPS acquisition
 * - Smart caching with manual location support
 * - Better error handling with user-friendly messages
 * - Maintains same interface for existing components
 */

import React, { createContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AsyncStorageHelper from '../utils/AsyncStorageHelper';
import ReliableLocationService from '../services/ReliableLocationService';
import SimplifiedLocationCache from '../services/SimplifiedLocationCache';
import FloodPredictionModel from '../services/FloodPredictionModel';
import floodAlertService from '../utils/FloodAlertService';
import addressValidationService from '../services/AddressValidationService';
import { notificationService } from '../utils/NotificationService';

export const ReliableLocationContext = createContext();

export const ReliableLocationProvider = ({ children }) => {
  // Core location state
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle', 'requesting', 'success', 'error', 'manual_required'
  const [locationProgress, setLocationProgress] = useState(null);

  // Manual location state
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [isManualLocationSet, setIsManualLocationSet] = useState(false);
  const [locationMode, setLocationMode] = useState('auto'); // 'auto' or 'manual'

  // Multi-location monitoring (kept for backward compatibility)
  const [activeAlerts, setActiveAlerts] = useState(new Map());
  const [alertsByLocation, setAlertsByLocation] = useState(new Map());
  const [monitoringStatus, setMonitoringStatus] = useState(new Map());
  const [monitoredLocations, setMonitoredLocations] = useState([
    // Default monitored locations for demo
    {
      id: 1,
      name: '123 Elm Street',
      subtitle: 'Home',
      customLabel: 'Alice - Home',
      familyMember: 'Alice',
      address: '123 Elm Street, Puchong, Selangor',
      coordinates: { latitude: 3.1390, longitude: 101.6869 },
      riskLevel: 'Moderate Risk',
      riskProbability: 0.45,
      riskColor: '#FFBB00',
      image: 'https://via.placeholder.com/80x60/4A90E2/FFFFFF?text=House',
      lastUpdated: new Date().toISOString(),
      notifications: true,
      alertsEnabled: true,
      coverageStatus: { available: true },
      contactInfo: { phone: '+60123456789', emergency: true }
    }
  ]);

  // Refs for saving monitored locations with debouncing
  const saveMonitoredTimer = useRef(null);
  const hasLoadedInitial = useRef(false);

  // Initialize location system
  useEffect(() => {
    initializeLocationSystem();
  }, []);

  // Save monitored locations to AsyncStorage with debouncing (iOS reliability fix)
  useEffect(() => {
    // Skip first render during initial load from AsyncStorage
    // This prevents overwriting with default state before loadMonitoredLocations completes
    if (!hasLoadedInitial.current) {
      hasLoadedInitial.current = true;
      return;
    }

    // Clear existing timer
    if (saveMonitoredTimer.current) {
      clearTimeout(saveMonitoredTimer.current);
    }

    // Debounced save (500ms) to batch rapid changes
    saveMonitoredTimer.current = setTimeout(() => {
      saveMonitoredLocations();
    }, 500);

    // Cleanup timer on unmount
    return () => {
      if (saveMonitoredTimer.current) {
        clearTimeout(saveMonitoredTimer.current);
      }
    };
  }, [monitoredLocations]);

  /**
   * Initialize the location system with cached data and permissions
   */
  const initializeLocationSystem = async () => {
    try {
      console.log('📍 ReliableLocationContext: Initializing location system...');

      // Load any cached locations
      await loadCachedLocations();

      // Load monitored locations from storage
      await loadMonitoredLocations();

      // Check initial permission status
      await checkLocationPermission();

      console.log('✅ ReliableLocationContext: Location system initialized');
    } catch (error) {
      console.error('❌ ReliableLocationContext: Initialization failed:', error);
    }
  };

  /**
   * Load cached locations and set as current if available
   */
  const loadCachedLocations = async () => {
    try {
      // Try to get any cached location (GPS preferred, then manual)
      const cachedLocation = await SimplifiedLocationCache.getAnyCachedLocation();

      if (cachedLocation) {
        setCurrentLocation({
          latitude: cachedLocation.latitude,
          longitude: cachedLocation.longitude,
          accuracy: cachedLocation.accuracy,
          timestamp: new Date(cachedLocation.timestamp).toISOString(),
          source: cachedLocation.source,
          isCached: true,
          isManual: cachedLocation.type === 'manual'
        });

        if (cachedLocation.type === 'manual') {
          setIsManualLocationSet(true);
          setLocationMode('manual');
        }

        console.log(`📍 Loaded cached location: ${cachedLocation.source} (${Math.round(cachedLocation.cacheAge/1000)}s old)`);
      }
    } catch (error) {
      console.error('❌ Error loading cached locations:', error);
    }
  };

  /**
   * Check current location permission status
   */
  const checkLocationPermission = async () => {
    try {
      const hasPermission = await ReliableLocationService.hasLocationPermission();
      setLocationPermission(hasPermission ? 'granted' : 'denied');
      console.log(`🔐 Location permission status: ${hasPermission ? 'granted' : 'denied'}`);
    } catch (error) {
      console.error('❌ Error checking location permission:', error);
      setLocationPermission('unknown');
    }
  };

  /**
   * Get current location with progress feedback
   */
  const getCurrentLocation = async (forceRefresh = false, enableHighAccuracy = true) => {
    const requestId = Date.now();
    console.log(`📍 ReliableLocationContext [${requestId}]: Getting current location (force: ${forceRefresh})`);

    try {
      // Reset error state
      setLocationError(null);
      setLocationStatus('requesting');

      // Setup progress callback
      const onProgress = (progress) => {
        console.log(`📍 [${requestId}]: Progress update:`, progress);
        setLocationProgress(progress);

        // Update status based on progress phase
        if (progress.phase === 'success') {
          setLocationStatus('success');
        } else if (progress.phase === 'failed') {
          setLocationStatus('error');
        }
      };

      // Get location with progress feedback
      const location = await ReliableLocationService.getCurrentLocation({
        forceRefresh,
        enableHighAccuracy,
        includeAddress: true, // Include reverse geocoded address
        onProgress
      });

      // Success - update current location
      const formattedLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(location.timestamp).toISOString(),
        source: location.source,
        requestId: location.requestId,
        isCached: false,
        isManual: false
      };

      setCurrentLocation(formattedLocation);
      setLocationStatus('success');
      setLocationPermission('granted');

      // Cache the successful GPS location
      await SimplifiedLocationCache.cacheGPSLocation(location);

      console.log(`✅ [${requestId}]: Location acquired successfully`);
      return formattedLocation;

    } catch (error) {
      console.error(`❌ [${requestId}]: Location request failed:`, error);

      setLocationError(error);
      setLocationStatus('error');

      // Check if we should show manual location input
      if (error.userFriendlyMessage?.showManualOption) {
        setLocationStatus('manual_required');
      }

      throw error;
    } finally {
      setLocationProgress(null);
    }
  };

  /**
   * Handle manual location selection
   */
  const handleManualLocationSelected = async (manualLocation) => {
    try {
      console.log('📍 ReliableLocationContext: Manual location selected:', manualLocation.address);

      const formattedLocation = {
        latitude: manualLocation.latitude,
        longitude: manualLocation.longitude,
        accuracy: manualLocation.accuracy,
        timestamp: new Date(manualLocation.timestamp).toISOString(),
        source: manualLocation.source,
        address: manualLocation.address,
        isCached: false,
        isManual: true
      };

      setCurrentLocation(formattedLocation);
      setLocationError(null);
      setLocationStatus('success');
      setIsManualLocationSet(true);
      setLocationMode('manual');
      setShowLocationInput(false);

      console.log('✅ ReliableLocationContext: Manual location set successfully');
      return formattedLocation;

    } catch (error) {
      console.error('❌ ReliableLocationContext: Error setting manual location:', error);
      throw error;
    }
  };

  /**
   * Switch between auto and manual location modes
   */
  const setLocationModePreference = async (mode) => {
    try {
      console.log(`📍 ReliableLocationContext: Switching to ${mode} mode`);
      setLocationMode(mode);

      if (mode === 'manual') {
        setShowLocationInput(true);
      } else {
        // Switch back to auto mode
        setIsManualLocationSet(false);
        await SimplifiedLocationCache.clearManualCache();

        // Try to get automatic location
        try {
          await getCurrentLocation(true);
        } catch (error) {
          console.log('Auto location failed, keeping manual mode available');
        }
      }
    } catch (error) {
      console.error('Error switching location mode:', error);
    }
  };

  /**
   * Retry location request (for UI buttons)
   */
  const retryLocationRequest = async () => {
    try {
      console.log('📍 ReliableLocationContext: Retrying location request...');
      return await getCurrentLocation(true, true);
    } catch (error) {
      console.error('❌ ReliableLocationContext: Retry failed:', error);
      throw error;
    }
  };

  /**
   * Get location display info (city, state)
   */
  const getLocationDisplayInfo = async (lat = null, lon = null) => {
    const latitude = lat || currentLocation?.latitude;
    const longitude = lon || currentLocation?.longitude;

    if (!latitude || !longitude) {
      return { state: 'Unknown', city: 'Unknown Location' };
    }

    try {
      const state = SimplifiedLocationCache.detectMalaysianState(latitude, longitude);
      const nearestCity = SimplifiedLocationCache.findNearestMalaysianCity(latitude, longitude);

      return {
        state: state,
        city: nearestCity?.name || 'Unknown Location',
        displayName: nearestCity ? `${nearestCity.name}, ${state}` : `${state}, Malaysia`
      };
    } catch (error) {
      console.error('Error getting location display info:', error);
      return { state: 'Selangor', city: 'Unknown Location', displayName: 'Malaysia' };
    }
  };

  /**
   * Get location source display name
   */
  const getLocationSourceName = () => {
    if (!currentLocation) return 'No Location';

    if (currentLocation.isManual) {
      return 'Manual Location';
    }

    if (currentLocation.isCached) {
      return 'Cached Location';
    }

    switch (currentLocation.source) {
      case 'gps_quick':
        return 'Quick GPS';
      case 'gps_medium':
        return 'Standard GPS';
      case 'gps_thorough':
        return 'High-Accuracy GPS';
      default:
        return 'GPS Location';
    }
  };

  /**
   * Clear location error (for UI)
   */
  const clearLocationError = () => {
    setLocationError(null);
    setLocationStatus('idle');
  };

  // Backward compatibility methods for existing components
  const requestLocationPermission = async () => {
    return await checkLocationPermission();
  };

  const requestManualLocation = () => {
    setShowLocationInput(true);
  };

  // Multi-location monitoring methods (simplified versions for backward compatibility)
  const loadMonitoredLocations = async () => {
    try {
      const storedLocations = await AsyncStorage.getItem('monitoredLocations');
      if (storedLocations) {
        const parsed = JSON.parse(storedLocations);
        setMonitoredLocations(parsed);
        console.log(`📍 Loaded ${parsed.length} monitored locations from storage`);
      }
    } catch (error) {
      console.error('❌ Error loading monitored locations:', error);
    }
  };

  const saveMonitoredLocations = async () => {
    try {
      // Use AsyncStorageHelper for iOS reliability with retry
      await AsyncStorageHelper.setItem(
        'monitoredLocations',
        JSON.stringify(monitoredLocations),
        {
          priority: 'high', // Monitored locations are important
          verify: true // Verify write succeeded (iOS needs this)
        }
      );
      console.log(`✅ ReliableLocationContext: Saved ${monitoredLocations.length} monitored locations`);
    } catch (error) {
      console.error('❌ ReliableLocationContext: Error saving monitored locations:', error);

      // Fallback to direct AsyncStorage if helper fails
      try {
        await AsyncStorage.setItem('monitoredLocations', JSON.stringify(monitoredLocations));
        console.log('✅ ReliableLocationContext: Saved monitored locations via fallback');
      } catch (fallbackError) {
        console.error('❌ ReliableLocationContext: Fallback save also failed:', fallbackError);
      }
    }
  };

  const addLocation = async (newLocation) => {
    const location = {
      id: Date.now(),
      ...newLocation,
      lastUpdated: new Date().toISOString(),
      notifications: true,
      alertsEnabled: true,
      riskLevel: 'Unknown',
      riskProbability: 0,
      riskColor: '#666666',
    };

    setMonitoredLocations(prev => [...prev, location]);
    return location;
  };

  const updateLocation = (locationId, updates) => {
    setMonitoredLocations(prev =>
      prev.map(location =>
        location.id === locationId
          ? { ...location, ...updates, lastUpdated: new Date().toISOString() }
          : location
      )
    );
  };

  const removeLocation = (locationId) => {
    setMonitoredLocations(prev =>
      prev.filter(location => location.id !== locationId)
    );
  };

  const getLocationById = (locationId) => {
    return monitoredLocations.find(location => location.id === locationId);
  };

  const getHighRiskLocations = () => {
    return monitoredLocations.filter(location => location.riskProbability >= 0.6);
  };

  // Placeholder methods for complex monitoring features (simplified)
  const startLocationMonitoring = async (location) => {
    console.log('📍 Starting simplified monitoring for:', location.name);
  };

  const stopLocationMonitoring = async (location) => {
    console.log('📍 Stopping monitoring for:', location.name);
  };

  const refreshLocationRisk = async (locationId) => {
    const location = getLocationById(locationId);
    if (!location) return null;

    try {
      const floodRisk = await FloodPredictionModel.getPredictionWithML(
        location.coordinates.latitude,
        location.coordinates.longitude
      );

      if (floodRisk && !floodRisk.is_na) {
        const riskData = {
          riskLevel: floodRisk.risk_level || 'Unknown',
          riskProbability: floodRisk.flood_probability || 0,
          riskColor: getRiskColor(floodRisk.flood_probability || 0),
          weatherSummary: floodRisk.weather_summary,
          lastPredictionUpdate: new Date().toISOString(),
        };

        updateLocation(locationId, riskData);
        return riskData;
      }
    } catch (error) {
      console.error('Error refreshing location risk:', error);
    }

    return null;
  };

  const getRiskColor = (probability) => {
    if (probability >= 0.8) return '#FF0000';
    if (probability >= 0.6) return '#FF4444';
    if (probability >= 0.3) return '#FFBB00';
    return '#44AA44';
  };

  // Context value with all methods and state
  const value = {
    // Core location state
    currentLocation,
    locationPermission,
    locationError,
    locationStatus,
    locationProgress,

    // Manual location state
    showLocationInput,
    isManualLocationSet,
    locationMode,

    // Multi-location state (backward compatibility)
    monitoredLocations,
    activeAlerts,
    alertsByLocation,
    monitoringStatus,

    // Core location methods
    getCurrentLocation,
    handleManualLocationSelected,
    setLocationModePreference,
    retryLocationRequest,
    getLocationDisplayInfo,
    getLocationSourceName,
    clearLocationError,
    requestLocationPermission,
    requestManualLocation,
    setShowLocationInput,

    // Multi-location methods (simplified for backward compatibility)
    addLocation,
    updateLocation,
    removeLocation,
    getLocationById,
    getHighRiskLocations,
    startLocationMonitoring,
    stopLocationMonitoring,
    refreshLocationRisk,

    // Placeholder methods to maintain interface compatibility
    toggleLocationNotifications: (locationId) => {
      updateLocation(locationId, { notifications: !getLocationById(locationId)?.notifications });
    },
    toggleLocationAlertsEnabled: (locationId) => {
      updateLocation(locationId, { alertsEnabled: !getLocationById(locationId)?.alertsEnabled });
    },
    updateLocationCustomLabel: (locationId, customLabel, familyMember = null) => {
      updateLocation(locationId, { customLabel, familyMember });
    },
    updateLocationContactInfo: (locationId, contactInfo) => {
      updateLocation(locationId, { contactInfo });
    },
    getActiveAlertsForLocation: () => [],
    getAllActiveAlerts: () => [],
    getLocationMonitoringStatus: () => null,
    dismissLocationAlert: () => {},
    getLocationsByFamily: () => ({}),
    initializeMultiLocationMonitoring: () => {},
    updateLocationMonitoring: () => {},
    refreshAllLocationRisks: async () => {},
    updateLocationRisk: async () => {},
  };

  return (
    <ReliableLocationContext.Provider value={value}>
      {children}
    </ReliableLocationContext.Provider>
  );
};

// Helper hook for using the location context
export const useReliableLocation = () => {
  const context = React.useContext(ReliableLocationContext);
  if (!context) {
    throw new Error('useReliableLocation must be used within a ReliableLocationProvider');
  }
  return context;
};