/**
 * FloodHotspotsCSV.js - Modern flood visualization with Google Maps
 * Features dual-filter system, state selection, and clean Material Design 3 interface
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import FloodDataCSV from '../services/FloodDataCSV';
import { MALAYSIA_CENTER, getFloodDensityColor, getMarkerSize } from '../utils/MalaysianStates';
import { getStateAbbreviation } from '../utils/FilterHelpers';

// Import new components
import StateSelector from '../components/StateSelector';
import QuickStats from '../components/QuickStats';

const { width, height } = Dimensions.get('window');

export default function FloodHotspotsCSV({ navigation }) {
  // Data state
  const [allFloodStates, setAllFloodStates] = useState([]);
  const [availableStateNames, setAvailableStateNames] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [maxEventCount, setMaxEventCount] = useState(1);

  // State selection for basic filtering
  const [selectedStates, setSelectedStates] = useState([]);

  useEffect(() => {
    loadFloodData();
  }, []);

  const loadFloodData = async () => {
    try {
      setLoading(true);
      const states = await FloodDataCSV.loadFloodData();
      const stats = await FloodDataCSV.getFloodStatistics();
      
      setAllFloodStates(states);
      setStatistics(stats);
      
      // Extract available state names for search functionality
      const stateNames = states.map(state => state.state).sort();
      setAvailableStateNames(stateNames);
      
      // Calculate max event count for scaling
      if (states.length > 0) {
        const maxCount = Math.max(...states.map(state => state.totalEvents));
        setMaxEventCount(maxCount);
      }
      
      console.log(`📊 Loaded ${states.length} state flood aggregations for visualization`);
      console.log(`🔍 Available states for search: ${stateNames.join(', ')}`);
    } catch (error) {
      console.error('Error loading flood data:', error);
      Alert.alert('Data Error', 'Unable to load flood event data');
    } finally {
      setLoading(false);
    }
  };

  // Simple state filtering - show all states or filter by selected states
  const filteredStates = useMemo(() => {
    if (selectedStates.length === 0) {
      return allFloodStates; // Show all states when none selected
    }
    return allFloodStates.filter(state => selectedStates.includes(state.state));
  }, [allFloodStates, selectedStates]);

  // State selection handler
  const handleStateSelectionChange = (states) => {
    setSelectedStates(states);
  };


  /**
   * Handle state marker tap
   */
  const handleStateTap = (state) => {
    setSelectedState(state);
    setShowModal(true);
  };

  /**
   * Get marker color based on flood count and recency
   */
  const getMarkerColor = (state) => {
    if (state.recentEvents > 0) {
      // Recent flood activity - red spectrum
      return getFloodDensityColor(state.totalEvents, maxEventCount);
    } else {
      // Historical data only - blue spectrum
      const intensity = state.totalEvents / maxEventCount;
      if (intensity > 0.8) return '#1565C0'; // Dark blue
      if (intensity > 0.6) return '#1976D2'; // Blue
      if (intensity > 0.4) return '#2196F3'; // Light blue
      if (intensity > 0.2) return '#42A5F5'; // Lighter blue
      return '#90CAF9'; // Very light blue
    }
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1976D2" />
        <Text style={styles.loadingText}>Loading flood data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976D2" />
      
      {/* Modern Header */}
      <View style={styles.modernHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Malaysia Flood Hotspots</Text>
          <Text style={styles.headerSubtitle}>Historical Analysis (2000-2025)</Text>
        </View>
      </View>

      {/* Full Screen Map Container with Floating Overlays */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: MALAYSIA_CENTER.latitude,
            longitude: MALAYSIA_CENTER.longitude,
            latitudeDelta: 8.0,
            longitudeDelta: 20.0,
          }}
          mapType="terrain"
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
        >
          {filteredStates.map((state) => (
            <Marker
              key={state.id}
              coordinate={{
                latitude: state.latitude,
                longitude: state.longitude,
              }}
              onPress={() => handleStateTap(state)}
              style={styles.markerContainer}
            >
              <View style={[
                styles.customMarker,
                { 
                  backgroundColor: getMarkerColor(state),
                  width: getMarkerSize(state.totalEvents, maxEventCount),
                  height: getMarkerSize(state.totalEvents, maxEventCount)
                }
              ]}>
                <Text style={[
                  styles.markerText,
                  { fontSize: getMarkerSize(state.totalEvents, maxEventCount) > 30 ? 10 : 8 }
                ]}>
                  {getStateAbbreviation(state.state)}
                </Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Floating Search Bar */}
        <View style={styles.floatingSearchContainer}>
          <StateSelector
            selectedStates={selectedStates}
            onSelectionChange={handleStateSelectionChange}
            availableStates={availableStateNames}
            style={styles.floatingStateSelector}
            placeholder={`Search from ${availableStateNames.length} states with flood data...`}
          />
        </View>

        {/* Floating Statistics */}
        <View style={styles.floatingStatsContainer}>
          <QuickStats
            statistics={statistics}
            filteredCount={filteredStates.length}
            totalCount={allFloodStates.length}
            style={styles.floatingStats}
            isCollapsible={true}
          />
        </View>

      </View>


      {/* State Flood Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedState && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedState.state} Flood History
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.eventDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Flood Events:</Text>
                    <Text style={styles.detailValue}>{selectedState.totalEvents}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Recent Activity (1yr):</Text>
                    <Text style={styles.detailValue}>{selectedState.recentEvents || 0} events</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Risk Level:</Text>
                    <View style={styles.severityIndicator}>
                      {[1,2,3,4,5].map(i => (
                        <View 
                          key={i}
                          style={[
                            styles.severityDot,
                            { backgroundColor: i <= selectedState.severity ? '#F44336' : '#e0e0e0' }
                          ]} 
                        />
                      ))}
                      <Text style={styles.severityText}>
                        {selectedState.severity === 5 ? 'Very High' :
                         selectedState.severity === 4 ? 'High' :
                         selectedState.severity === 3 ? 'Moderate' :
                         selectedState.severity === 2 ? 'Low' : 'Very Low'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Days Since Last Flood:</Text>
                    <Text style={styles.detailValue}>
                      {selectedState.daysSince ? `${selectedState.daysSince} days` : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailColumn}>
                    <Text style={styles.detailLabel}>Yearly Breakdown:</Text>
                    {selectedState.yearlyEvents && Object.entries(selectedState.yearlyEvents)
                      .sort((a, b) => b[0] - a[0])
                      .slice(0, 5)
                      .map(([year, count]) => (
                        <Text key={year} style={styles.causeText}>
                          • {year}: {count} events
                        </Text>
                      ))}
                  </View>

                  <View style={styles.coordinatesRow}>
                    <Text style={styles.coordinatesText}>
                      📍 {selectedState.latitude.toFixed(4)}, {selectedState.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
  },

  // Modern Header
  modernHeader: {
    backgroundColor: '#1976D2',
    paddingTop: 44, // Status bar height
    paddingBottom: 12,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },

  // Enhanced Map - Full Screen
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    minHeight: 400,
  },

  // Floating Search Bar
  floatingSearchContainer: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  floatingStateSelector: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  // Floating Statistics
  floatingStatsContainer: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 999,
  },
  floatingStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    minWidth: 140,
    maxWidth: 180,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  
  // Enhanced Markers
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMarker: {
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  markerText: {
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },



  // State Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    maxHeight: '80%',
    minWidth: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  eventDetails: {
    padding: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailColumn: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  severityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  severityText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
    fontWeight: '500',
  },
  causeText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 20,
  },
  coordinatesRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});