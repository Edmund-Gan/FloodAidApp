/**
 * ManualLocationInput - Simple, user-friendly manual location selection
 *
 * This component provides an easy way for users to input their location
 * when GPS fails or is unavailable. Works with the new ReliableLocationService.
 *
 * Features:
 * - Address search with Malaysian locations
 * - Quick preset Malaysian cities
 * - Map picker for precise coordinates
 * - Integration with SimplifiedLocationCache
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SimplifiedLocationCache from '../services/SimplifiedLocationCache';

const { width } = Dimensions.get('window');

const ManualLocationInput = ({
  visible = false,
  onLocationSelected = null,
  onCancel = null,
  title = 'Select Your Location',
  subtitle = 'Choose your location for accurate flood predictions',
}) => {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('preset'); // 'preset', 'search', 'coordinates'

  // Malaysian cities for quick selection
  const PRESET_CITIES = [
    { name: 'Kuala Lumpur', state: 'Kuala Lumpur', lat: 3.1390, lon: 101.6869 },
    { name: 'Petaling Jaya', state: 'Selangor', lat: 3.1073, lon: 101.6421 },
    { name: 'Shah Alam', state: 'Selangor', lat: 3.0733, lon: 101.5185 },
    { name: 'Subang Jaya', state: 'Selangor', lat: 3.1556, lon: 101.7023 },
    { name: 'Johor Bahru', state: 'Johor', lat: 1.4927, lon: 103.7414 },
    { name: 'George Town', state: 'Penang', lat: 5.4164, lon: 100.3327 },
    { name: 'Ipoh', state: 'Perak', lat: 4.5975, lon: 101.0901 },
    { name: 'Kota Kinabalu', state: 'Sabah', lat: 5.9804, lon: 116.0735 },
    { name: 'Kuching', state: 'Sarawak', lat: 1.5533, lon: 110.3592 },
    { name: 'Malacca City', state: 'Melaka', lat: 2.2055, lon: 102.2501 },
    { name: 'Alor Setar', state: 'Kedah', lat: 6.1248, lon: 100.3678 },
    { name: 'Kuantan', state: 'Pahang', lat: 3.8077, lon: 103.3260 },
  ];

  useEffect(() => {
    if (searchText.length > 2) {
      searchLocations(searchText);
    } else {
      setSearchResults([]);
    }
  }, [searchText]);

  const searchLocations = async (query) => {
    setIsSearching(true);

    try {
      // Simple search through preset cities and common areas
      const filteredCities = PRESET_CITIES.filter(city =>
        city.name.toLowerCase().includes(query.toLowerCase()) ||
        city.state.toLowerCase().includes(query.toLowerCase())
      );

      // Add some common Malaysian areas
      const commonAreas = [
        { name: 'Puchong', state: 'Selangor', lat: 3.0738, lon: 101.5183 },
        { name: 'Kajang', state: 'Selangor', lat: 3.0073, lon: 101.7831 },
        { name: 'Ampang', state: 'Selangor', lat: 3.1478, lon: 101.7620 },
        { name: 'Cheras', state: 'Kuala Lumpur', lat: 3.1255, lon: 101.7437 },
        { name: 'Bangsar', state: 'Kuala Lumpur', lat: 3.1316, lon: 101.6710 },
        { name: 'Mont Kiara', state: 'Kuala Lumpur', lat: 3.1729, lon: 101.6508 },
        { name: 'KLCC', state: 'Kuala Lumpur', lat: 3.1579, lon: 101.7116 },
        { name: 'Damansara', state: 'Selangor', lat: 3.1732, lon: 101.6395 },
        { name: 'Cyberjaya', state: 'Selangor', lat: 2.9213, lon: 101.6559 },
        { name: 'Putrajaya', state: 'Putrajaya', lat: 2.9264, lon: 101.6964 },
      ].filter(area =>
        area.name.toLowerCase().includes(query.toLowerCase()) ||
        area.state.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults([...filteredCities, ...commonAreas]);

    } catch (error) {
      console.error('Location search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = async (location) => {
    try {
      const locationData = {
        latitude: location.lat,
        longitude: location.lon,
        accuracy: null,
        timestamp: Date.now(),
        source: 'MANUAL_SELECTED',
        address: `${location.name}, ${location.state}`,
        city: location.name,
        state: location.state,
        isManual: true,
      };

      // Cache the manual location
      await SimplifiedLocationCache.cacheManualLocation(locationData);

      // Notify parent component
      if (onLocationSelected) {
        onLocationSelected(locationData);
      }

      console.log(`📍 Manual location selected: ${location.name}, ${location.state}`);

    } catch (error) {
      console.error('Error selecting manual location:', error);
      Alert.alert('Error', 'Failed to select location. Please try again.');
    }
  };

  const handleCoordinateInput = () => {
    Alert.prompt(
      'Enter Coordinates',
      'Please enter latitude and longitude (e.g., 3.1390, 101.6869)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: (input) => {
            try {
              const [latStr, lonStr] = input.split(',').map(s => s.trim());
              const lat = parseFloat(latStr);
              const lon = parseFloat(lonStr);

              if (isNaN(lat) || isNaN(lon)) {
                throw new Error('Invalid coordinates');
              }

              // Validate coordinates are reasonable
              if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                throw new Error('Coordinates out of range');
              }

              const state = SimplifiedLocationCache.detectMalaysianState(lat, lon);
              const locationData = {
                latitude: lat,
                longitude: lon,
                accuracy: null,
                timestamp: Date.now(),
                source: 'MANUAL_COORDINATES',
                address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                state: state,
                isManual: true,
              };

              handleLocationSelect({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, state });

            } catch (error) {
              Alert.alert('Invalid Input', 'Please enter valid coordinates in format: latitude, longitude');
            }
          }
        }
      ],
      'plain-text',
      '3.1390, 101.6869'
    );
  };

  const renderMethodSelector = () => (
    <View style={styles.methodSelector}>
      <TouchableOpacity
        style={[styles.methodButton, selectedMethod === 'preset' && styles.methodButtonActive]}
        onPress={() => setSelectedMethod('preset')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="location"
          size={16}
          color={selectedMethod === 'preset' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.methodText, selectedMethod === 'preset' && styles.methodTextActive]}>
          Quick Select
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.methodButton, selectedMethod === 'search' && styles.methodButtonActive]}
        onPress={() => setSelectedMethod('search')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="search"
          size={16}
          color={selectedMethod === 'search' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.methodText, selectedMethod === 'search' && styles.methodTextActive]}>
          Search
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.methodButton, selectedMethod === 'coordinates' && styles.methodButtonActive]}
        onPress={() => setSelectedMethod('coordinates')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="map"
          size={16}
          color={selectedMethod === 'coordinates' ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.methodText, selectedMethod === 'coordinates' && styles.methodTextActive]}>
          Coordinates
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderLocationItem = (location, index) => (
    <TouchableOpacity
      key={index}
      style={styles.locationItem}
      onPress={() => handleLocationSelect(location)}
      activeOpacity={0.7}
    >
      <View style={styles.locationIcon}>
        <Ionicons name="location" size={18} color="#4CAF50" />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{location.name}</Text>
        <Text style={styles.locationState}>{location.state}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#ccc" />
    </TouchableOpacity>
  );

  const renderPresetLocations = () => (
    <ScrollView style={styles.locationsList} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Popular Malaysian Cities</Text>
      {PRESET_CITIES.map((location, index) => renderLocationItem(location, index))}
    </ScrollView>
  );

  const renderSearchInterface = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={16} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a city or area..."
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#4CAF50" style={styles.searchSpinner} />
        )}
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {searchResults.map((location, index) => renderLocationItem(location, index))}
        </ScrollView>
      )}

      {searchText.length > 2 && searchResults.length === 0 && !isSearching && (
        <View style={styles.noResults}>
          <Ionicons name="search" size={32} color="#ccc" />
          <Text style={styles.noResultsText}>No locations found</Text>
          <Text style={styles.noResultsSubtext}>Try searching for a different city or area</Text>
        </View>
      )}
    </View>
  );

  const renderCoordinatesInterface = () => (
    <View style={styles.coordinatesContainer}>
      <View style={styles.coordinatesInfo}>
        <Ionicons name="map" size={24} color="#4CAF50" />
        <Text style={styles.coordinatesTitle}>Enter Coordinates</Text>
        <Text style={styles.coordinatesDescription}>
          If you know your exact latitude and longitude coordinates, you can enter them directly.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.coordinatesButton}
        onPress={handleCoordinateInput}
        activeOpacity={0.7}
      >
        <Ionicons name="create" size={20} color="#fff" />
        <Text style={styles.coordinatesButtonText}>Enter Coordinates</Text>
      </TouchableOpacity>

      <Text style={styles.coordinatesExample}>
        Example: 3.1390, 101.6869 (Kuala Lumpur)
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {renderMethodSelector()}

        <View style={styles.content}>
          {selectedMethod === 'preset' && renderPresetLocations()}
          {selectedMethod === 'search' && renderSearchInterface()}
          {selectedMethod === 'coordinates' && renderCoordinatesInterface()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: width * 0.9,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    padding: 4,
  },
  methodSelector: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  methodButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  methodTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  locationsList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  locationState: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  searchResults: {
    flex: 1,
  },
  noResults: {
    alignItems: 'center',
    padding: 32,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  coordinatesContainer: {
    padding: 24,
    alignItems: 'center',
  },
  coordinatesInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  coordinatesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  coordinatesDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  coordinatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  coordinatesButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  coordinatesExample: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
});

export default ManualLocationInput;