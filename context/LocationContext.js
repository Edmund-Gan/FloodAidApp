import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [monitoredLocations, setMonitoredLocations] = useState([
    {
      id: 1,
      name: '123 Elm Street',
      subtitle: 'Home',
      address: '123 Elm Street, Puchong, Selangor',
      coordinates: { latitude: 3.1390, longitude: 101.6869 },
      riskLevel: 'Moderate Risk',
      riskProbability: 0.45,
      riskColor: '#FFBB00',
      image: 'https://via.placeholder.com/80x60/4A90E2/FFFFFF?text=House',
      lastUpdated: new Date().toISOString(),
      notifications: true
    },
    {
      id: 2,
      name: '456 Oak Avenue',
      subtitle: 'Workplace',
      address: '456 Oak Avenue, Petaling Jaya, Selangor',
      coordinates: { latitude: 3.1478, longitude: 101.6953 },
      riskLevel: 'Low Risk',
      riskProbability: 0.22,
      riskColor: '#44AA44',
      image: 'https://via.placeholder.com/80x60/44AA44/FFFFFF?text=Office',
      lastUpdated: new Date().toISOString(),
      notifications: true
    },
    {
      id: 3,
      name: '789 Pine Road',
      subtitle: 'School',
      address: '789 Pine Road, Subang Jaya, Selangor',
      coordinates: { latitude: 3.1556, longitude: 101.7023 },
      riskLevel: 'High Risk',
      riskProbability: 0.75,
      riskColor: '#FF4444',
      image: 'https://via.placeholder.com/80x60/FF4444/FFFFFF?text=School',
      lastUpdated: new Date().toISOString(),
      notifications: true
    },
    {
      id: 4,
      name: '101 Maple Drive',
      subtitle: 'Friend\'s House',
      address: '101 Maple Drive, Kajang, Selangor',
      coordinates: { latitude: 3.0738, longitude: 101.5183 },
      riskLevel: 'Low Risk',
      riskProbability: 0.18,
      riskColor: '#44AA44',
      image: 'https://via.placeholder.com/80x60/44AA44/FFFFFF?text=House',
      lastUpdated: new Date().toISOString(),
      notifications: false
    }
  ]);

  // Load monitored locations from AsyncStorage on component mount
  useEffect(() => {
    loadMonitoredLocations();
    requestLocationPermission();
  }, []);

  // Save monitored locations to AsyncStorage whenever they change
  useEffect(() => {
    saveMonitoredLocations();
  }, [monitoredLocations]);

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
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        getCurrentLocation();
      }
    } catch (error) {
      console.log('Error requesting location permission:', error);
      setLocationPermission('denied');
    }
  };

  const getCurrentLocation = async () => {
    try {
      if (locationPermission !== 'granted') {
        console.log('Location permission not granted');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('Error getting current location:', error);
    }
  };

  const addLocation = (newLocation) => {
    const location = {
      id: Date.now(),
      ...newLocation,
      lastUpdated: new Date().toISOString(),
      notifications: true,
      riskLevel: 'Unknown',
      riskProbability: 0,
      riskColor: '#666666'
    };
    
    setMonitoredLocations(prev => [...prev, location]);
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

  const value = {
    currentLocation,
    locationPermission,
    monitoredLocations,
    addLocation,
    updateLocation,
    removeLocation,
    toggleLocationNotifications,
    updateLocationRisk,
    refreshAllLocationRisks,
    getCurrentLocation,
    requestLocationPermission,
    getLocationById,
    getHighRiskLocations
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};