/**
 * FloodHotspotsCSV.js - SVG-based flood visualization using real 2025 flood data
 * Shows actual flood events as interactive points on Malaysia outline
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import Svg, { Polygon, Circle, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import FloodDataCSV from '../services/FloodDataCSV';

const { width, height } = Dimensions.get('window');

export default function FloodHotspotsCSV({ navigation }) {
  const [floodEvents, setFloodEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'selangor', 'recent'

  useEffect(() => {
    loadFloodData();
  }, []);

  const loadFloodData = async () => {
    try {
      setLoading(true);
      const events = await FloodDataCSV.loadFloodData();
      const stats = await FloodDataCSV.getFloodStatistics();
      
      setFloodEvents(events);
      setStatistics(stats);
      console.log(`📊 Loaded ${events.length} flood events for visualization`);
    } catch (error) {
      console.error('Error loading flood data:', error);
      Alert.alert('Data Error', 'Unable to load flood event data');
    } finally {
      setLoading(false);
    }
  };

  // Malaysia coordinate bounds for SVG conversion
  const MALAYSIA_BOUNDS = {
    minLat: 0.8,    // Southern tip
    maxLat: 7.5,    // Northern tip
    minLng: 99.5,   // Western edge
    maxLng: 119.5   // Eastern edge (Sabah)
  };

  const SVG_DIMENSIONS = {
    width: width - 40,
    height: 300
  };

  /**
   * Convert latitude/longitude to SVG coordinates
   */
  const coordToSVG = (lat, lng) => {
    const x = ((lng - MALAYSIA_BOUNDS.minLng) / (MALAYSIA_BOUNDS.maxLng - MALAYSIA_BOUNDS.minLng)) * SVG_DIMENSIONS.width;
    const y = ((MALAYSIA_BOUNDS.maxLat - lat) / (MALAYSIA_BOUNDS.maxLat - MALAYSIA_BOUNDS.minLat)) * SVG_DIMENSIONS.height;
    return { x, y };
  };

  /**
   * Get color based on flood severity and recency
   */
  const getFloodColor = (event) => {
    // Recent floods (last 30 days) in red spectrum
    if (event.daysSince <= 30) {
      switch (event.severity) {
        case 5: return '#D32F2F'; // Dark red - very severe recent
        case 4: return '#F44336'; // Red - severe recent  
        case 3: return '#FF5722'; // Red-orange - moderate recent
        default: return '#FF7043'; // Light red-orange - minor recent
      }
    }
    // Older floods in orange-yellow spectrum
    else if (event.daysSince <= 90) {
      switch (event.severity) {
        case 5: return '#FF9800'; // Dark orange
        case 4: return '#FFA726'; // Orange
        case 3: return '#FFB74D'; // Light orange
        default: return '#FFCC02'; // Yellow-orange
      }
    }
    // Very old floods in yellow spectrum
    else {
      switch (event.severity) {
        case 5: return '#FBC02D'; // Dark yellow
        case 4: return '#FFEB3B'; // Yellow
        default: return '#FFF176'; // Light yellow
      }
    }
  };

  /**
   * Get flood point size based on severity
   */
  const getFloodSize = (severity) => {
    return Math.max(3, severity + 2); // Size 5-7 pixels
  };

  /**
   * Filter events based on view mode
   */
  const getFilteredEvents = () => {
    switch (viewMode) {
      case 'selangor':
        return floodEvents.filter(event => event.state === 'Selangor');
      case 'recent':
        return floodEvents.filter(event => event.daysSince <= 30);
      case 'severe':
        return floodEvents.filter(event => event.severity >= 4);
      default:
        return floodEvents;
    }
  };

  /**
   * Handle flood point tap
   */
  const handleFloodTap = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  /**
   * Simplified Malaysia outline (key points only for performance)
   */
  const getMalaysiaOutline = () => {
    // Simplified Malaysia boundary points
    const boundaryPoints = [
      [99.5, 6.5], [100.5, 6.8], [101.5, 6.5], [102.5, 6.2], [103.5, 5.8],
      [104.2, 4.5], [103.8, 3.5], [103.5, 2.8], [104.0, 2.0], [103.8, 1.5],
      [103.0, 1.2], [102.0, 1.8], [101.5, 2.5], [100.8, 3.2], [100.2, 4.0],
      [99.8, 5.0], [99.5, 6.0]
    ];

    // Add East Malaysia (simplified)
    const eastMalaysia = [
      [109.5, 4.5], [110.5, 5.0], [112.0, 4.8], [114.0, 5.2], [116.0, 6.0],
      [118.0, 5.5], [119.0, 4.8], [118.5, 4.0], [117.0, 3.5], [115.0, 3.8],
      [113.0, 4.2], [111.0, 4.0], [109.5, 4.2]
    ];

    const convertToSVG = (points) => 
      points.map(([lng, lat]) => {
        const svg = coordToSVG(lat, lng);
        return `${svg.x},${svg.y}`;
      }).join(' ');

    return {
      peninsular: convertToSVG(boundaryPoints),
      eastMalaysia: convertToSVG(eastMalaysia)
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading flood event data...</Text>
      </View>
    );
  }

  const filteredEvents = getFilteredEvents();
  const outline = getMalaysiaOutline();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Malaysia Flood Events 2025</Text>
        <Text style={styles.subtitle}>
          {filteredEvents.length} events • Real data from government sources
        </Text>
      </View>

      {/* View Mode Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {[
          { key: 'all', label: 'All Events', count: floodEvents.length },
          { key: 'recent', label: 'Recent (30d)', count: floodEvents.filter(e => e.daysSince <= 30).length },
          { key: 'selangor', label: 'Selangor', count: floodEvents.filter(e => e.state === 'Selangor').length },
          { key: 'severe', label: 'Severe', count: floodEvents.filter(e => e.severity >= 4).length }
        ].map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterButton, viewMode === filter.key && styles.activeFilterButton]}
            onPress={() => setViewMode(filter.key)}
          >
            <Text style={[styles.filterText, viewMode === filter.key && styles.activeFilterText]}>
              {filter.label} ({filter.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* SVG Map */}
      <View style={styles.mapContainer}>
        <Svg width={SVG_DIMENSIONS.width} height={SVG_DIMENSIONS.height} viewBox={`0 0 ${SVG_DIMENSIONS.width} ${SVG_DIMENSIONS.height}`}>
          {/* Malaysia outline */}
          <Polygon
            points={outline.peninsular}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="2"
          />
          <Polygon
            points={outline.eastMalaysia}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="2"
          />

          {/* Flood event points */}
          {filteredEvents.map((event, index) => {
            const svgPos = coordToSVG(event.latitude, event.longitude);
            return (
              <Circle
                key={`flood-${event.id}-${index}`}
                cx={svgPos.x}
                cy={svgPos.y}
                r={getFloodSize(event.severity)}
                fill={getFloodColor(event)}
                stroke="#fff"
                strokeWidth="1"
                opacity="0.8"
                onPress={() => handleFloodTap(event)}
              />
            );
          })}

          {/* Alice's Petaling area highlight (if showing Selangor) */}
          {viewMode === 'selangor' && (
            <G>
              <Circle
                cx={coordToSVG(3.1073, 101.5951).x}
                cy={coordToSVG(3.1073, 101.5951).y}
                r="15"
                fill="none"
                stroke="#2196F3"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
              />
              <SvgText
                x={coordToSVG(3.1073, 101.5951).x}
                y={coordToSVG(3.1073, 101.5951).y - 20}
                fontSize="10"
                fill="#2196F3"
                textAnchor="middle"
              >
                Alice's Area
              </SvgText>
            </G>
          )}
        </Svg>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#D32F2F' }]} />
            <Text style={styles.legendText}>Recent & Severe</Text>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>Moderate</Text>
            <View style={[styles.legendDot, { backgroundColor: '#FFEB3B' }]} />
            <Text style={styles.legendText}>Minor/Old</Text>
          </View>
        </View>
      </View>

      {/* Statistics Panel */}
      {statistics && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{statistics.totalEvents}</Text>
              <Text style={styles.statLabel}>Total Events</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{statistics.recentEvents}</Text>
              <Text style={styles.statLabel}>Recent (30d)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{statistics.highestRiskState}</Text>
              <Text style={styles.statLabel}>Highest Risk</Text>
            </View>
          </View>
        </View>
      )}

      {/* Flood Event Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEvent && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedEvent.district}, {selectedEvent.state}
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.eventDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>
                      {selectedEvent.date.toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Days Ago:</Text>
                    <Text style={styles.detailValue}>{selectedEvent.daysSince} days</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Severity:</Text>
                    <View style={styles.severityIndicator}>
                      {[1,2,3,4,5].map(i => (
                        <View 
                          key={i}
                          style={[
                            styles.severityDot,
                            { backgroundColor: i <= selectedEvent.severity ? '#F44336' : '#e0e0e0' }
                          ]} 
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>River Basin:</Text>
                    <Text style={styles.detailValue}>
                      {selectedEvent.riverBasin || 'Not specified'}
                    </Text>
                  </View>

                  <View style={styles.detailColumn}>
                    <Text style={styles.detailLabel}>Flood Causes:</Text>
                    {selectedEvent.causes.map((cause, index) => (
                      <Text key={index} style={styles.causeText}>• {cause}</Text>
                    ))}
                  </View>

                  <View style={styles.coordinatesRow}>
                    <Text style={styles.coordinatesText}>
                      📍 {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  legend: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
  },
  statsContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    maxHeight: '80%',
    minWidth: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  eventDetails: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailColumn: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  severityIndicator: {
    flexDirection: 'row',
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 3,
  },
  causeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    marginBottom: 2,
  },
  coordinatesRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});