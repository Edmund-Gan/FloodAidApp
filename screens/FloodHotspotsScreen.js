/**
 * FloodHotspotsScreen.js - Epic 3: Flood Hotspot Maps
 * 
 * Provides district-level historical flood visualizations for Malaysian communities.
 * Features:
 * - District search functionality (User Story 3.1)
 * - Interactive heatmap with color-coded districts (User Story 3.2)
 * - Historical flood data visualization
 * - Alice Chen persona integration
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polygon, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Import our data processing utilities
import {
  searchDistricts,
  getAllDistrictsOrderedByRisk,
  getDistrictFloodHistory,
  getAliceAreaFloodIntelligence,
  getFloodStatsSummary,
  getDistrictsByRiskLevel,
  RISK_COLORS
} from '../utils/districtDataProcessor';

// Import GeoJSON utilities
import {
  getDistrictPolygons,
  getDistrictPolygon,
  getPolygonsByRiskLevel,
  getPolygonStatsSummary
} from '../utils/geoJsonLoader';

const { width, height } = Dimensions.get('window');

export default function FloodHotspotsScreen() {
  // State management
  const [mapRegion, setMapRegion] = useState({
    latitude: 4.2105, // Center of Malaysia
    longitude: 101.9758, // Adjust to better center on Peninsular Malaysia
    latitudeDelta: 3.5, // Smaller delta for better initial zoom
    longitudeDelta: 3.5, // Smaller delta for better initial zoom
  });
  
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAliceModal, setShowAliceModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('All');
  const [districtPolygons, setDistrictPolygons] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on component mount
  useEffect(() => {
    loadDistrictData();
  }, []);

  const loadDistrictData = () => {
    try {
      setIsLoading(true);
      
      // Load polygon data from GeoJSON
      const polygons = getDistrictPolygons();
      
      if (polygons.length === 0) {
        console.warn('⚠️ No polygon data loaded');
        Alert.alert(
          'Warning', 
          'No district boundary data could be loaded. The map will not show district polygons.',
          [{ text: 'OK', onPress: () => setIsLoading(false) }]
        );
        return;
      }
      
      const summaryStats = getPolygonStatsSummary();
      
      setDistrictPolygons(polygons);
      setStats(summaryStats);
      
      console.log('🗺️ FloodHotspotsScreen: Loaded', polygons.length, 'district polygons');
      console.log('📊 Districts with flood data:', summaryStats.districtsWithFloodData);
      console.log('📊 High risk districts:', summaryStats.highRiskDistricts);
      console.log('🎯 Expected behavior: Map should show Google Maps with a blue test marker and', polygons.length, 'colored district polygons');
      
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error loading district polygon data:', error.message);
      Alert.alert(
        'Error', 
        'Failed to load district polygon data: ' + error.message,
        [{ text: 'OK', onPress: () => setIsLoading(false) }]
      );
      setIsLoading(false);
    }
  };

  // Handle district search - search both flood data and polygon data
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      // Search through flood statistics data
      const floodDataResults = searchDistricts(query);
      
      // Also search through polygon data for districts not in flood statistics
      const searchTerm = query.toLowerCase();
      const polygonResults = (districtPolygons || [])
        .filter(polygon => {
          // Skip if already in flood data results
          if (floodDataResults.some(result => result.key === polygon.name)) {
            return false;
          }
          
          // Search by district name or state
          return polygon.name && polygon.name.toLowerCase().includes(searchTerm) ||
                 (polygon.state && polygon.state.toLowerCase().includes(searchTerm)) ||
                 `${polygon.name || ''} ${polygon.state || ''}`.toLowerCase().includes(searchTerm);
        })
        .map(polygon => ({
          key: polygon.name,
          displayName: polygon.floodData ? polygon.floodData.displayName : `${polygon.name}, ${polygon.state}`,
          state: polygon.state,
          totalEvents: polygon.floodData ? polygon.floodData.totalEvents : 0,
          riskLevel: polygon.riskLevel,
          coordinates: polygon.floodData ? polygon.floodData.coordinates : [
            polygon.coordinates[0]?.latitude || 4.2,
            polygon.coordinates[0]?.longitude || 108.9
          ],
          ...polygon.floodData
        }))
        .slice(0, 5); // Limit polygon results
      
      // Combine results, prioritizing flood data
      const combinedResults = [...floodDataResults, ...polygonResults];
      setSearchResults(combinedResults);
    } else {
      setSearchResults([]);
    }
  };

  // Handle district selection from search
  const handleDistrictSelect = (district) => {
    setSelectedDistrict(district);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchModal(false);
    
    // Focus map on selected district
    setMapRegion({
      latitude: district.coordinates[0],
      longitude: district.coordinates[1],
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    });
    
    // Show details modal
    setTimeout(() => {
      setShowDetailsModal(true);
    }, 500);
  };

  // Filter district polygons by risk level
  const getFilteredPolygons = () => {
    if (!districtPolygons || districtPolygons.length === 0) {
      return [];
    }
    
    if (selectedRiskFilter === 'All') {
      return districtPolygons;
    }
    return districtPolygons.filter(polygon => polygon.riskLevel === selectedRiskFilter);
  };

  // Handle district polygon press
  const handlePolygonPress = (polygon) => {
    // Convert polygon data format to match expected district format
    const districtData = polygon.floodData ? {
      key: polygon.name,
      ...polygon.floodData,
      coordinates: polygon.floodData.coordinates, // Use flood data coordinates for centering
    } : {
      key: polygon.name,
      displayName: polygon.name + ', ' + polygon.state,
      state: polygon.state,
      totalEvents: 0,
      riskLevel: 'NoData',
      coordinates: [polygon.coordinates[0]?.latitude || 4.2, polygon.coordinates[0]?.longitude || 108.9]
    };
    
    setSelectedDistrict(districtData);
    setShowDetailsModal(true);
  };

  // Render search modal
  const renderSearchModal = () => (
    <Modal
      visible={showSearchModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.searchModalContent}>
          <View style={styles.searchModalHeader}>
            <Text style={styles.searchModalTitle}>Search Districts</Text>
            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Search Input */}
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for district (e.g., Sibu, Kuala Lumpur)"
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus={true}
            />
          </View>
          
          {/* Search Results */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.key}
            style={styles.searchResults}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.searchResultItem}
                onPress={() => handleDistrictSelect(item)}
              >
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName}>{item.displayName}</Text>
                  <Text style={styles.searchResultStats}>
                    {item.totalEvents} flood events • {item.riskLevel} risk
                  </Text>
                </View>
                <View style={[styles.riskIndicator, { 
                  backgroundColor: RISK_COLORS[item.riskLevel] 
                }]} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              searchQuery.length >= 2 ? (
                <View style={styles.noResults}>
                  <Ionicons name="search-outline" size={48} color="#ccc" />
                  <Text style={styles.noResultsText}>
                    No flood records found for "{searchQuery}"
                  </Text>
                  <Text style={styles.noResultsSubtext}>
                    Try searching for a different district name
                  </Text>
                </View>
              ) : null
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Render district details modal
  const renderDetailsModal = () => (
    <Modal
      visible={showDetailsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>District Flood History</Text>
          <View style={{ width: 24 }} />
        </View>

        {selectedDistrict && (
          <ScrollView style={styles.modalContent}>
            {/* District Header */}
            <View style={styles.districtHeader}>
              <View style={styles.districtTitleRow}>
                <Text style={styles.districtName}>{selectedDistrict.displayName}</Text>
                <View style={[styles.riskBadge, { 
                  backgroundColor: RISK_COLORS[selectedDistrict.riskLevel] 
                }]}>
                  <Text style={styles.riskBadgeText}>{selectedDistrict.riskLevel} Risk</Text>
                </View>
              </View>
              <Text style={styles.districtStats}>
                {selectedDistrict.totalEvents} flood events recorded
              </Text>
              {selectedDistrict.isAliceLocation && (
                <View style={styles.aliceLocationBadge}>
                  <Ionicons name="home" size={16} color="#2196F3" />
                  <Text style={styles.aliceLocationText}>Your area (Alice Chen)</Text>
                </View>
              )}
            </View>

            {/* Flood Statistics */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Flood Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{selectedDistrict.totalEvents}</Text>
                  <Text style={styles.statLabel}>Total Events</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{selectedDistrict.riskLevel}</Text>
                  <Text style={styles.statLabel}>Risk Level</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>2025</Text>
                  <Text style={styles.statLabel}>Last Flood</Text>
                </View>
              </View>
            </View>

            {/* Flood Causes */}
            <View style={styles.causesSection}>
              <Text style={styles.sectionTitle}>Main Flood Causes</Text>
              {selectedDistrict.floodCauses.map((cause, index) => (
                <View key={index} style={styles.causeItem}>
                  <Ionicons name="warning-outline" size={20} color="#FF9800" />
                  <Text style={styles.causeText}>{cause}</Text>
                </View>
              ))}
            </View>

            {/* River Basins */}
            {selectedDistrict.riverBasins.length > 0 && (
              <View style={styles.riversSection}>
                <Text style={styles.sectionTitle}>Affected River Basins</Text>
                {selectedDistrict.riverBasins.map((river, index) => (
                  <View key={index} style={styles.riverItem}>
                    <Ionicons name="water-outline" size={20} color="#2196F3" />
                    <Text style={styles.riverText}>{river}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Alice Chen Insights */}
            {selectedDistrict.isAliceLocation && (
              <View style={styles.aliceSection}>
                <Text style={styles.sectionTitle}>Family Safety Insights</Text>
                <View style={styles.aliceInsight}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.aliceInsightText}>
                    Good choice! Your Puchong area has relatively low flood risk
                  </Text>
                </View>
                <View style={styles.aliceInsight}>
                  <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
                  <Text style={styles.aliceInsightText}>
                    Monitor drainage during heavy rain in monsoon season
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  // Render Alice Chen modal
  const renderAliceModal = () => {
    const aliceData = getAliceAreaFloodIntelligence();
    
    return (
      <Modal
        visible={showAliceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAliceModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Your Area Analysis</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.aliceHeaderSection}>
              <View style={styles.aliceLocationHeader}>
                <Ionicons name="home" size={32} color="#2196F3" />
                <View style={styles.aliceLocationInfo}>
                  <Text style={styles.aliceLocationName}>{aliceData.userLocation}</Text>
                  <Text style={styles.aliceLocationSubtext}>Your current location</Text>
                </View>
              </View>
            </View>

            {/* Personal Insights */}
            <View style={styles.aliceInsightsSection}>
              <Text style={styles.sectionTitle}>Personal Flood Intelligence</Text>
              {aliceData.personalizedInsights.map((insight, index) => (
                <View key={index} style={styles.aliceInsightItem}>
                  <Text style={styles.aliceInsightText}>{insight}</Text>
                </View>
              ))}
            </View>

            {/* Comparison */}
            <View style={styles.aliceComparisonSection}>
              <Text style={styles.sectionTitle}>Comparison with High-Risk Areas</Text>
              {aliceData.comparisonWithWorstAreas.map((comparison, index) => (
                <View key={index} style={styles.comparisonItem}>
                  <Ionicons name="trending-down" size={16} color="#4CAF50" />
                  <Text style={styles.comparisonText}>{comparison}</Text>
                </View>
              ))}
            </View>

            {/* Recommendations */}
            <View style={styles.aliceRecommendationsSection}>
              <Text style={styles.sectionTitle}>Family Safety Recommendations</Text>
              {aliceData.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Ionicons name="bulb-outline" size={16} color="#FF9800" />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Flood Hotspots</Text>
          <Text style={styles.headerSubtitle}>Malaysian District Analysis</Text>
        </View>
        <View style={styles.headerButtons}>
          {/* Alice Chen Personal Analysis */}
          <TouchableOpacity 
            style={styles.aliceButton} 
            onPress={() => setShowAliceModal(true)}
          >
            <Ionicons name="person-outline" size={20} color="#2196F3" />
          </TouchableOpacity>
          
          {/* Search Button */}
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search-outline" size={20} color="#2196F3" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary */}
{isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading district boundaries...</Text>
        </View>
      ) : stats && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Malaysia Flood Risk Map</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatNumber}>{stats.districtsWithFloodData}</Text>
              <Text style={styles.summaryStatLabel}>Districts with Flood Data</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatNumber, { color: RISK_COLORS.High }]}>
                {stats.highRiskDistricts}
              </Text>
              <Text style={styles.summaryStatLabel}>High Risk</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatNumber, { color: RISK_COLORS.Medium }]}>
                {stats.mediumRiskDistricts}
              </Text>
              <Text style={styles.summaryStatLabel}>Medium Risk</Text>
            </View>
          </View>
          <Text style={styles.summaryFooter}>
            {stats.totalDistricts} total districts mapped • {stats.noDataDistricts} with no flood data
          </Text>
        </View>
      )}

      {/* Risk Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['All', 'High', 'Medium', 'Low'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedRiskFilter === filter && styles.activeFilterButton,
                { backgroundColor: filter !== 'All' ? RISK_COLORS[filter] : '#e3f2fd' }
              ]}
              onPress={() => setSelectedRiskFilter(filter)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedRiskFilter === filter && styles.activeFilterButtonText,
                { color: filter !== 'All' ? '#fff' : '#2196F3' }
              ]}>
                {filter}
                {filter !== 'All' && ` (${getDistrictsByRiskLevel(filter).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: 4.2105, // Center of Malaysia
            longitude: 101.9758,
            latitudeDelta: 8.0, // Show most of Malaysia
            longitudeDelta: 8.0,
          }}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          mapType="standard"
          onMapReady={() => {
            console.log('🗺️ Google Maps loaded successfully');
            setIsLoading(false);
          }}
          onError={(error) => {
            console.error('❌ MapView error:', error);
            setIsLoading(false);
            Alert.alert(
              'Map Loading Error', 
              'Unable to load Google Maps. Please check:\n• Internet connection\n• Google Maps API key\n• Try restarting the app',
              [{ text: 'OK' }]
            );
          }}
          onLayout={() => console.log('🗺️ MapView layout complete')}
        >
        {/* Test markers to verify map is working */}
        <Marker
          coordinate={{
            latitude: 3.1390,
            longitude: 101.6869
          }}
          title="Kuala Lumpur"
          description="Test marker - Map working ✅"
          pinColor="red"
        />
        
        <Marker
          coordinate={{
            latitude: 1.4927,
            longitude: 103.7414
          }}
          title="Johor Bahru"
          description="Southern Malaysia"
          pinColor="blue"
        />
        
        <Marker
          coordinate={{
            latitude: 5.9804,
            longitude: 116.0735
          }}
          title="Kota Kinabalu"
          description="Sabah, East Malaysia"
          pinColor="green"
        />
        
        {/* TODO: Add polygons back after basic map works */}
        {/* Temporarily disabled complex polygon rendering for debugging */}
        {false && getFilteredPolygons()}
        
        {/* Loading overlay for map */}
        {isLoading && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}
      </MapView>
      </View>

      {/* Map Legend */}
      <View style={styles.mapLegend}>
        <Text style={styles.legendTitle}>Risk Levels</Text>
        <View style={styles.legendItems}>
          {Object.entries(RISK_COLORS).map(([level, color]) => (
            level !== 'NoData' && (
              <View key={level} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{level}</Text>
              </View>
            )
          ))}
        </View>
      </View>

      {/* Modals */}
      {renderSearchModal()}
      {renderDetailsModal()}
      {renderAliceModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    marginLeft: 10,
  },
  aliceButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e8f5e8',
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  summaryFooter: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  
  // Loading Styles
  loadingContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  
  // Filter Container
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#e3f2fd',
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2196F3',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  
  // Map Styles
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  
  
  // Map Legend
  mapLegend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'column',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.8,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  // Search Input
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  
  // Search Results
  searchResults: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultStats: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  riskIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
  
  // Details Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
  },
  
  // District Details
  districtHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  districtTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  districtName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  riskBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  districtStats: {
    fontSize: 14,
    color: '#666',
  },
  aliceLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  aliceLocationText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  
  // Sections
  statsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  
  // Causes and Rivers
  causesSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  causeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  causeText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  riversSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  riverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 8,
  },
  riverText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  
  // Alice Section
  aliceSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  aliceInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    marginBottom: 8,
  },
  aliceInsightText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  
  // Alice Modal Styles
  aliceHeaderSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  aliceLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aliceLocationInfo: {
    marginLeft: 15,
  },
  aliceLocationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  aliceLocationSubtext: {
    fontSize: 14,
    color: '#666',
  },
  aliceInsightsSection: {
    padding: 20,
  },
  aliceInsightItem: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
  },
  aliceComparisonSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  comparisonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  comparisonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  aliceRecommendationsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recommendationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
});