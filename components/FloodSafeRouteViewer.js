// components/FloodSafeRouteViewer.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker } from 'react-native-maps';
import RouteElevationChart from './RouteElevationChart';
import FloodSafeRoutingService from '../services/FloodSafeRoutingService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * FloodSafeRouteViewer Component
 *
 * Modal that displays multiple flood-safe route alternatives with:
 * - Interactive map showing all routes
 * - Route comparison cards with safety metrics
 * - Elevation profile charts
 * - Navigation integration
 */
const FloodSafeRouteViewer = ({
  visible,
  onClose,
  origin,
  destination,
  destinationName = 'Emergency Service',
  state = null
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'network', 'api', 'config', 'service', 'generic'
  const [routeData, setRouteData] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [expandedChart, setExpandedChart] = useState(null);

  // Load routes when modal opens
  useEffect(() => {
    if (visible && origin && destination) {
      loadRoutes();
    }
  }, [visible, origin, destination]);

  const loadRoutes = async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      console.log('Loading flood-safe routes...');

      const options = {
        state: state,
        skipCache: false
      };

      const result = await FloodSafeRoutingService.planFloodSafeRoute(
        origin,
        destination,
        options
      );

      setRouteData(result);
      setSelectedRouteIndex(0); // Select recommended route by default

      console.log(`Loaded ${result.routes.length} route(s)`);
    } catch (err) {
      console.error('Error loading routes:', err);

      // Categorize error type for better user messaging
      const errorMessage = err.message || 'An unexpected error occurred';
      let type = 'generic';

      if (errorMessage.includes('Network') || errorMessage.includes('internet')) {
        type = 'network';
      } else if (errorMessage.includes('authentication') || errorMessage.includes('API key')) {
        type = 'config';
      } else if (errorMessage.includes('forbidden') || errorMessage.includes('access')) {
        type = 'service';
      } else if (errorMessage.includes('rate limit')) {
        type = 'api';
      }

      setError(errorMessage);
      setErrorType(type);
    } finally {
      setLoading(false);
    }
  };

  const getErrorDetails = () => {
    const details = {
      network: {
        icon: 'cloud-offline',
        title: 'Connection Problem',
        description: 'Unable to connect to the routing service. Please check your internet connection and try again.',
        suggestion: 'Make sure you have a stable internet connection.'
      },
      config: {
        icon: 'key',
        title: 'Configuration Error',
        description: 'There is a problem with the routing service configuration. This is a temporary issue.',
        suggestion: 'Please try again later or use standard navigation.'
      },
      service: {
        icon: 'server',
        title: 'Service Temporarily Unavailable',
        description: 'The flood-safe routing service is temporarily unavailable. This usually resolves quickly.',
        suggestion: 'We automatically retry failed requests. You can also try again in a few moments.'
      },
      api: {
        icon: 'speedometer',
        title: 'Too Many Requests',
        description: 'The routing service has reached its request limit. Please wait a moment.',
        suggestion: 'Try again in a few minutes or use standard navigation.'
      },
      generic: {
        icon: 'alert-circle',
        title: 'Unable to Calculate Routes',
        description: error || 'An error occurred while calculating flood-safe routes.',
        suggestion: 'Please try again or use standard navigation.'
      }
    };

    return details[errorType] || details.generic;
  };

  const handleStartNavigation = async (route) => {
    try {
      // Open Google Maps with the destination
      const destCoords = `${destination.lat},${destination.lng}`;
      const originCoords = `${origin.latitude},${origin.longitude}`;

      const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=driving`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert(
          'Navigation Error',
          'Unable to open navigation. Please ensure Google Maps is installed.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Error opening navigation:', err);
      Alert.alert('Error', 'Failed to start navigation. Please try again.');
    }
  };

  const handleFallbackNavigation = async () => {
    try {
      // Open Google Maps with standard directions (fallback when flood-safe routing fails)
      const destCoords = `${destination.lat},${destination.lng}`;
      const originCoords = `${origin.latitude},${origin.longitude}`;

      const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=driving`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert(
          'Navigation Error',
          'Unable to open navigation. Please ensure Google Maps is installed.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Error opening fallback navigation:', err);
      Alert.alert('Error', 'Failed to start navigation. Please try again.');
    }
  };

  const renderRouteCard = (route, index) => {
    const isSelected = index === selectedRouteIndex;
    const isExpanded = expandedChart === index;
    const routeColor = getRouteColor(index);

    return (
      <TouchableOpacity
        key={`route-${index}`}
        style={[
          styles.routeCard,
          isSelected && styles.routeCardSelected,
          route.isRecommended && styles.routeCardRecommended
        ]}
        onPress={() => setSelectedRouteIndex(index)}
        activeOpacity={0.7}
      >
        {/* Route header */}
        <View style={styles.routeHeader}>
          <View style={styles.routeHeaderLeft}>
            <View style={[styles.routeColorIndicator, { backgroundColor: routeColor }]} />
            <View>
              <Text style={styles.routeTitle}>
                ROUTE {index + 1}
                {route.isRecommended && ' (RECOMMENDED)'}
              </Text>
              <View style={styles.safetyBadge}>
                <Ionicons
                  name={route.safetyLevel.level === 'high' ? 'shield-checkmark' : 'shield'}
                  size={14}
                  color={route.safetyLevel.color}
                />
                <Text style={[styles.safetyText, { color: route.safetyLevel.color }]}>
                  {route.safetyLevel.label}
                </Text>
              </View>
            </View>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          )}
        </View>

        {/* Route metrics */}
        <View style={styles.routeMetrics}>
          <View style={styles.metricItem}>
            <Ionicons name="navigate" size={16} color="#666" />
            <Text style={styles.metricValue}>{route.distance.toFixed(1)} km</Text>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.metricValue}>
              {FloodSafeRoutingService.formatDuration(route.duration)}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="trending-up" size={16} color="#666" />
            <Text style={styles.metricValue}>
              {route.elevationMetrics.average}m avg
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="analytics" size={16} color={route.safetyLevel.color} />
            <Text style={[styles.metricValue, { color: route.safetyLevel.color }]}>
              {route.safetyScore}/100
            </Text>
          </View>
        </View>

        {/* Elevation details */}
        <View style={styles.elevationDetails}>
          <View style={styles.elevationDetailRow}>
            <Text style={styles.elevationDetailLabel}>Min elevation:</Text>
            <Text style={styles.elevationDetailValue}>
              {route.elevationMetrics.minimum}m
            </Text>
          </View>
          {route.elevationMetrics.lowLyingPercentage > 0 && (
            <View style={styles.elevationDetailRow}>
              <Text style={[styles.elevationDetailLabel, { color: '#F44336' }]}>
                Low-lying areas:
              </Text>
              <Text style={[styles.elevationDetailValue, { color: '#F44336' }]}>
                {route.elevationMetrics.lowLyingPercentage.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {/* Warnings */}
        {route.lowLyingSegments && route.lowLyingSegments.length > 0 && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={14} color="#FF5722" />
            <Text style={styles.warningText}>
              Contains {route.lowLyingSegments.length} low-lying segment(s)
            </Text>
          </View>
        )}

        {/* Elevation chart toggle */}
        <TouchableOpacity
          style={styles.chartToggle}
          onPress={() => setExpandedChart(isExpanded ? null : index)}
        >
          <Text style={styles.chartToggleText}>
            {isExpanded ? 'Hide' : 'View'} Elevation Profile
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#4CAF50"
          />
        </TouchableOpacity>

        {/* Elevation chart (expanded) */}
        {isExpanded && (
          <View style={styles.chartContainer}>
            <RouteElevationChart
              route={route}
              elevationThreshold={routeData?.elevationThreshold || 10}
            />
          </View>
        )}

        {/* Navigate button (for selected route) */}
        {isSelected && (
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => handleStartNavigation(route)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.navigateButtonText}>Start Navigation</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const getRouteColor = (index) => {
    const colors = ['#4CAF50', '#2196F3', '#FF9800'];
    return colors[index] || '#666';
  };

  const getMapRegion = () => {
    if (!routeData || !routeData.routes || routeData.routes.length === 0) {
      return {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Calculate bounds to fit all routes with null safety
    const allCoordinates = routeData.routes.flatMap(route => {
      // Null check for geometry and coordinates
      if (!route || !route.geometry || !route.geometry.coordinates || !Array.isArray(route.geometry.coordinates)) {
        console.warn('Skipping route with invalid geometry in getMapRegion');
        return [];
      }

      return route.geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
    });

    // If no valid coordinates, fallback to origin
    if (allCoordinates.length === 0) {
      return {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    const lats = allCoordinates.map(c => c.latitude);
    const lngs = allCoordinates.map(c => c.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = (maxLat - minLat) * 1.3; // Add 30% padding
    const lngDelta = (maxLng - minLng) * 1.3;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Flood-Safe Routes</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              To {destinationName}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Analyzing flood-safe routes...</Text>
            <Text style={styles.loadingSubtext}>
              Requesting elevation data and calculating safety scores
            </Text>
          </View>
        )}

        {/* Error state */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            {(() => {
              const errorDetails = getErrorDetails();
              return (
                <>
                  <Ionicons name={errorDetails.icon} size={64} color="#F44336" />
                  <Text style={styles.errorTitle}>{errorDetails.title}</Text>
                  <Text style={styles.errorMessage}>{errorDetails.description}</Text>
                  {errorDetails.suggestion && (
                    <View style={styles.suggestionBox}>
                      <Ionicons name="information-circle" size={16} color="#2196F3" />
                      <Text style={styles.suggestionText}>{errorDetails.suggestion}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.retryButton} onPress={loadRoutes}>
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fallbackButton} onPress={handleFallbackNavigation}>
                    <Text style={styles.fallbackButtonText}>Use Standard Navigation</Text>
                  </TouchableOpacity>
                  {errorType === 'service' && (
                    <Text style={styles.debugHint}>
                      💡 Check the console for detailed error information
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
        )}

        {/* Routes display */}
        {!loading && !error && routeData && (
          <>
            {/* Map */}
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={getMapRegion()}
                showsUserLocation={true}
                showsMyLocationButton={false}
              >
                {/* Origin marker */}
                <Marker
                  coordinate={{
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                  }}
                  pinColor="#4CAF50"
                  title="Your Location"
                />

                {/* Destination marker */}
                <Marker
                  coordinate={{
                    latitude: destination.lat,
                    longitude: destination.lng,
                  }}
                  pinColor="#F44336"
                  title={destinationName}
                >
                  <View style={styles.destinationMarker}>
                    <Ionicons name="medical" size={24} color="#fff" />
                  </View>
                </Marker>

                {/* Route polylines */}
                {routeData.routes.map((route, index) => {
                  // Null safety: Skip routes with invalid geometry
                  if (!route || !route.geometry || !route.geometry.coordinates || !Array.isArray(route.geometry.coordinates)) {
                    console.warn(`Skipping polyline render for route ${index} - invalid geometry`);
                    return null;
                  }

                  const coordinates = route.geometry.coordinates.map(coord => ({
                    latitude: coord[1],
                    longitude: coord[0],
                  }));

                  return (
                    <Polyline
                      key={`polyline-${index}`}
                      coordinates={coordinates}
                      strokeColor={getRouteColor(index)}
                      strokeWidth={index === selectedRouteIndex ? 5 : 3}
                      lineDashPattern={route.isRecommended ? undefined : [10, 5]}
                    />
                  );
                })}
              </MapView>

              {/* Map legend */}
              <View style={styles.mapLegend}>
                <Text style={styles.mapLegendTitle}>
                  {routeData.routes.length} route{routeData.routes.length > 1 ? 's' : ''} found
                </Text>
                {routeData.routes.map((route, index) => (
                  <View key={`legend-${index}`} style={styles.mapLegendItem}>
                    <View style={[styles.mapLegendColor, { backgroundColor: getRouteColor(index) }]} />
                    <Text style={styles.mapLegendText}>
                      Route {index + 1} - {route.safetyLevel.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Route comparison cards */}
            <ScrollView
              style={styles.routeList}
              contentContainerStyle={styles.routeListContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={18} color="#2196F3" />
                <Text style={styles.infoText}>
                  Routes are analyzed for flood safety based on elevation. Select a route and tap "Start Navigation".
                </Text>
              </View>

              {routeData.routes.map((route, index) => renderRouteCard(route, index))}

              {/* Threshold info */}
              <View style={styles.thresholdInfo}>
                <Text style={styles.thresholdText}>
                  Flood threshold: {routeData.elevationThreshold}m above sea level
                </Text>
              </View>
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginHorizontal: 16,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    marginLeft: 8,
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  fallbackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },
  fallbackButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  debugHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 16,
    fontStyle: 'italic',
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.35,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  destinationMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  mapLegend: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mapLegendTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  mapLegendColor: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    marginRight: 6,
  },
  mapLegendText: {
    fontSize: 10,
    color: '#666',
  },
  routeList: {
    flex: 1,
  },
  routeListContent: {
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    marginLeft: 8,
    lineHeight: 16,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeCardSelected: {
    borderColor: '#4CAF50',
  },
  routeCardRecommended: {
    backgroundColor: '#F1F8F4',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeColorIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  routeMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  elevationDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 8,
  },
  elevationDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  elevationDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  elevationDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  warningText: {
    fontSize: 11,
    color: '#E65100',
    marginLeft: 6,
    flex: 1,
  },
  chartToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  chartToggleText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
    marginRight: 4,
  },
  chartContainer: {
    marginTop: 8,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  thresholdInfo: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  thresholdText: {
    fontSize: 11,
    color: '#999',
  },
});

export default FloodSafeRouteViewer;
