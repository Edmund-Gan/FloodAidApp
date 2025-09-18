import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationManager from '../services/LocationManager';
import ManualLocationService from '../services/ManualLocationService';
import FloodPredictionModel from '../services/FloodPredictionModel';
import floodAlertService from '../utils/FloodAlertService';
import addressValidationService from '../services/AddressValidationService';
import { notificationService } from '../utils/NotificationService';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState(new Map());
  const [alertsByLocation, setAlertsByLocation] = useState(new Map());
  const [monitoringStatus, setMonitoringStatus] = useState(new Map());
  const [locationMode, setLocationMode] = useState('auto'); // 'auto' or 'manual'
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [isManualLocationSet, setIsManualLocationSet] = useState(false);
  const [monitoredLocations, setMonitoredLocations] = useState([
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
    },
    {
      id: 2,
      name: '456 Oak Avenue',
      subtitle: 'Workplace',
      customLabel: 'Alice - Office',
      familyMember: 'Alice',
      address: '456 Oak Avenue, Petaling Jaya, Selangor',
      coordinates: { latitude: 3.1478, longitude: 101.6953 },
      riskLevel: 'Low Risk',
      riskProbability: 0.22,
      riskColor: '#44AA44',
      image: 'https://via.placeholder.com/80x60/44AA44/FFFFFF?text=Office',
      lastUpdated: new Date().toISOString(),
      notifications: true,
      alertsEnabled: true,
      coverageStatus: { available: true },
      contactInfo: null
    },
    {
      id: 3,
      name: '789 Pine Road',
      subtitle: 'School',
      customLabel: 'Children - School',
      familyMember: 'Children',
      address: '789 Pine Road, Subang Jaya, Selangor',
      coordinates: { latitude: 3.1556, longitude: 101.7023 },
      riskLevel: 'High Risk',
      riskProbability: 0.75,
      riskColor: '#FF4444',
      image: 'https://via.placeholder.com/80x60/FF4444/FFFFFF?text=School',
      lastUpdated: new Date().toISOString(),
      notifications: true,
      alertsEnabled: true,
      coverageStatus: { available: true },
      contactInfo: { phone: '+60187654321', emergency: true, priority: 'high' }
    },
    {
      id: 4,
      name: '101 Maple Drive',
      subtitle: 'Parents House',
      customLabel: 'Parents - House',
      familyMember: 'Parents',
      address: '101 Maple Drive, Kajang, Selangor',
      coordinates: { latitude: 3.0738, longitude: 101.5183 },
      riskLevel: 'Low Risk',
      riskProbability: 0.18,
      riskColor: '#44AA44',
      image: 'https://via.placeholder.com/80x60/44AA44/FFFFFF?text=House',
      lastUpdated: new Date().toISOString(),
      notifications: false,
      alertsEnabled: false,
      coverageStatus: { available: true },
      contactInfo: { phone: '+60198765432', emergency: true }
    }
  ]);

  // Load monitored locations and manual preferences on component mount
  useEffect(() => {
    loadMonitoredLocations();
    loadLocationPreferences();
    requestLocationPermission();
    initializeMultiLocationMonitoring();
  }, []);

  // Load manual location preferences
  const loadLocationPreferences = async () => {
    try {
      const preference = await ManualLocationService.getLocationPreference();
      if (preference && preference.mode === 'manual' && preference.location) {
        console.log('📍 Loading manual location preference');
        setLocationMode('manual');
        setIsManualLocationSet(true);
        setCurrentLocation({
          latitude: preference.location.lat,
          longitude: preference.location.lon,
          accuracy: preference.location.accuracy,
          timestamp: new Date(preference.location.timestamp).toISOString(),
          source: 'MANUAL_PREFERENCE',
          address: preference.location.address,
          isCached: false,
          isDefault: false,
          isManual: true
        });
      }
    } catch (error) {
      console.error('Error loading location preferences:', error);
    }
  };

  // Save monitored locations to AsyncStorage whenever they change
  useEffect(() => {
    saveMonitoredLocations();
    updateLocationMonitoring();
  }, [monitoredLocations]);

  // Setup alert callback for multi-location monitoring
  useEffect(() => {
    const handleLocationAlert = (alert) => {
      if (alert) {
        const locationKey = `${alert.location.coordinates.lat}_${alert.location.coordinates.lng}`;
        setActiveAlerts(prev => new Map(prev).set(locationKey, alert));
        setAlertsByLocation(prev => {
          const newMap = new Map(prev);
          const locationAlerts = newMap.get(locationKey) || [];
          newMap.set(locationKey, [...locationAlerts, alert].slice(-5));
          return newMap;
        });
      }
    };

    floodAlertService.addAlertCallback(handleLocationAlert);

    return () => {
      floodAlertService.removeAlertCallback(handleLocationAlert);
    };
  }, []);

  const loadMonitoredLocations = async () => {
    try {
      const storedLocations = await AsyncStorage.getItem('monitoredLocations');
      if (storedLocations) {
        setMonitoredLocations(JSON.parse(storedLocations));
      }
    } catch (error) {
      console.log('Error loading monitored locations:', error);
    }
  };

  const saveMonitoredLocations = async () => {
    try {
      await AsyncStorage.setItem('monitoredLocations', JSON.stringify(monitoredLocations));
    } catch (error) {
      console.log('Error saving monitored locations:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      console.log('📍 LocationContext: Requesting location permission and initial location...');

      const hasPermission = await LocationManager.hasLocationPermission();
      if (hasPermission) {
        setLocationPermission('granted');

        // Try to get location with fast priority
        try {
          const location = await LocationManager.getCurrentLocation({
            priority: 'fast',
            allowStale: true,
            showError: false
          });

          if (location) {
            setCurrentLocation({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: new Date(location.timestamp).toISOString(),
              isCached: location.isCached || false,
              isDefault: false,
              source: location.source
            });
            console.log('✅ LocationContext: Initial location set successfully');
          }
        } catch (locationError) {
          console.log('📍 LocationContext: Initial location failed, will prompt later');
          setLocationError(LocationManager.getUserFriendlyError(locationError));
        }
      } else {
        setLocationPermission('denied');
        console.log('⚠️ LocationContext: Location permission not granted');
      }
    } catch (error) {
      console.error('❌ LocationContext: Error in requestLocationPermission:', error);
      setLocationPermission('denied');
    }
  };

  const getCurrentLocation = async (skipGPS = false, priority = 'balanced') => {
    try {
      console.log(`📍 LocationContext: Getting current location (skipGPS: ${skipGPS}, priority: ${priority})`);

      // Map priority names to LocationManager priorities
      const locationPriority = priority === 'speed' ? 'fast' :
                              priority === 'accuracy' ? 'thorough' : 'normal';

      const location = await LocationManager.getCurrentLocation({
        priority: locationPriority,
        allowStale: !skipGPS,
        showError: true,
        forceGPS: !skipGPS && priority === 'accuracy'
      });

      if (location) {
        console.log('✅ LocationContext: Location obtained successfully');
        setLocationPermission('granted');
        setLocationError(null);

        const formattedLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: new Date(location.timestamp).toISOString(),
          isCached: location.isCached || false,
          isDefault: false,
          isStale: location.isStale || false,
          source: location.source,
          debugId: location.debugId
        };

        setCurrentLocation(formattedLocation);
        return formattedLocation;
      } else {
        throw new Error('Location request returned null');
      }

    } catch (error) {
      console.error('❌ LocationContext: Error getting current location:', error);

      // Set user-friendly error
      const friendlyError = error.type ? error : LocationManager.getUserFriendlyError(error);
      setLocationError(friendlyError);

      console.log(`💬 LocationContext: Setting user-friendly error: ${friendlyError.title}`);

      // If no location available and it's not a permission issue, prompt for manual input
      if (friendlyError.type !== 'permission') {
        console.log('📍 LocationContext: Prompting for manual location input');
        setShowLocationInput(true);
      }

      throw error;
    }
  };

  // Setup location listener for background updates
  useEffect(() => {
    const handleLocationUpdate = (updatedLocation) => {
      console.log('📍 LocationContext: Received background location update');
      setCurrentLocation(prevLocation => {
        // Only update if this is actually newer/better
        if (!prevLocation || updatedLocation.timestamp > new Date(prevLocation.timestamp).getTime()) {
          return {
            latitude: updatedLocation.latitude,
            longitude: updatedLocation.longitude,
            accuracy: updatedLocation.accuracy,
            timestamp: new Date(updatedLocation.timestamp).toISOString(),
            isCached: false,
            isDefault: false,
            source: updatedLocation.source || 'background_update',
            isEnhanced: true
          };
        }
        return prevLocation;
      });
    };

    LocationManager.addLocationListener(handleLocationUpdate);

    return () => {
      LocationManager.removeLocationListener(handleLocationUpdate);
    };
  }, []);

  // Handle manual location input
  const handleManualLocationSelected = async (manualLocation) => {
    try {
      console.log('📍 LocationContext: Manual location selected:', manualLocation.address);

      // Use LocationManager to set manual location
      const savedLocation = await LocationManager.setManualLocation(
        manualLocation.lat,
        manualLocation.lon,
        manualLocation.address
      );

      // Set the location in context
      setCurrentLocation({
        latitude: savedLocation.latitude,
        longitude: savedLocation.longitude,
        accuracy: savedLocation.accuracy,
        timestamp: new Date(savedLocation.timestamp).toISOString(),
        source: 'manual',
        address: savedLocation.address,
        isCached: false,
        isDefault: false,
        isManual: true
      });

      // Clear any location errors
      setLocationError(null);
      setIsManualLocationSet(true);

      // Hide the location input modal
      setShowLocationInput(false);

      console.log('✅ LocationContext: Manual location set successfully');
      return savedLocation;

    } catch (error) {
      console.error('❌ LocationContext: Error setting manual location:', error);
      throw error;
    }
  };

  // Switch location mode
  const setLocationModePreference = async (mode) => {
    try {
      setLocationMode(mode);

      if (mode === 'manual') {
        // Show manual location input
        setShowLocationInput(true);
      } else {
        // Switch back to auto mode
        setIsManualLocationSet(false);
        await ManualLocationService.clearLocationPreference();

        // Try to get automatic location
        try {
          await getCurrentLocation(false, 'balanced');
        } catch (error) {
          console.log('Auto location failed, keeping manual mode');
          setLocationMode('manual');
        }
      }
    } catch (error) {
      console.error('Error switching location mode:', error);
    }
  };

  // Force manual location input
  const requestManualLocation = () => {
    setShowLocationInput(true);
  };

  // Get current location source display name
  const getLocationSourceName = () => {
    if (!currentLocation) return 'No Location';

    if (currentLocation.isManual || LocationCache.isManualLocation(currentLocation)) {
      return LocationCache.getSourceDisplayName(currentLocation.source);
    }

    return LocationCache.getSourceDisplayName(currentLocation.source) || 'Automatic';
  };

  const addLocation = async (newLocation) => {
    try {
      const location = {
        id: Date.now(),
        ...newLocation,
        lastUpdated: new Date().toISOString(),
        notifications: true,
        alertsEnabled: true,
        riskLevel: 'Unknown',
        riskProbability: 0,
        riskColor: '#666666',
        customLabel: newLocation.customLabel || newLocation.subtitle || newLocation.name,
        familyMember: newLocation.familyMember || null,
        contactInfo: newLocation.contactInfo || null,
        coverageStatus: { available: true, checking: true }
      };

      if (newLocation.coordinates) {
        const coverageStatus = addressValidationService.checkCoverageAvailability(newLocation.coordinates);
        location.coverageStatus = coverageStatus;

        if (coverageStatus.available) {
          try {
            const floodRisk = await FloodPredictionModel.getPredictionWithML(
              newLocation.coordinates.latitude,
              newLocation.coordinates.longitude
            );
            
            if (floodRisk && !floodRisk.is_na) {
              location.riskLevel = floodRisk.risk_level || 'Unknown';
              location.riskProbability = floodRisk.flood_probability || 0;
              location.riskColor = getRiskColor(floodRisk.flood_probability || 0);
              location.weatherSummary = floodRisk.weather_summary;
              location.lastPredictionUpdate = new Date().toISOString();
            }
          } catch (error) {
            console.warn('Failed to get initial flood risk for new location:', error);
          }
        }
      }
      
      setMonitoredLocations(prev => [...prev, location]);
      
      if (location.alertsEnabled) {
        startLocationMonitoring(location);
      }
      
      return location;
    } catch (error) {
      console.error('Error adding location:', error);
      throw error;
    }
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

  const toggleLocationNotifications = (locationId) => {
    setMonitoredLocations(prev =>
      prev.map(location =>
        location.id === locationId
          ? { ...location, notifications: !location.notifications }
          : location
      )
    );
  };

  const updateLocationRisk = async (locationId, riskData) => {
    const location = getLocationById(locationId);
    if (!location) return;

    const { probability } = riskData;
    let riskLevel, riskColor;

    if (probability >= 0.8) {
      riskLevel = 'Very High Risk';
      riskColor = '#FF0000';
    } else if (probability >= 0.6) {
      riskLevel = 'High Risk';
      riskColor = '#FF4444';
    } else if (probability >= 0.3) {
      riskLevel = 'Moderate Risk';
      riskColor = '#FFBB00';
    } else {
      riskLevel = 'Low Risk';
      riskColor = '#44AA44';
    }

    // Check if risk level has significantly changed
    const oldProbability = location.riskProbability || 0;
    const riskIncrease = (probability || 0) - oldProbability;
    const oldRiskLevel = getRiskLevelFromProbability(oldProbability);
    const newRiskLevel = getRiskLevelFromProbability(probability || 0);
    
    // Send notifications if location has notifications enabled
    if (location.notifications && location.alertsEnabled && probability !== null) {
      if (riskIncrease >= 0.2 || (oldRiskLevel !== newRiskLevel && probability >= 0.6)) {
        // Send risk increase notification
        await notificationService.sendFloodAlertUpdate({
          id: Date.now(),
          location: { name: location.customLabel || location.name },
          severity: probability >= 0.8 ? 'urgent' : 'warning',
          riskLevel: riskLevel,
          countdownDisplay: 'Monitor conditions'
        }, 'condition_worsened');
      } else if (riskIncrease <= -0.2 && oldProbability >= 0.6) {
        // Send risk decrease notification
        await notificationService.sendFloodAlertUpdate({
          id: Date.now(),
          location: { name: location.customLabel || location.name },
          severity: 'advisory',
          riskLevel: riskLevel,
          countdownDisplay: 'Conditions improving'
        }, 'condition_improved');
      }
    }

    updateLocation(locationId, {
      riskLevel,
      riskProbability: probability,
      riskColor,
      ...riskData
    });
  };

  const getRiskLevelFromProbability = (probability) => {
    if (probability >= 0.8) return 'Very High';
    if (probability >= 0.6) return 'High';
    if (probability >= 0.3) return 'Moderate';
    return 'Low';
  };

  const refreshAllLocationRisks = async () => {
    // Simulate API calls to update risk for all locations
    for (const location of monitoredLocations) {
      // Simulate varying risk levels
      const probability = Math.max(0.1, Math.min(0.9, location.riskProbability + (Math.random() - 0.5) * 0.2));
      await updateLocationRisk(location.id, { probability });
      
      // Add small delay to simulate real API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const getLocationById = (locationId) => {
    return monitoredLocations.find(location => location.id === locationId);
  };

  const getHighRiskLocations = () => {
    return monitoredLocations.filter(location => location.riskProbability >= 0.6);
  };

  // New multi-location monitoring functions
  const initializeMultiLocationMonitoring = () => {
    console.log('Initializing multi-location monitoring for', monitoredLocations.length, 'locations');
    
    monitoredLocations.forEach(location => {
      if (location.alertsEnabled && location.coordinates) {
        startLocationMonitoring(location);
      }
    });
  };

  const updateLocationMonitoring = () => {
    monitoredLocations.forEach(location => {
      const locationKey = `${location.coordinates?.latitude}_${location.coordinates?.longitude}`;
      const isCurrentlyMonitored = monitoringStatus.has(locationKey);
      
      if (location.alertsEnabled && location.coordinates && !isCurrentlyMonitored) {
        startLocationMonitoring(location);
      } else if ((!location.alertsEnabled || !location.coordinates) && isCurrentlyMonitored) {
        stopLocationMonitoring(location);
      }
    });
  };

  const startLocationMonitoring = async (location) => {
    if (!location.coordinates) return;
    
    const locationKey = `${location.coordinates.latitude}_${location.coordinates.longitude}`;
    
    try {
      console.log(`Starting monitoring for ${location.customLabel || location.name}`);
      
      await floodAlertService.startMonitoring({
        lat: location.coordinates.latitude,
        lng: location.coordinates.longitude,
        name: location.customLabel || location.name,
        id: location.id
      });
      
      setMonitoringStatus(prev => new Map(prev).set(locationKey, {
        active: true,
        startedAt: new Date().toISOString(),
        location: location
      }));
      
      await updateLocationRisk(location.id, { isMonitoring: true });
      
    } catch (error) {
      console.error(`Failed to start monitoring for ${location.name}:`, error);
      setMonitoringStatus(prev => new Map(prev).set(locationKey, {
        active: false,
        error: error.message,
        location: location
      }));
    }
  };

  const stopLocationMonitoring = async (location) => {
    if (!location.coordinates) return;
    
    const locationKey = `${location.coordinates.latitude}_${location.coordinates.longitude}`;
    
    console.log(`Stopping monitoring for ${location.customLabel || location.name}`);
    
    floodAlertService.stopMonitoring(location.coordinates.latitude, location.coordinates.longitude);
    
    setMonitoringStatus(prev => {
      const newMap = new Map(prev);
      newMap.delete(locationKey);
      return newMap;
    });
    
    setActiveAlerts(prev => {
      const newMap = new Map(prev);
      newMap.delete(locationKey);
      return newMap;
    });
    
    await updateLocationRisk(location.id, { isMonitoring: false });
  };

  const refreshLocationRisk = async (locationId) => {
    const location = getLocationById(locationId);
    if (!location || !location.coordinates) return null;

    try {
      console.log(`Refreshing risk for ${location.customLabel || location.name}`);
      
      const floodRisk = await FloodPredictionModel.getPredictionWithML(
        location.coordinates.latitude,
        location.coordinates.longitude
      );
      
      if (floodRisk && !floodRisk.is_na) {
        const riskData = {
          probability: floodRisk.flood_probability || 0,
          riskLevel: floodRisk.risk_level || 'Unknown',
          riskColor: getRiskColor(floodRisk.flood_probability || 0),
          weatherSummary: floodRisk.weather_summary,
          contributingFactors: floodRisk.contributing_factors,
          lastPredictionUpdate: new Date().toISOString(),
          modelInfo: floodRisk.model_info
        };
        
        await updateLocationRisk(locationId, riskData);
        return riskData;
      } else {
        const naData = {
          probability: null,
          riskLevel: 'N/A',
          riskColor: '#666666',
          lastPredictionUpdate: new Date().toISOString(),
          error: 'Prediction unavailable'
        };
        await updateLocationRisk(locationId, naData);
        return naData;
      }
    } catch (error) {
      console.error(`Failed to refresh risk for location ${locationId}:`, error);
      const errorData = {
        probability: null,
        riskLevel: 'Error',
        riskColor: '#666666',
        lastPredictionUpdate: new Date().toISOString(),
        error: error.message
      };
      await updateLocationRisk(locationId, errorData);
      return errorData;
    }
  };

  const toggleLocationAlertsEnabled = (locationId) => {
    setMonitoredLocations(prev =>
      prev.map(location => {
        if (location.id === locationId) {
          const updatedLocation = { 
            ...location, 
            alertsEnabled: !location.alertsEnabled,
            lastUpdated: new Date().toISOString()
          };
          
          if (updatedLocation.alertsEnabled && updatedLocation.coordinates) {
            setTimeout(() => startLocationMonitoring(updatedLocation), 100);
          } else {
            stopLocationMonitoring(location);
          }
          
          return updatedLocation;
        }
        return location;
      })
    );
  };

  const updateLocationCustomLabel = (locationId, customLabel, familyMember = null) => {
    updateLocation(locationId, { 
      customLabel, 
      familyMember,
      lastUpdated: new Date().toISOString()
    });
  };

  const updateLocationContactInfo = (locationId, contactInfo) => {
    updateLocation(locationId, { 
      contactInfo,
      lastUpdated: new Date().toISOString()
    });
  };

  const getActiveAlertsForLocation = (locationId) => {
    const location = getLocationById(locationId);
    if (!location || !location.coordinates) return [];
    
    const locationKey = `${location.coordinates.latitude}_${location.coordinates.longitude}`;
    return alertsByLocation.get(locationKey) || [];
  };

  const getAllActiveAlerts = () => {
    return Array.from(activeAlerts.values());
  };

  const getLocationMonitoringStatus = (locationId) => {
    const location = getLocationById(locationId);
    if (!location || !location.coordinates) return null;
    
    const locationKey = `${location.coordinates.latitude}_${location.coordinates.longitude}`;
    return monitoringStatus.get(locationKey) || null;
  };

  const dismissLocationAlert = (locationId) => {
    const location = getLocationById(locationId);
    if (!location || !location.coordinates) return;
    
    const locationKey = `${location.coordinates.latitude}_${location.coordinates.longitude}`;
    floodAlertService.dismissAlert(location.coordinates.latitude, location.coordinates.longitude);
    
    setActiveAlerts(prev => {
      const newMap = new Map(prev);
      newMap.delete(locationKey);
      return newMap;
    });
  };

  const getLocationsByFamily = () => {
    const familyGroups = new Map();
    
    monitoredLocations.forEach(location => {
      const family = location.familyMember || 'Other';
      if (!familyGroups.has(family)) {
        familyGroups.set(family, []);
      }
      familyGroups.get(family).push(location);
    });
    
    return Object.fromEntries(familyGroups);
  };

  const getRiskColor = (probability) => {
    if (probability >= 0.8) return '#FF0000';
    if (probability >= 0.6) return '#FF4444';
    if (probability >= 0.3) return '#FFBB00';
    return '#44AA44';
  };

  const value = {
    currentLocation,
    locationPermission,
    locationError,
    monitoredLocations,
    activeAlerts,
    alertsByLocation,
    monitoringStatus,
    locationMode,
    showLocationInput,
    isManualLocationSet,

    // Original functions
    addLocation,
    updateLocation,
    removeLocation,
    toggleLocationNotifications,
    updateLocationRisk,
    refreshAllLocationRisks,
    getCurrentLocation,
    requestLocationPermission,
    getLocationById,
    getHighRiskLocations,
    clearLocationError: () => setLocationError(null),

    // Manual location functions
    handleManualLocationSelected,
    setLocationModePreference,
    requestManualLocation,
    getLocationSourceName,
    setShowLocationInput,

    // New multi-location functions
    startLocationMonitoring,
    stopLocationMonitoring,
    refreshLocationRisk,
    toggleLocationAlertsEnabled,
    updateLocationCustomLabel,
    updateLocationContactInfo,
    getActiveAlertsForLocation,
    getAllActiveAlerts,
    getLocationMonitoringStatus,
    dismissLocationAlert,
    getLocationsByFamily,
    initializeMultiLocationMonitoring,
    updateLocationMonitoring
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};