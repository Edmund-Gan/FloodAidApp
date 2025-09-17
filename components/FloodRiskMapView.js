import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  ScrollView
} from 'react-native';
import MapView, { Polygon, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { RISK_COLORS } from '../utils/RiskCalculations';
import MalaysiaStateService from '../services/MalaysiaStateService';

const { width, height } = Dimensions.get('window');

export default function FloodRiskMapView({ style, onStateSelected }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statesData, setStatesData] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [showStateModal, setShowStateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    loadMapData();
  }, []);

  useEffect(() => {
    // Run map coverage validation when data is available
    if (statesData.length > 0 && mapRegion) {
      setTimeout(() => {
        validateMapCoverage();
      }, 1000); // Small delay to let polygons render first
    }
  }, [statesData, mapRegion]);

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🗺️ Loading flood risk map data...');

      // Load Malaysia states with flood risk data
      const states = await MalaysiaStateService.loadMalaysiaStates();

      if (states && states.length > 0) {
        setStatesData(states);
        setMapRegion(MalaysiaStateService.getWestMalaysiaRegion());
        console.log(`✅ Loaded ${states.length} states for flood risk map`);

        // Log the risk data for verification
        states.forEach(state => {
          if (state.riskData) {
            console.log(`📊 ${state.name}: ${(state.riskData.floodProbability * 100).toFixed(0)}% (${state.riskData.riskLevel})`);
          }
        });
      } else {
        throw new Error('No state data available');
      }

    } catch (loadError) {
      console.error('❌ Error loading map data:', loadError);
      setError('Unable to load flood risk map data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Refreshing flood risk data...');

      await MalaysiaStateService.refreshAllStates();
      const updatedStates = MalaysiaStateService.getAllStates();
      setStatesData(updatedStates);

      // Log updated risk data for verification
      updatedStates.forEach(state => {
        if (state.riskData) {
          console.log(`🔄 ${state.name}: ${(state.riskData.floodProbability * 100).toFixed(0)}% (${state.riskData.riskLevel}) - ${state.riskData.color}`);
        }
      });

      console.log('✅ Flood risk data refreshed successfully');
    } catch (refreshError) {
      console.error('❌ Error refreshing data:', refreshError);
      Alert.alert(
        'Refresh Failed',
        'Unable to update flood risk data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatePress = (state) => {
    console.log(`📍 State selected: ${state.name}`);
    setSelectedState(state);
    setShowStateModal(true);

    if (onStateSelected) {
      onStateSelected(state);
    }

    // Zoom to state if possible
    if (mapRef.current && state.center) {
      mapRef.current.animateToRegion({
        latitude: state.center.latitude,
        longitude: state.center.longitude,
        latitudeDelta: 1.0,
        longitudeDelta: 1.0
      }, 1000);
    }
  };

  const getPolygonFillColor = (state) => {
    const opacity = 0.6;

    // Ensure we always have a valid color, with fallback hierarchy
    let color = RISK_COLORS.Low; // Default fallback

    if (state.riskData?.color) {
      color = state.riskData.color;
      console.log(`🎨 Map rendering ${state.name}: ${(state.riskData.floodProbability * 100).toFixed(0)}% risk, color: ${color}`);
    } else {
      console.warn(`⚠️ No riskData for ${state.name}, using fallback color: ${color}`);
      // Assign different colors for visual debugging
      const fallbackColors = {
        'Kedah': RISK_COLORS.Moderate,
        'Johor': RISK_COLORS.High,
        'Kuala Lumpur': RISK_COLORS['Very High'],
        'Selangor': RISK_COLORS.High
      };
      color = fallbackColors[state.name] || RISK_COLORS.Low;
      console.log(`🔧 Using fallback color for ${state.name}: ${color}`);
    }

    // Convert hex to rgba with error handling
    try {
      const hex = color.replace('#', '');
      if (hex.length !== 6) {
        throw new Error(`Invalid hex color: ${color}`);
      }

      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);

      const fillColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      console.log(`✅ Final fill color for ${state.name}: ${fillColor}`);
      return fillColor;
    } catch (error) {
      console.error(`❌ Color conversion error for ${state.name}:`, error);
      return `rgba(76, 175, 80, ${opacity})`; // Green fallback
    }
  };

  const getPolygonStrokeColor = (state) => {
    return state.riskData?.color || RISK_COLORS.Low;
  };

  const calculatePolygonBounds = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return null;

    const bounds = {
      minLat: Number.MAX_VALUE,
      maxLat: Number.MIN_VALUE,
      minLon: Number.MAX_VALUE,
      maxLon: Number.MIN_VALUE
    };

    coordinates.forEach(coord => {
      if (coord.latitude < bounds.minLat) bounds.minLat = coord.latitude;
      if (coord.latitude > bounds.maxLat) bounds.maxLat = coord.latitude;
      if (coord.longitude < bounds.minLon) bounds.minLon = coord.longitude;
      if (coord.longitude > bounds.maxLon) bounds.maxLon = coord.longitude;
    });

    return {
      ...bounds,
      center: {
        latitude: (bounds.minLat + bounds.maxLat) / 2,
        longitude: (bounds.minLon + bounds.maxLon) / 2
      },
      span: {
        latitudeDelta: bounds.maxLat - bounds.minLat,
        longitudeDelta: bounds.maxLon - bounds.minLon
      }
    };
  };

  const generateFallbackCoordinates = (state) => {
    // Generate a simple rectangular polygon around the state center as fallback
    if (!state.center || !state.center.latitude || !state.center.longitude) {
      return null;
    }

    const offset = 0.2; // degrees
    const { latitude, longitude } = state.center;

    return [
      { latitude: latitude - offset, longitude: longitude - offset },
      { latitude: latitude + offset, longitude: longitude - offset },
      { latitude: latitude + offset, longitude: longitude + offset },
      { latitude: latitude - offset, longitude: longitude + offset },
      { latitude: latitude - offset, longitude: longitude - offset }
    ];
  };

  const validateAndFormatCoordinates = (polygon, stateName, polygonIndex) => {
    console.log(`🔍 Processing coordinates for ${stateName} polygon ${polygonIndex}`);

    // The new AccurateGeoJSONProcessor returns coordinates directly as arrays of {latitude, longitude} objects
    let coordinates = polygon;

    // Basic validation
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
      console.warn(`⚠️ Invalid coordinates for ${stateName} polygon ${polygonIndex}: needs at least 3 points, got ${coordinates?.length || 0}`);
      return null;
    }

    // Validate each coordinate point with Malaysia-specific bounds
    const validCoordinates = coordinates.filter(coord => {
      if (!coord || typeof coord !== 'object') {
        return false;
      }
      if (typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') {
        return false;
      }
      if (isNaN(coord.latitude) || isNaN(coord.longitude)) {
        return false;
      }

      // Malaysia-specific bounds check (expanded to include East Malaysia)
      const isValidMalaysiaCoord = coord.latitude >= 0.5 && coord.latitude <= 7.5 &&
                                   coord.longitude >= 99.0 && coord.longitude <= 120.0;

      return isValidMalaysiaCoord;
    });

    if (validCoordinates.length < 3) {
      console.warn(`⚠️ Too few valid coordinates for ${stateName} polygon ${polygonIndex}: got ${validCoordinates.length}, need at least 3`);
      return null;
    }

    console.log(`✅ Successfully validated ${validCoordinates.length} coordinates for ${stateName} polygon ${polygonIndex}`);

    // Calculate and log polygon bounds for debugging
    const bounds = calculatePolygonBounds(validCoordinates);
    if (bounds) {
      console.log(`📏 ${stateName} polygon bounds:`, {
        center: `${bounds.center.latitude.toFixed(4)}, ${bounds.center.longitude.toFixed(4)}`,
        span: `${bounds.span.latitudeDelta.toFixed(4)} x ${bounds.span.longitudeDelta.toFixed(4)}`,
        range: `lat: ${bounds.minLat.toFixed(4)} to ${bounds.maxLat.toFixed(4)}, lon: ${bounds.minLon.toFixed(4)} to ${bounds.maxLon.toFixed(4)}`
      });
    }

    return validCoordinates;
  };

  const validateMapCoverage = () => {
    if (!statesData || !mapRegion) return;

    let overallBounds = {
      minLat: Number.MAX_VALUE,
      maxLat: Number.MIN_VALUE,
      minLon: Number.MAX_VALUE,
      maxLon: Number.MIN_VALUE
    };

    let validStatesCount = 0;

    statesData.forEach(state => {
      if (state.coordinates && Array.isArray(state.coordinates)) {
        state.coordinates.forEach(polygon => {
          const coordinates = validateAndFormatCoordinates(polygon, state.name, 0);
          if (coordinates) {
            coordinates.forEach(coord => {
              if (coord.latitude < overallBounds.minLat) overallBounds.minLat = coord.latitude;
              if (coord.latitude > overallBounds.maxLat) overallBounds.maxLat = coord.latitude;
              if (coord.longitude < overallBounds.minLon) overallBounds.minLon = coord.longitude;
              if (coord.longitude > overallBounds.maxLon) overallBounds.maxLon = coord.longitude;
            });
            validStatesCount++;
          }
        });
      }
    });

    const requiredRegion = {
      latitude: (overallBounds.minLat + overallBounds.maxLat) / 2,
      longitude: (overallBounds.minLon + overallBounds.maxLon) / 2,
      latitudeDelta: (overallBounds.maxLat - overallBounds.minLat) * 1.1, // 10% padding
      longitudeDelta: (overallBounds.maxLon - overallBounds.minLon) * 1.1
    };

    console.log(`🗺️ Map coverage analysis for ${validStatesCount} valid states:`);
    console.log(`📊 Current region:`, mapRegion);
    console.log(`📊 Required region:`, requiredRegion);
    console.log(`📊 All polygons bounds:`, {
      range: `lat: ${overallBounds.minLat.toFixed(4)} to ${overallBounds.maxLat.toFixed(4)}, lon: ${overallBounds.minLon.toFixed(4)} to ${overallBounds.maxLon.toFixed(4)}`
    });

    // Check if current region covers all polygons
    const regionCoverageOk = mapRegion.latitude - mapRegion.latitudeDelta/2 <= overallBounds.minLat &&
                            mapRegion.latitude + mapRegion.latitudeDelta/2 >= overallBounds.maxLat &&
                            mapRegion.longitude - mapRegion.longitudeDelta/2 <= overallBounds.minLon &&
                            mapRegion.longitude + mapRegion.longitudeDelta/2 >= overallBounds.maxLon;

    if (regionCoverageOk) {
      console.log(`✅ Map region properly covers all polygon boundaries`);
    } else {
      console.warn(`⚠️ Map region may not fully cover all polygon boundaries`);
    }
  };

  const renderStatePolygons = () => {
    console.log(`🗺️ Rendering polygons for ${statesData.length} states`);

    return statesData.map((state, index) => {
      console.log(`🏛️ Processing state: ${state.name}, coordinates available: ${!!state.coordinates}`);

      if (!state.coordinates || !Array.isArray(state.coordinates)) {
        console.warn(`⚠️ No coordinates data for state: ${state.name}, using fallback square`);

        // Use fallback coordinates as last resort
        const fallbackCoords = generateFallbackCoordinates(state);
        if (fallbackCoords) {
          console.log(`🟪 Using fallback 0.4° square for ${state.name}`);
          return (
            <Polygon
              key={`${state.id}_fallback`}
              coordinates={fallbackCoords}
              fillColor={getPolygonFillColor(state)}
              strokeColor={getPolygonStrokeColor(state)}
              strokeWidth={2}
              tappable={true}
              onPress={() => handleStatePress(state)}
            />
          );
        }
        return null;
      }

      console.log(`📐 State ${state.name} has ${state.coordinates.length} coordinate arrays`);

      // Handle multiple polygons per state (for islands, etc.)
      const polygons = state.coordinates.map((polygon, polygonIndex) => {
        console.log(`🔄 Processing polygon ${polygonIndex} for ${state.name}`);
        const coordinates = validateAndFormatCoordinates(polygon, state.name, polygonIndex);

        if (!coordinates) {
          console.warn(`❌ Failed to validate coordinates for ${state.name} polygon ${polygonIndex}`);
          return null;
        }

        console.log(`✅ Successfully created polygon for ${state.name} with ${coordinates.length} points`);

        // Get the colors for this polygon
        const fillColor = getPolygonFillColor(state);
        const strokeColor = getPolygonStrokeColor(state);

        console.log(`🖌️ Polygon ${polygonIndex} for ${state.name} - Fill: ${fillColor}, Stroke: ${strokeColor}`);

        return (
          <Polygon
            key={`${state.id}_${polygonIndex}`}
            coordinates={coordinates}
            fillColor={fillColor}
            strokeColor={strokeColor}
            strokeWidth={2}
            tappable={true}
            onPress={() => handleStatePress(state)}
          />
        );
      }).filter(polygon => polygon !== null); // Remove any null polygons

      // If no valid polygons, use fallback (should rarely happen now)
      if (polygons.length === 0) {
        console.warn(`⚠️ All polygons invalid for ${state.name}, using fallback square (this should be rare)`);
        const fallbackCoords = generateFallbackCoordinates(state);
        if (fallbackCoords) {
          console.log(`🟪 Final fallback square for ${state.name}`);
          return (
            <Polygon
              key={`${state.id}_fallback`}
              coordinates={fallbackCoords}
              fillColor={getPolygonFillColor(state)}
              strokeColor={getPolygonStrokeColor(state)}
              strokeWidth={2}
              tappable={true}
              onPress={() => handleStatePress(state)}
            />
          );
        }
      }

      console.log(`✅ State ${state.name} rendered ${polygons.length} valid polygons`);
      return polygons;
    }).filter(statePolygons => statePolygons !== null); // Remove any null state polygon sets
  };

  const renderStateMarkers = () => {
    return statesData.map((state) => (
      <Marker
        key={`marker_${state.id}`}
        coordinate={state.center}
        onPress={() => handleStatePress(state)}
      >
        <View style={[styles.markerContainer, { backgroundColor: state.riskData.color }]}>
          <Text style={styles.markerText}>
            {Math.round(state.riskData.floodProbability * 100)}%
          </Text>
        </View>
      </Marker>
    ));
  };

  const renderRiskLegend = () => (
    <View style={styles.legendContainer}>
      <Text style={styles.legendTitle}>Flood Risk Level</Text>

      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: RISK_COLORS.Low }]} />
        <Text style={styles.legendText}>Low (&lt;30%)</Text>
      </View>

      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: RISK_COLORS.Moderate }]} />
        <Text style={styles.legendText}>Moderate (30-60%)</Text>
      </View>

      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: RISK_COLORS.High }]} />
        <Text style={styles.legendText}>High (60-80%)</Text>
      </View>

      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: RISK_COLORS['Very High'] }]} />
        <Text style={styles.legendText}>Very High (&gt;80%)</Text>
      </View>
    </View>
  );

  const renderStateModal = () => {
    if (!selectedState) return null;

    const riskData = selectedState.riskData;

    return (
      <Modal
        visible={showStateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedState.name}</Text>
              <TouchableOpacity
                onPress={() => setShowStateModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.riskOverview}>
                <View style={styles.riskIndicator}>
                  <View
                    style={[styles.riskCircle, { backgroundColor: riskData.color }]}
                  />
                  <View>
                    <Text style={styles.riskLevel}>{riskData.riskLevel} Risk</Text>
                    <Text style={styles.riskProbability}>
                      {Math.round(riskData.floodProbability * 100)}% probability
                    </Text>
                  </View>
                </View>

                <Text style={styles.lastUpdated}>
                  Last updated: {new Date(riskData.lastUpdated).toLocaleTimeString()}
                </Text>
              </View>

              {riskData.weatherSummary && (
                <View style={styles.weatherSection}>
                  <Text style={styles.sectionTitle}>Current Conditions</Text>

                  <View style={styles.weatherGrid}>
                    <View style={styles.weatherItem}>
                      <Ionicons name="thermometer-outline" size={20} color={COLORS.PRIMARY} />
                      <Text style={styles.weatherValue}>{riskData.weatherSummary.temperature}°C</Text>
                      <Text style={styles.weatherLabel}>Temperature</Text>
                    </View>

                    <View style={styles.weatherItem}>
                      <Ionicons name="rainy-outline" size={20} color={COLORS.PRIMARY} />
                      <Text style={styles.weatherValue}>{riskData.weatherSummary.rainfall}mm</Text>
                      <Text style={styles.weatherLabel}>Rainfall</Text>
                    </View>

                    <View style={styles.weatherItem}>
                      <Ionicons name="water-outline" size={20} color={COLORS.PRIMARY} />
                      <Text style={styles.weatherValue}>{riskData.weatherSummary.humidity}%</Text>
                      <Text style={styles.weatherLabel}>Humidity</Text>
                    </View>

                    <View style={styles.weatherItem}>
                      <Ionicons name="speedometer-outline" size={20} color={COLORS.PRIMARY} />
                      <Text style={styles.weatherValue}>{riskData.weatherSummary.windSpeed}km/h</Text>
                      <Text style={styles.weatherLabel}>Wind</Text>
                    </View>
                  </View>
                </View>
              )}

              {riskData.factors && riskData.factors.length > 0 && (
                <View style={styles.factorsSection}>
                  <Text style={styles.sectionTitle}>Contributing Factors</Text>
                  {riskData.factors.slice(0, 3).map((factor, index) => (
                    <Text key={index} style={styles.factorText}>
                      • {typeof factor === 'string' ? factor : factor.feature?.description || 'Weather pattern detected'}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.locationInfo}>
                <Text style={styles.sectionTitle}>Location Details</Text>
                <Text style={styles.infoText}>Capital: {selectedState.capital}</Text>
                <Text style={styles.infoText}>State Code: {selectedState.stateCode}</Text>
                <Text style={styles.infoText}>
                  Coordinates: {selectedState.center.latitude.toFixed(4)}°, {selectedState.center.longitude.toFixed(4)}°
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Loading flood risk map...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <Ionicons name="warning-outline" size={48} color={COLORS.ERROR} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMapData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!mapRegion) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <Text style={styles.errorText}>Map region not available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>Malaysia Flood Risk Map</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={refreshing}
          style={styles.refreshButton}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? COLORS.TEXT_SECONDARY : COLORS.PRIMARY}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
        >
          {renderStatePolygons()}
          {renderStateMarkers()}
        </MapView>

        {renderRiskLegend()}
      </View>

      {renderStateModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.SURFACE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0'
  },
  mapContainer: {
    flex: 1,
    position: 'relative'
  },
  map: {
    flex: 1
  },
  legendContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8
  },
  legendText: {
    fontSize: 10,
    color: COLORS.TEXT_SECONDARY
  },
  markerContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF'
  },
  markerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center'
  },
  errorText: {
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryButtonText: {
    color: COLORS.TEXT_ON_PRIMARY,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: COLORS.SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
    paddingBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY
  },
  closeButton: {
    padding: 4
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20
  },
  riskOverview: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  riskIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  riskCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12
  },
  riskLevel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY
  },
  riskProbability: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic'
  },
  weatherSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  weatherItem: {
    alignItems: 'center',
    width: '23%',
    marginBottom: 12
  },
  weatherValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 4
  },
  weatherLabel: {
    fontSize: 10,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
    textAlign: 'center'
  },
  factorsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  factorText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
    lineHeight: 16
  },
  locationInfo: {
    paddingTop: 16
  },
  infoText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4
  }
});