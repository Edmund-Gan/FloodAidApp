import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext } from '../context/UserContext';
import { ReliableLocationContext } from '../context/ReliableLocationContext';
import EmergencyPlacesService from '../services/EmergencyPlacesService';
import SimplifiedLocationCache from '../services/SimplifiedLocationCache';
import ReliableLocationService from '../services/ReliableLocationService';
import LocationSelector from './LocationSelector';
import FloodSafeRouteViewer from './FloodSafeRouteViewer';

const { width } = Dimensions.get('window');

const EmergencyContacts = ({
  emergencyContactsData,
  monitoredLocations = [],
  currentLocationInfo = null,
  offlineMode = false
}) => {
  const { userProfile } = useContext(UserContext);
  const {
    currentLocation: contextLocation,
    getCurrentLocation: getContextLocation,
    getLocationDisplayInfo
  } = useContext(ReliableLocationContext);
  const [expanded, setExpanded] = useState(false);
  const [selectedMode, setSelectedMode] = useState('current'); // 'current', 'saved', or 'state'
  const [selectedLocationId, setSelectedLocationId] = useState(null); // ID of saved location
  const [selectedState, setSelectedState] = useState(null); // Manually selected state
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [activeTab, setActiveTab] = useState('callCenters'); // 'callCenters' or 'nearMe'
  const [nearbyPlaces, setNearbyPlaces] = useState({});
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [detectedState, setDetectedState] = useState('SELANGOR'); // State detected from coordinates
  const [routeViewerVisible, setRouteViewerVisible] = useState(false);
  const [selectedPlaceForRoute, setSelectedPlaceForRoute] = useState(null);

  useEffect(() => {
    loadSavedLocationSelection();
  }, []);

  // Auto-detect state when location selection changes
  useEffect(() => {
    const location = getSelectedLocationCoordinates();
    if (location) {
      detectStateFromGPSLocation(location.lat, location.lon);
    }
  }, [selectedMode, selectedLocationId, currentLocationInfo]);

  useEffect(() => {
    // Auto-detect state from context location for current mode
    if (selectedMode === 'current' && contextLocation && !contextLocation.isManual) {
      detectStateFromGPSLocation(contextLocation.latitude, contextLocation.longitude);
    }
  }, [contextLocation, selectedMode]);

  // Get coordinates for the selected location (current GPS or saved location)
  const getSelectedLocationCoordinates = () => {
    if (selectedMode === 'saved' && selectedLocationId) {
      // Use saved location coordinates
      const location = monitoredLocations.find(loc => loc.id === selectedLocationId);
      if (location && location.coordinates) {
        return {
          lat: location.coordinates.latitude,
          lon: location.coordinates.longitude,
          name: location.customLabel || location.name
        };
      }
    }

    // Use current GPS location (default)
    if (currentLocationInfo) {
      return {
        lat: currentLocationInfo.lat,
        lon: currentLocationInfo.lon,
        name: currentLocationInfo.display_name || 'Current Location'
      };
    } else if (contextLocation) {
      return {
        lat: contextLocation.latitude,
        lon: contextLocation.longitude,
        name: 'Current Location'
      };
    }

    return null;
  };

  const loadSavedLocationSelection = async () => {
    try {
      const stored = await AsyncStorage.getItem('selectedEmergencyLocation');
      if (stored) {
        const { mode, locationId, state } = JSON.parse(stored);
        setSelectedMode(mode);
        setSelectedLocationId(locationId);
        setSelectedState(state);
      }
    } catch (error) {
      console.log('Error loading location selection:', error);
    }
  };

  const saveLocationSelection = async (mode, idOrState) => {
    try {
      let data = { mode, locationId: null, state: null };

      if (mode === 'saved') {
        data.locationId = idOrState;
      } else if (mode === 'state') {
        data.state = idOrState;
      }

      await AsyncStorage.setItem('selectedEmergencyLocation', JSON.stringify(data));
      setSelectedMode(mode);

      if (mode === 'saved') {
        setSelectedLocationId(idOrState);
        setSelectedState(null);
      } else if (mode === 'state') {
        setSelectedState(idOrState);
        setSelectedLocationId(null);
      } else {
        setSelectedLocationId(null);
        setSelectedState(null);
      }
    } catch (error) {
      console.log('Error saving location selection:', error);
    }
  };

  const detectStateFromLocation = (location) => {
    const locationMap = {
      'selangor': 'SELANGOR',
      'kuala lumpur': 'KUALA LUMPUR',
      'johor': 'JOHOR',
      'penang': 'PENANG',
      'perak': 'PERAK',
      'kedah': 'KEDAH',
      'kelantan': 'KELANTAN',
      'terengganu': 'TERENGGANU',
      'pahang': 'PAHANG',
      'negeri sembilan': 'NEGERI SEMBILAN',
      'malacca': 'MALACCA',
      'perlis': 'PERLIS',
      'sabah': 'SABAH',
      'sarawak': 'SARAWAK',
      'putrajaya': 'PUTRAJAYA',
      'labuan': 'LABUAN'
    };

    const lowerLocation = location.toLowerCase();
    for (const [key, value] of Object.entries(locationMap)) {
      if (lowerLocation.includes(key)) {
        return value;
      }
    }
    return null;
  };

  const detectStateFromGPSLocation = async (latitude, longitude) => {
    try {
      console.log('🗺️ EmergencyContacts: Detecting state from GPS coordinates:', latitude, longitude);

      // Use SimplifiedLocationCache for accurate state detection
      const detectedStateName = SimplifiedLocationCache.detectMalaysianState(latitude, longitude);

      // Map the state name to the format used in emergency contacts data
      const stateMapping = {
        'Kuala Lumpur': 'KUALA LUMPUR',
        'Selangor': 'SELANGOR',
        'Johor': 'JOHOR',
        'Penang': 'PENANG',
        'Perak': 'PERAK',
        'Kedah': 'KEDAH',
        'Kelantan': 'KELANTAN',
        'Terengganu': 'TERENGGANU',
        'Pahang': 'PAHANG',
        'Negeri Sembilan': 'NEGERI SEMBILAN',
        'Melaka': 'MALACCA',
        'Perlis': 'PERLIS',
        'Sabah': 'SABAH',
        'Sarawak': 'SARAWAK',
        'Putrajaya': 'PUTRAJAYA',
        'Labuan': 'LABUAN'
      };

      const mappedState = stateMapping[detectedStateName] || 'SELANGOR';

      // Update detected state
      if (emergencyContactsData?.[mappedState]) {
        console.log(`🎯 Auto-detected state: ${detectedStateName} -> ${mappedState}`);
        setDetectedState(mappedState);
      }

    } catch (error) {
      console.error('❌ Error detecting state from GPS:', error);
    }
  };

  const makeCall = (phoneNumber) => {
    Alert.alert(
      'Emergency Call',
      `Call ${phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
            Linking.openURL(`tel:${cleanNumber}`);
          }
        }
      ]
    );
  };

  const getContactType = (contact) => {
    const contactLower = contact.toLowerCase();
    if (contactLower.includes('999') || contactLower.includes('emergency')) {
      return { icon: 'alert-circle', color: '#F44336', priority: 1 };
    } else if (contactLower.includes('fire') || contactLower.includes('994')) {
      return { icon: 'flame', color: '#FF5722', priority: 2 };
    } else if (contactLower.includes('police')) {
      return { icon: 'shield', color: '#3F51B5', priority: 3 };
    } else if (contactLower.includes('hospital') || contactLower.includes('medical')) {
      return { icon: 'medical', color: '#4CAF50', priority: 4 };
    } else if (contactLower.includes('civil defence') || contactLower.includes('apm')) {
      return { icon: 'people', color: '#FF9800', priority: 5 };
    } else if (contactLower.includes('disaster') || contactLower.includes('nadma')) {
      return { icon: 'warning', color: '#9C27B0', priority: 6 };
    } else {
      return { icon: 'call', color: '#607D8B', priority: 7 };
    }
  };

  const parseContact = (contactString) => {
    const parts = contactString.split(':');
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        phone: parts[1].trim()
      };
    }
    return {
      name: contactString,
      phone: null
    };
  };

  const renderContactItem = (contactString, index) => {
    const contact = parseContact(contactString);
    const typeInfo = getContactType(contactString);

    return (
      <TouchableOpacity
        key={index}
        style={styles.contactItem}
        onPress={() => contact.phone && makeCall(contact.phone)}
        activeOpacity={0.7}
        disabled={!contact.phone}
      >
        <View style={[styles.contactIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.name}</Text>
          {contact.phone && (
            <Text style={styles.contactPhone}>{contact.phone}</Text>
          )}
        </View>
        {contact.phone && (
          <View style={styles.callButton}>
            <Ionicons name="call" size={18} color={typeInfo.color} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Load nearby emergency places using selected location with progressive updates
  const loadNearbyPlaces = async () => {
    setLoadingLocation(true);
    setLocationError(null);
    setNearbyPlaces({}); // Clear previous results

    try {
      let location = null;

      // Get coordinates from selected location (current GPS or saved location)
      const selectedLocation = getSelectedLocationCoordinates();
      if (selectedLocation) {
        location = {
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lon,
          accuracy: selectedMode === 'saved' ? 50 : 20 // Approximate accuracy
        };
        console.log('📍 Using selected location for emergency services:', selectedLocation.name);
      } else {
        // Fallback: try to get GPS location
        if (contextLocation && !contextLocation.isCached) {
          location = {
            latitude: contextLocation.latitude,
            longitude: contextLocation.longitude,
            accuracy: contextLocation.accuracy
          };
          console.log('📍 Using fallback GPS location for emergency services');
        } else {
          throw new Error('Location not available');
        }
      }

      setUserLocation(location);

      // Progressive callback to update UI as each service loads
      const onProgressUpdate = (serviceKey, serviceResult, allResults) => {
        console.log(`Loaded ${serviceKey}:`, serviceResult.count, 'places');

        // Update state with new results immediately
        setNearbyPlaces(prevPlaces => ({
          ...prevPlaces,
          [serviceKey]: serviceResult
        }));

        // If we have at least one critical service loaded, we can hide the loading spinner
        const criticalServicesLoaded = Object.keys(allResults).some(key =>
          ['emergency_medical', 'police', 'fire_rescue'].includes(key) &&
          allResults[key].places.length > 0
        );

        if (criticalServicesLoaded && loadingLocation) {
          setLoadingLocation(false);
        }
      };

      // Get all emergency services with progressive loading
      const services = await EmergencyPlacesService.getAllEmergencyServices(location, onProgressUpdate);

      // Final update with complete results
      setNearbyPlaces(services);
    } catch (error) {
      console.error('Error loading nearby places:', error);
      setLocationError(error.message);
    } finally {
      setLoadingLocation(false);
    }
  };

  // Open directions to a specific place
  const openDirections = async (place) => {
    try {
      await EmergencyPlacesService.openDirections(place, userLocation);
    } catch (error) {
      Alert.alert(
        'Navigation Error',
        'Unable to open directions. Please check if Google Maps is installed.',
        [{ text: 'OK' }]
      );
    }
  };

  // Open flood-safe route planner
  const openFloodSafeRoute = (place) => {
    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Unable to determine your location. Please enable location services and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedPlaceForRoute(place);
    setRouteViewerVisible(true);
  };

  // Render a place item in the "Near Me" section
  const renderPlaceItem = (place, index) => {
    const distance = EmergencyPlacesService.formatDistance(place.distance);
    const isOpen = EmergencyPlacesService.isPlaceOpen(place);

    return (
      <View key={index} style={styles.placeItem}>
        <View style={[styles.placeIcon, { backgroundColor: place.color + '20' }]}>
          <Ionicons name={place.icon} size={20} color={place.color} />
        </View>

        <View style={styles.placeInfo}>
          <Text style={styles.placeName}>{place.name}</Text>
          <View style={styles.placeDetails}>
            <Text style={styles.placeDistance}>{distance} away</Text>
            {isOpen !== null && (
              <Text style={[styles.placeStatus, { color: isOpen ? '#4CAF50' : '#FF5722' }]}>
                • {isOpen ? 'Open' : 'Closed'}
              </Text>
            )}
            {place.rating && (
              <Text style={styles.placeRating}>• ⭐ {place.rating}</Text>
            )}
          </View>
        </View>

        <View style={styles.placeActions}>
          <TouchableOpacity
            style={styles.floodRouteButton}
            onPress={() => openFloodSafeRoute(place)}
            activeOpacity={0.7}
          >
            <Ionicons name="water" size={16} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => openDirections(place)}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate" size={18} color="#4CAF50" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render category section in "Near Me" with loading states
  const renderPlaceCategory = (categoryKey, categoryData) => {
    const config = EmergencyPlacesService.getPlaceTypes()[categoryKey];

    if (!config) {
      return null;
    }

    // Show loading skeleton if data is not yet available
    if (!categoryData) {
      return (
        <View key={categoryKey} style={styles.placeCategory}>
          <View style={styles.placeCategoryHeader}>
            <View style={styles.placeCategoryTitle}>
              <Ionicons name={config.icon} size={20} color={config.color} />
              <Text style={styles.placeCategoryText}>
                {config.displayName} (searching...)
              </Text>
            </View>
          </View>
          <View style={styles.placeCategoryList}>
            <View style={[styles.placeItem, styles.placeholderItem]}>
              <View style={[styles.placeIcon, { backgroundColor: 'rgba(240, 240, 240, 0.8)' }]}>
                <ActivityIndicator size="small" color={config.color} />
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeholderText}>Searching for {config.displayName.toLowerCase()}...</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Hide categories with no results
    if (categoryData.places.length === 0) {
      return null;
    }

    const { places, count } = categoryData;

    return (
      <View key={categoryKey} style={styles.placeCategory}>
        <View style={styles.placeCategoryHeader}>
          <View style={styles.placeCategoryTitle}>
            <Ionicons name={config.icon} size={20} color={config.color} />
            <Text style={styles.placeCategoryText}>
              {config.displayName} ({count} found)
            </Text>
          </View>
        </View>

        <View style={styles.placeCategoryList}>
          {places.slice(0, 3).map((place, index) => renderPlaceItem(place, index))}
          {places.length > 3 && (
            <Text style={styles.moreItemsText}>
              + {places.length - 3} more nearby
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render the "Near Me" content
  const renderNearMeContent = () => {
    if (loadingLocation) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Finding nearby emergency services...</Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color="#FF5722" />
          <Text style={styles.errorTitle}>Location Access Required</Text>
          <Text style={styles.errorMessage}>{locationError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadNearbyPlaces}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!userLocation || Object.keys(nearbyPlaces).length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={48} color="#666" />
          <Text style={styles.emptyTitle}>No Emergency Services Found</Text>
          <Text style={styles.emptyMessage}>
            Try enabling location services or check your internet connection.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadNearbyPlaces}
          >
            <Text style={styles.retryButtonText}>Search Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Get all possible service categories and show them in priority order
    const allServiceKeys = Object.keys(EmergencyPlacesService.getPlaceTypes());
    const sortedCategoryKeys = allServiceKeys.sort((a, b) => {
      const priorityA = EmergencyPlacesService.getPlaceTypes()[a]?.priority || 999;
      const priorityB = EmergencyPlacesService.getPlaceTypes()[b]?.priority || 999;
      return priorityA - priorityB;
    });

    const selectedLocation = getSelectedLocationCoordinates();
    const nearMeLocation = selectedLocation ? selectedLocation.name : 'your location';

    return (
      <View style={styles.nearMeContent}>
        <View style={styles.locationHeader}>
          <Ionicons
            name={selectedMode === 'current' ? 'navigate-circle' : 'location'}
            size={16}
            color="#4CAF50"
          />
          <Text style={styles.locationHeaderText} numberOfLines={1}>
            Near {nearMeLocation}
          </Text>
          <TouchableOpacity onPress={loadNearbyPlaces}>
            <Ionicons name="refresh" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {sortedCategoryKeys.map((categoryKey) =>
          renderPlaceCategory(categoryKey, nearbyPlaces[categoryKey])
        )}

        {/* Show message if no services are loading */}
        {Object.keys(nearbyPlaces).length === 0 && !loadingLocation && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyMessage}>
              Tap search to find emergency services near you
            </Text>
          </View>
        )}
      </View>
    );
  };

  const handleLocationSelect = async (mode, locationId) => {
    await saveLocationSelection(mode, locationId);

    // If switching to state mode and currently on Near Me tab, switch to Call Centers
    if (mode === 'state' && activeTab === 'nearMe') {
      setActiveTab('callCenters');
    }

    // Reload nearby places if Near Me tab is active and not in state mode
    if (activeTab === 'nearMe' && mode !== 'state') {
      loadNearbyPlaces();
    }
  };

  if (!emergencyContactsData) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading emergency contacts...</Text>
        </View>
      </View>
    );
  }

  // Determine which state to show: manual state selection overrides auto-detection
  const displayStateKey = selectedMode === 'state' ? selectedState : detectedState;
  const currentStateData = emergencyContactsData[displayStateKey];
  const contacts = currentStateData?.contacts || [];

  // Sort contacts by priority (emergency services first)
  const sortedContacts = [...contacts].sort((a, b) => {
    const aPriority = getContactType(a).priority;
    const bPriority = getContactType(b).priority;
    return aPriority - bPriority;
  });

  // Get display name for location selector
  const selectedLocation = getSelectedLocationCoordinates();
  let displayLocationName;

  if (selectedMode === 'state') {
    displayLocationName = selectedState ? selectedState.replace(/_/g, ' ') : 'Select State';
  } else {
    displayLocationName = selectedLocation ? selectedLocation.name : 'Current Location';
  }

  // Memoize origin and destination to prevent infinite loop in FloodSafeRouteViewer
  const memoizedOrigin = useMemo(() => ({
    latitude: userLocation?.latitude || contextLocation?.latitude || 0,
    longitude: userLocation?.longitude || contextLocation?.longitude || 0,
  }), [userLocation?.latitude, userLocation?.longitude, contextLocation?.latitude, contextLocation?.longitude]);

  const memoizedDestination = useMemo(() => {
    if (!selectedPlaceForRoute) return null;
    return {
      lat: selectedPlaceForRoute.geometry.location.lat,
      lng: selectedPlaceForRoute.geometry.location.lng,
    };
  }, [selectedPlaceForRoute?.geometry?.location?.lat, selectedPlaceForRoute?.geometry?.location?.lng]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#4CAF50', '#388E3C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Ionicons name="shield-checkmark" size={32} color="#fff" style={styles.headerIcon} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Manage Emergency Contacts</Text>
              <Text style={styles.headerSubtitle}>
                Nearby services, Tap to expand - {contacts.length} contacts
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={28}
              color="#fff"
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Category Switcher */}
          <View style={styles.categoryTabs}>
            <TouchableOpacity
              style={[
                styles.categoryTab,
                activeTab === 'callCenters' && styles.categoryTabActive,
                selectedMode === 'state' && styles.categoryTabFull
              ]}
              onPress={() => setActiveTab('callCenters')}
            >
              <Ionicons
                name="call"
                size={16}
                color={activeTab === 'callCenters' ? '#4CAF50' : '#666'}
              />
              <Text style={[styles.categoryTabText, activeTab === 'callCenters' && styles.categoryTabTextActive]}>
                Call Centers
              </Text>
            </TouchableOpacity>

            {selectedMode !== 'state' && !offlineMode && (
              <TouchableOpacity
                style={[styles.categoryTab, activeTab === 'nearMe' && styles.categoryTabActive]}
                onPress={() => {
                  setActiveTab('nearMe');
                  if (!userLocation) {
                    loadNearbyPlaces();
                  }
                }}
              >
                <Ionicons
                  name="location"
                  size={16}
                  color={activeTab === 'nearMe' ? '#4CAF50' : '#666'}
                />
                <Text style={[styles.categoryTabText, activeTab === 'nearMe' && styles.categoryTabTextActive]}>
                  Near Me
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {activeTab === 'callCenters' ? (
            <>
              <View style={styles.headerInfo}>
                <View style={styles.locationInfo}>
                  <Ionicons
                    name={selectedMode === 'state' ? 'map' : selectedMode === 'current' ? 'navigate-circle' : 'location'}
                    size={16}
                    color="#4CAF50"
                  />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {selectedMode === 'state'
                      ? `Emergency services for ${displayStateKey.replace(/_/g, ' ')}`
                      : `Near ${displayLocationName} (${displayStateKey.replace(/_/g, ' ')})`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeLocationButton}
                  onPress={() => setShowLocationSelector(true)}
                >
                  <Text style={styles.changeLocationText}>Change</Text>
                  <Ionicons name="chevron-forward" size={14} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.contactsList}>
                {sortedContacts.map((contact, index) => renderContactItem(contact, index))}
              </View>
            </>
          ) : (
            <View style={styles.nearMeContainer}>
              {renderNearMeContent()}
            </View>
          )}

          {currentStateData?.sources && (
            <View style={styles.sourcesSection}>
              <Text style={styles.sourcesTitle}>Sources</Text>
              {currentStateData.sources.map((source, index) => (
                <Text key={index} style={styles.sourceText}>
                  • {source}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={16} color="#FF9800" />
              <Text style={styles.warningText}>
                In life-threatening emergencies, always call 999 first
              </Text>
            </View>
          </View>
        </View>
      )}

      <LocationSelector
        visible={showLocationSelector}
        onClose={() => setShowLocationSelector(false)}
        locations={monitoredLocations}
        selectedMode={selectedMode}
        selectedLocationId={selectedLocationId}
        onSelectLocation={handleLocationSelect}
        allowStateBrowsing={true}
        stateList={Object.keys(emergencyContactsData || {})}
        selectedState={selectedState}
      />

      {selectedPlaceForRoute && memoizedDestination && (
        <FloodSafeRouteViewer
          visible={routeViewerVisible}
          onClose={() => {
            setRouteViewerVisible(false);
            setSelectedPlaceForRoute(null);
          }}
          origin={memoizedOrigin}
          destination={memoizedDestination}
          destinationName={selectedPlaceForRoute.name}
          state={detectedState}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingBottom: 20,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeLocationText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  contactsList: {
    paddingVertical: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'monospace',
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(240, 248, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourcesSection: {
    padding: 16,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sourceText: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
    lineHeight: 14,
  },
  footer: {
    padding: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 248, 225, 0.8)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  stateList: {
    maxHeight: 400,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  stateItemSelected: {
    backgroundColor: 'rgba(240, 248, 255, 0.8)',
  },
  stateText: {
    fontSize: 16,
    color: '#333',
  },
  stateTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  currentChosenItem: {
    backgroundColor: 'rgba(240, 248, 255, 0.6)',
    paddingVertical: 20,
  },
  currentChosenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentChosenText: {
    flex: 1,
  },
  currentChosenTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentChosenSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  pickerDivider: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
  },
  pickerDividerText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  // Category tabs styles
  categoryTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  categoryTabFull: {
    flex: 1,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  // Near Me styles
  nearMeContainer: {
    flex: 1,
  },
  nearMeContent: {
    paddingBottom: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationHeaderText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    marginLeft: 6,
  },
  // Place category styles
  placeCategory: {
    marginBottom: 16,
  },
  placeCategoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  placeCategoryTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeCategoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  placeCategoryList: {
    paddingHorizontal: 16,
  },
  // Place item styles
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  placeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  placeDistance: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  placeStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  placeRating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  placeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  floodRouteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  directionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(240, 248, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Loading, error, and empty states
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Loading placeholder styles
  placeholderItem: {
    opacity: 0.7,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});

// Memoized to prevent unnecessary re-renders when parent re-renders
export default React.memo(EmergencyContacts, (prevProps, nextProps) => {
  // Only re-render if critical props change
  return (
    prevProps.emergencyContactsData === nextProps.emergencyContactsData &&
    prevProps.monitoredLocations === nextProps.monitoredLocations &&
    prevProps.currentLocationInfo === nextProps.currentLocationInfo
  );
});