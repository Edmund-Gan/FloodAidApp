/**
 * LocationExample - Demo component showing the new reliable location system
 *
 * This component demonstrates how to integrate:
 * - ReliableLocationContext for location management
 * - LocationStatusIndicator for user feedback
 * - ManualLocationInput for manual selection
 * - SimplifiedLocationCache for state detection
 *
 * Use this as a reference for implementing location features in your app.
 */

import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ReliableLocationContext } from '../context/ReliableLocationContext';
import LocationStatusIndicator from './LocationStatusIndicator';
import ManualLocationInput from './ManualLocationInput';
import SimplifiedLocationCache from '../services/SimplifiedLocationCache';

const LocationExample = () => {
  const {
    currentLocation,
    locationStatus,
    locationProgress,
    locationError,
    showLocationInput,
    setShowLocationInput,
    getCurrentLocation,
    handleManualLocationSelected,
    retryLocationRequest,
    getLocationDisplayInfo,
    getLocationSourceName,
    clearLocationError,
  } = useContext(ReliableLocationContext);

  const [locationInfo, setLocationInfo] = useState(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  /**
   * Request location with full UI feedback
   */
  const handleLocationRequest = async () => {
    try {
      clearLocationError();
      await getCurrentLocation(true, true); // Force refresh with high accuracy

      // Get location display info
      await loadLocationInfo();
    } catch (error) {
      console.error('Location request failed:', error);
      // Error is already handled by the context and shown in LocationStatusIndicator
    }
  };

  /**
   * Load location display information
   */
  const loadLocationInfo = async () => {
    if (!currentLocation) return;

    setIsLoadingInfo(true);
    try {
      const info = await getLocationDisplayInfo();
      setLocationInfo(info);
    } catch (error) {
      console.error('Error loading location info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  /**
   * Handle manual location selection
   */
  const handleManualLocation = async (location) => {
    try {
      await handleManualLocationSelected(location);
      await loadLocationInfo();
    } catch (error) {
      Alert.alert('Error', 'Failed to set manual location. Please try again.');
    }
  };

  /**
   * Show cache statistics
   */
  const showCacheStats = async () => {
    try {
      const summary = await SimplifiedLocationCache.getLocationSummary();
      const stats = SimplifiedLocationCache.getCacheStats();

      Alert.alert(
        'Location Cache Status',
        `GPS Cache: ${summary.gps ? `${summary.gps.coordinates} (${summary.gps.age}s ago)` : 'None'}\n\n` +
        `Manual Cache: ${summary.manual ? `${summary.manual.address} (${summary.manual.age}min ago)` : 'None'}\n\n` +
        `Memory Cache: ${stats.memoryCacheSize} entries\n` +
        `Manual Cache: ${stats.manualCacheSize} entries`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get cache statistics.');
    }
  };

  /**
   * Clear all caches
   */
  const clearCaches = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached location data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await SimplifiedLocationCache.clearAllCaches();
              setLocationInfo(null);
              Alert.alert('Success', 'All location caches cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear caches.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#4CAF50', '#388E3C']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Reliable Location System</Text>
        <Text style={styles.headerSubtitle}>Demo of the new GPS location features</Text>
      </LinearGradient>

      {/* Location Status Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Location</Text>

        {currentLocation ? (
          <View style={styles.locationDisplay}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={20} color="#4CAF50" />
              <Text style={styles.locationTitle}>
                {locationInfo?.displayName || 'Loading location info...'}
              </Text>
            </View>

            <View style={styles.locationDetails}>
              <Text style={styles.locationCoords}>
                📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>

              <Text style={styles.locationAccuracy}>
                🎯 Accuracy: {currentLocation.accuracy ? `${Math.round(currentLocation.accuracy)}m` : 'Unknown'}
              </Text>

              <Text style={styles.locationSource}>
                📡 Source: {getLocationSourceName()}
              </Text>

              <Text style={styles.locationTime}>
                ⏰ {new Date(currentLocation.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noLocation}>
            <Ionicons name="location-outline" size={32} color="#ccc" />
            <Text style={styles.noLocationText}>No location available</Text>
            <Text style={styles.noLocationSubtext}>
              Request location to see your current position
            </Text>
          </View>
        )}
      </View>

      {/* Location Status Indicator */}
      <LocationStatusIndicator
        status={locationStatus}
        progress={locationProgress}
        error={locationError}
        location={currentLocation}
        onRetry={retryLocationRequest}
        onManualInput={() => setShowLocationInput(true)}
        onDismiss={clearLocationError}
      />

      {/* Action Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleLocationRequest}
            disabled={locationStatus === 'requesting'}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {locationStatus === 'requesting' ? 'Getting Location...' : 'Get GPS Location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => setShowLocationInput(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="hand-left" size={20} color="#FF9800" />
            <Text style={styles.secondaryButtonText}>Manual Location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.infoButton]}
            onPress={showCacheStats}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.infoButtonText}>Cache Stats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.warningButton]}
            onPress={clearCaches}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={20} color="#F44336" />
            <Text style={styles.warningButtonText}>Clear Cache</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* State Detection Demo */}
      {currentLocation && locationInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Detection</Text>

          <View style={styles.detectionResults}>
            <View style={styles.detectionItem}>
              <Text style={styles.detectionLabel}>Detected State:</Text>
              <Text style={styles.detectionValue}>{locationInfo.state}</Text>
            </View>

            <View style={styles.detectionItem}>
              <Text style={styles.detectionLabel}>Nearest City:</Text>
              <Text style={styles.detectionValue}>{locationInfo.city}</Text>
            </View>

            <View style={styles.detectionItem}>
              <Text style={styles.detectionLabel}>Display Name:</Text>
              <Text style={styles.detectionValue}>{locationInfo.displayName}</Text>
            </View>
          </View>
        </View>
      )}

      {/* System Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Status</Text>

        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Location Status</Text>
            <Text style={[styles.statusValue, getStatusColor(locationStatus)]}>
              {getStatusText(locationStatus)}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Has Location</Text>
            <Text style={[styles.statusValue, currentLocation ? styles.statusSuccess : styles.statusError]}>
              {currentLocation ? 'Yes' : 'No'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Cache Status</Text>
            <Text style={[styles.statusValue, styles.statusInfo]}>
              {currentLocation?.isCached ? 'Cached' : 'Fresh'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Location Type</Text>
            <Text style={[styles.statusValue, styles.statusInfo]}>
              {currentLocation?.isManual ? 'Manual' : 'GPS'}
            </Text>
          </View>
        </View>
      </View>

      {/* Manual Location Input Modal */}
      <ManualLocationInput
        visible={showLocationInput}
        onLocationSelected={handleManualLocation}
        onCancel={() => setShowLocationInput(false)}
        title="Select Your Location"
        subtitle="Choose your location for accurate flood predictions"
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 This demo shows the new reliable location system with progressive timeouts,
          smart caching, and user-friendly error handling.
        </Text>
      </View>
    </ScrollView>
  );
};

/**
 * Helper functions for UI
 */
const getStatusText = (status) => {
  switch (status) {
    case 'idle': return 'Ready';
    case 'requesting': return 'Getting Location';
    case 'success': return 'Success';
    case 'error': return 'Error';
    case 'manual_required': return 'Manual Needed';
    default: return 'Unknown';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'success': return { color: '#4CAF50' };
    case 'error': case 'manual_required': return { color: '#F44336' };
    case 'requesting': return { color: '#2196F3' };
    default: return { color: '#666' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  locationDisplay: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  locationDetails: {
    paddingLeft: 28,
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  locationSource: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  locationTime: {
    fontSize: 12,
    color: '#666',
  },
  noLocation: {
    alignItems: 'center',
    padding: 24,
  },
  noLocationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  noLocationSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  secondaryButtonText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  infoButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  warningButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  detectionResults: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  detectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detectionLabel: {
    fontSize: 14,
    color: '#666',
  },
  detectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusSuccess: {
    color: '#4CAF50',
  },
  statusError: {
    color: '#F44336',
  },
  statusInfo: {
    color: '#2196F3',
  },
  footer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  footerText: {
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 16,
  },
});

export default LocationExample;