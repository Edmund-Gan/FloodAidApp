import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationService from '../services/LocationService';
import FloodPredictionModel from '../services/FloodPredictionModel';
import floodAlertService from '../utils/FloodAlertService';
import addressValidationService from '../services/AddressValidationService';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState(new Map());
  const [alertsByLocation, setAlertsByLocation] = useState(new Map());
  const [monitoringStatus, setMonitoringStatus] = useState(new Map());
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

  // Load monitored locations from AsyncStorage on component mount
  useEffect(() => {
    loadMonitoredLocations();
    requestLocationPermission();
    initializeMultiLocationMonitoring();
  }, []);

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
      // Use LocationService which handles permissions more robustly
      const location = await LocationService.getCurrentLocation(false);
      
      if (location) {
        setLocationPermission('granted');
        setCurrentLocation({
          latitude: location.lat,
          longitude: location.lon,
          accuracy: location.accuracy,
          timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
          isCached: location.isCached || false,
          isDefault: location.isDefault || false
        });
      } else {
        setLocationPermission('denied');
      }
    } catch (error) {
      console.log('Error requesting location permission:', error);
      setLocationPermission('denied');
    }
  };

  const getCurrentLocation = async (skipGPS = false) => {
    try {
      console.log(`📍 LocationContext: Getting current location (skipGPS: ${skipGPS})`);
      
      // Use LocationService's robust location handling
      const location = await LocationService.getCurrentLocationWithMalaysiaCheck(skipGPS);
      
      if (location) {
        console.log('📍 LocationContext: Location obtained successfully');
        setLocationPermission('granted');
        setCurrentLocation({
          latitude: location.lat,
          longitude: location.lon,
          accuracy: location.accuracy,
          timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
          isCached: location.isCached || false,
          isDefault: location.isDefault || false,
          isRedirected: location.isRedirected || false,
          debugId: location.debugId
        });
        
        return location;
      } else {
        throw new Error('LocationService returned null location');
      }
    } catch (error) {
      console.error('❌ LocationContext: Error getting current location:', error);
      
      // Get user-friendly error message
      const friendlyError = LocationService.getLocationErrorMessage(error);
      setLocationError(friendlyError);
      console.log(`💬 LocationContext: Setting user-friendly error: ${friendlyError.title}`);
      
      // Try to get cached location as fallback
      const cachedLocation = await LocationService.getCachedLocation();
      if (cachedLocation) {
        console.log('📍 LocationContext: Using cached location as fallback');
        setCurrentLocation({
          latitude: cachedLocation.lat,
          longitude: cachedLocation.lon,
          accuracy: cachedLocation.accuracy,
          timestamp: cachedLocation.cacheTime ? new Date(cachedLocation.cacheTime).toISOString() : new Date().toISOString(),
          isCached: true,
          isDefault: cachedLocation.isDefault || false
        });
        
        // Clear error since we have a fallback location
        setLocationError(null);
        return cachedLocation;
      }
      
      // No fallback available, keep the error
      console.error('❌ LocationContext: No fallback location available');
      throw error;
    }
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

  const updateLocationRisk = (locationId, riskData) => {
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

    updateLocation(locationId, {
      riskLevel,
      riskProbability: probability,
      riskColor,
      ...riskData
    });
  };

  const refreshAllLocationRisks = async () => {
    // Simulate API calls to update risk for all locations
    for (const location of monitoredLocations) {
      // Simulate varying risk levels
      const probability = Math.max(0.1, Math.min(0.9, location.riskProbability + (Math.random() - 0.5) * 0.2));
      updateLocationRisk(location.id, { probability });
      
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
      
      updateLocationRisk(location.id, { isMonitoring: true });
      
    } catch (error) {
      console.error(`Failed to start monitoring for ${location.name}:`, error);
      setMonitoringStatus(prev => new Map(prev).set(locationKey, {
        active: false,
        error: error.message,
        location: location
      }));
    }
  };

  const stopLocationMonitoring = (location) => {
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
    
    updateLocationRisk(location.id, { isMonitoring: false });
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
        
        updateLocationRisk(locationId, riskData);
        return riskData;
      } else {
        const naData = {
          probability: null,
          riskLevel: 'N/A',
          riskColor: '#666666',
          lastPredictionUpdate: new Date().toISOString(),
          error: 'Prediction unavailable'
        };
        updateLocationRisk(locationId, naData);
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
      updateLocationRisk(locationId, errorData);
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