/**
 * LocationContextCompat - Compatibility layer for old LocationContext usage
 *
 * This provides backward compatibility for components still using the old LocationContext
 * while they're being migrated to use ReliableLocationContext.
 *
 * This is a temporary solution to prevent crashes during the transition.
 */

import React, { createContext, useContext } from 'react';
import { ReliableLocationContext } from './ReliableLocationContext';

export const LocationContext = createContext();

/**
 * Compatibility provider that maps old LocationContext interface to new ReliableLocationContext
 */
export const LocationCompatibilityProvider = ({ children }) => {
  const reliableLocationContext = useContext(ReliableLocationContext);

  // If no reliable context available, provide minimal fallback
  if (!reliableLocationContext) {
    const fallbackValue = {
      currentLocation: null,
      locationPermission: null,
      locationError: null,
      monitoredLocations: [],
      activeAlerts: new Map(),
      alertsByLocation: new Map(),
      monitoringStatus: new Map(),
      locationMode: 'auto',
      showLocationInput: false,
      isManualLocationSet: false,

      // Fallback methods
      getCurrentLocation: async () => {
        throw new Error('LocationContext not properly initialized. Use ReliableLocationContext instead.');
      },
      requestLocationPermission: async () => false,
      clearLocationError: () => {},
      handleManualLocationSelected: async () => {},
      setLocationModePreference: async () => {},
      requestManualLocation: () => {},
      getLocationSourceName: () => 'Unknown',
      setShowLocationInput: () => {},

      // Multi-location methods (minimal implementation)
      addLocation: async () => ({}),
      updateLocation: () => {},
      removeLocation: () => {},
      toggleLocationNotifications: () => {},
      updateLocationRisk: async () => {},
      refreshAllLocationRisks: async () => {},
      getLocationById: () => null,
      getHighRiskLocations: () => [],
      startLocationMonitoring: async () => {},
      stopLocationMonitoring: async () => {},
      refreshLocationRisk: async () => null,
      toggleLocationAlertsEnabled: () => {},
      updateLocationCustomLabel: () => {},
      updateLocationContactInfo: () => {},
      getActiveAlertsForLocation: () => [],
      getAllActiveAlerts: () => [],
      getLocationMonitoringStatus: () => null,
      dismissLocationAlert: () => {},
      getLocationsByFamily: () => ({}),
      initializeMultiLocationMonitoring: () => {},
      updateLocationMonitoring: () => {},
    };

    return (
      <LocationContext.Provider value={fallbackValue}>
        {children}
      </LocationContext.Provider>
    );
  }

  // Map the new reliable context to old interface
  const compatibilityValue = {
    // Direct mappings
    currentLocation: reliableLocationContext.currentLocation,
    locationPermission: reliableLocationContext.locationPermission,
    locationError: reliableLocationContext.locationError,
    monitoredLocations: reliableLocationContext.monitoredLocations,
    activeAlerts: reliableLocationContext.activeAlerts,
    alertsByLocation: reliableLocationContext.alertsByLocation,
    monitoringStatus: reliableLocationContext.monitoringStatus,
    locationMode: reliableLocationContext.locationMode,
    showLocationInput: reliableLocationContext.showLocationInput,
    isManualLocationSet: reliableLocationContext.isManualLocationSet,

    // Method mappings
    getCurrentLocation: async (skipGPS = false, priority = 'balanced') => {
      // Map old parameters to new interface
      const forceRefresh = !skipGPS;
      const enableHighAccuracy = priority === 'thorough' || priority === 'accuracy';

      return await reliableLocationContext.getCurrentLocation(forceRefresh, enableHighAccuracy);
    },

    requestLocationPermission: reliableLocationContext.requestLocationPermission,
    clearLocationError: reliableLocationContext.clearLocationError,
    handleManualLocationSelected: reliableLocationContext.handleManualLocationSelected,
    setLocationModePreference: reliableLocationContext.setLocationModePreference,
    requestManualLocation: reliableLocationContext.requestManualLocation,
    getLocationSourceName: reliableLocationContext.getLocationSourceName,
    setShowLocationInput: reliableLocationContext.setShowLocationInput,

    // Multi-location methods (pass through)
    addLocation: reliableLocationContext.addLocation,
    updateLocation: reliableLocationContext.updateLocation,
    removeLocation: reliableLocationContext.removeLocation,
    toggleLocationNotifications: reliableLocationContext.toggleLocationNotifications,
    updateLocationRisk: reliableLocationContext.updateLocationRisk,
    refreshAllLocationRisks: reliableLocationContext.refreshAllLocationRisks,
    getLocationById: reliableLocationContext.getLocationById,
    getHighRiskLocations: reliableLocationContext.getHighRiskLocations,
    startLocationMonitoring: reliableLocationContext.startLocationMonitoring,
    stopLocationMonitoring: reliableLocationContext.stopLocationMonitoring,
    refreshLocationRisk: reliableLocationContext.refreshLocationRisk,
    toggleLocationAlertsEnabled: reliableLocationContext.toggleLocationAlertsEnabled,
    updateLocationCustomLabel: reliableLocationContext.updateLocationCustomLabel,
    updateLocationContactInfo: reliableLocationContext.updateLocationContactInfo,
    getActiveAlertsForLocation: reliableLocationContext.getActiveAlertsForLocation,
    getAllActiveAlerts: reliableLocationContext.getAllActiveAlerts,
    getLocationMonitoringStatus: reliableLocationContext.getLocationMonitoringStatus,
    dismissLocationAlert: reliableLocationContext.dismissLocationAlert,
    getLocationsByFamily: reliableLocationContext.getLocationsByFamily,
    initializeMultiLocationMonitoring: reliableLocationContext.initializeMultiLocationMonitoring,
    updateLocationMonitoring: reliableLocationContext.updateLocationMonitoring,
  };

  return (
    <LocationContext.Provider value={compatibilityValue}>
      {children}
    </LocationContext.Provider>
  );
};

/**
 * Hook for using the compatibility context
 */
export const useLocationCompat = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationCompat must be used within a LocationCompatibilityProvider');
  }
  return context;
};