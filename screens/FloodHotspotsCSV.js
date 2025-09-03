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

import EnhancedFloodDataService from '../services/EnhancedFloodDataService';
import { MALAYSIA_CENTER, getFloodDensityColor, getMarkerSize } from '../utils/MalaysianStates';
import { getStateAbbreviation } from '../utils/FilterHelpers';

// Import new components
import AreaSearchSelector from '../components/AreaSearchSelector';
import QuickStats from '../components/QuickStats';

const { width, height } = Dimensions.get('window');

export default function FloodHotspotsCSV({ navigation }) {
  // Enhanced data state
  const [allFloodStates, setAllFloodStates] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedStateData, setSelectedStateData] = useState(null);
  const [areaSummary, setAreaSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [maxEventCount, setMaxEventCount] = useState(1);

  useEffect(() => {
    loadFloodData();
  }, []);

  const loadFloodData = async () => {
    try {
      setLoading(true);
      const data = await EnhancedFloodDataService.loadAllFloodData();
      const stats = await EnhancedFloodDataService.getFloodStatistics();
      
      setAllFloodStates(data.aggregated);
      setStatistics(stats);
      
      // Calculate max event count for scaling
      if (data.aggregated.length > 0) {
        const maxCount = Math.max(...data.aggregated.map(state => state.totalEvents));
        setMaxEventCount(maxCount);
      }
      
      console.log(`📊 Loaded ${data.aggregated.length} state aggregations and ${data.detailed.length} detailed events`);
      console.log(`🔍 Search index: ${data.searchIndex.districts.length} districts, ${data.searchIndex.states.length} states`);
    } catch (error) {
      console.error('Error loading enhanced flood data:', error);
      Alert.alert('Data Error', 'Unable to load flood event data');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced filtering based on selected area
  const filteredStates = useMemo(() => {
    if (!selectedArea) {
      return allFloodStates; // Show all states when no area selected
    }
    
    if (selectedArea.type === 'state') {
      return allFloodStates.filter(state => state.state === selectedArea.name);
    } else {
      // For districts, show the state containing that district
      return allFloodStates.filter(state => state.state === selectedArea.state);
    }
  }, [allFloodStates, selectedArea]);

  // Area selection handler
  const handleAreaSelection = async (area) => {
    setSelectedArea(area);
    
    if (area) {
      try {
        const summary = await EnhancedFloodDataService.getAreaSummary(area.name, area.type);
        setAreaSummary(summary);
      } catch (error) {
        console.error('Error loading area summary:', error);
      }
    } else {
      setAreaSummary(null);
    }
  };


  /**
   * Handle state marker tap - load detailed events for the state
   */
  const handleStateTap = async (state) => {
    setSelectedStateData(state);
    
    // Load detailed events for this state
    try {
      const summary = await EnhancedFloodDataService.getAreaSummary(state.state, 'state');
      setAreaSummary(summary);
    } catch (error) {
      console.error('Error loading state details:', error);
    }
    
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

        {/* Enhanced Floating Search Bar */}
        <View style={styles.floatingSearchContainer}>
          <AreaSearchSelector
            selectedArea={selectedArea}
            onAreaSelected={handleAreaSelection}
            style={styles.floatingAreaSelector}
            placeholder="Search districts or states with flood data..."
          />
        </View>

        {/* Enhanced Floating Statistics */}
        <View style={styles.floatingStatsContainer}>
          <QuickStats
            statistics={statistics}
            filteredCount={filteredStates.length}
            totalCount={allFloodStates.length}
            selectedArea={selectedArea}
            areaSummary={areaSummary}
            style={styles.floatingStats}
            isCollapsible={true}
          />
        </View>

      </View>


      {/* Enhanced Flood Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedStateData && areaSummary && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedStateData.state} Flood Events
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                  {/* Summary Section */}
                  <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryCard}>
                        <Text style={styles.summaryNumber}>{areaSummary.totalEvents}</Text>
                        <Text style={styles.summaryLabel}>Total Events</Text>
                      </View>
                      <View style={styles.summaryCard}>
                        <Text style={styles.summaryNumber}>{areaSummary.recentEvents}</Text>
                        <Text style={styles.summaryLabel}>Recent (1yr)</Text>
                      </View>
                    </View>

                    {areaSummary.mostRecentEvent && (
                      <View style={styles.recentEventCard}>
                        <Text style={styles.recentEventTitle}>Most Recent Event</Text>
                        <Text style={styles.recentEventDate}>
                          📅 {areaSummary.mostRecentEvent.date}
                        </Text>
                        <Text style={styles.recentEventLocation}>
                          📍 {areaSummary.mostRecentEvent.district}, {areaSummary.mostRecentEvent.state}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Top Causes Section */}
                  {areaSummary.topCauses.length > 0 && (
                    <View style={styles.causesSection}>
                      <Text style={styles.sectionTitle}>Main Flood Causes</Text>
                      {areaSummary.topCauses.map((item, index) => (
                        <View key={index} style={styles.causeItem}>
                          <Text style={styles.causeName}>{item.cause}</Text>
                          <Text style={styles.causeCount}>{item.count} events</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* River Basins Section */}
                  {areaSummary.riverBasins.length > 0 && (
                    <View style={styles.riverBasinsSection}>
                      <Text style={styles.sectionTitle}>Main River Basins</Text>
                      {areaSummary.riverBasins.slice(0, 5).map((basin, index) => (
                        <Text key={index} style={styles.riverBasinItem}>
                          🌊 {basin}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Recent Events List */}
                  {areaSummary.events && areaSummary.events.length > 0 && (
                    <View style={styles.eventsSection}>
                      <Text style={styles.sectionTitle}>
                        Recent Flood Events ({areaSummary.events.length})
                      </Text>
                      {areaSummary.events.map((event, index) => (
                        <View key={event.id || index} style={styles.eventCard}>
                          <View style={styles.eventHeader}>
                            <Text style={styles.eventDate}>{event.date}</Text>
                            <Text style={styles.eventLocation}>{event.district}</Text>
                          </View>
                          <Text style={styles.eventCause}>{event.floodCause}</Text>
                          {event.riverBasin && (
                            <Text style={styles.eventRiverBasin}>
                              🌊 {event.riverBasin}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
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
  floatingAreaSelector: {
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



  // Enhanced Detail Modal
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
    maxHeight: '85%',
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

  // Enhanced Modal Styles
  modalScrollView: {
    maxHeight: 600,
  },
  
  // Summary Section
  summarySection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976D2',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  recentEventCard: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  recentEventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  recentEventDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  recentEventLocation: {
    fontSize: 12,
    color: '#666',
  },
  
  // Causes Section
  causesSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  causeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  causeName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  causeCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1976D2',
  },
  
  // River Basins Section
  riverBasinsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  riverBasinItem: {
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
  },
  
  // Events Section
  eventsSection: {
    padding: 20,
  },
  eventCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  eventLocation: {
    fontSize: 12,
    color: '#666',
  },
  eventCause: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  eventRiverBasin: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
});