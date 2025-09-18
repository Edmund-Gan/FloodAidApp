import React, { useState, useEffect, useContext } from 'react';
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
import EmergencyPlacesService from '../services/EmergencyPlacesService';

const { width } = Dimensions.get('window');

const EmergencyContacts = ({ emergencyContactsData }) => {
  const { userProfile } = useContext(UserContext);
  const [expanded, setExpanded] = useState(false);
  const [selectedState, setSelectedState] = useState('SELANGOR');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState('callCenters'); // 'callCenters' or 'nearMe'
  const [nearbyPlaces, setNearbyPlaces] = useState({});
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    loadSelectedState();
  }, []);

  const loadSelectedState = async () => {
    try {
      const stored = await AsyncStorage.getItem('selectedEmergencyState');
      if (stored) {
        setSelectedState(stored);
      } else {
        // Try to auto-detect from user location
        const userLocation = userProfile?.location || '';
        const detectedState = detectStateFromLocation(userLocation);
        if (detectedState) {
          setSelectedState(detectedState);
          saveSelectedState(detectedState);
        }
      }
    } catch (error) {
      console.log('Error loading selected state:', error);
    }
  };

  const saveSelectedState = async (state) => {
    try {
      await AsyncStorage.setItem('selectedEmergencyState', state);
      setSelectedState(state);
    } catch (error) {
      console.log('Error saving selected state:', error);
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

  // Load nearby emergency places using GPS location
  const loadNearbyPlaces = async () => {
    setLoadingLocation(true);
    setLocationError(null);

    try {
      // Get user's current location
      const location = await EmergencyPlacesService.getCurrentLocation();
      setUserLocation(location);

      // Get all emergency services near the user
      const services = await EmergencyPlacesService.getAllEmergencyServices(location);
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

        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() => openDirections(place)}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate" size={18} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render category section in "Near Me"
  const renderPlaceCategory = (categoryKey, categoryData) => {
    if (!categoryData || categoryData.places.length === 0) {
      return null;
    }

    const { places, config, count } = categoryData;

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

    const sortedCategories = Object.entries(nearbyPlaces)
      .filter(([_, data]) => data.places.length > 0)
      .sort((a, b) => a[1].config.priority - b[1].config.priority);

    return (
      <View style={styles.nearMeContent}>
        <View style={styles.locationHeader}>
          <Ionicons name="location" size={16} color="#4CAF50" />
          <Text style={styles.locationHeaderText}>
            Emergency services near your location
          </Text>
          <TouchableOpacity onPress={loadNearbyPlaces}>
            <Ionicons name="refresh" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {sortedCategories.map(([categoryKey, categoryData]) =>
          renderPlaceCategory(categoryKey, categoryData)
        )}
      </View>
    );
  };

  const renderStatePicker = () => {
    const states = Object.keys(emergencyContactsData || {});

    return (
      <Modal
        visible={showStatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State/Territory</Text>
              <TouchableOpacity
                onPress={() => setShowStatePicker(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.stateList}>
              {states.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[
                    styles.stateItem,
                    selectedState === state && styles.stateItemSelected
                  ]}
                  onPress={() => {
                    saveSelectedState(state);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={[
                    styles.stateText,
                    selectedState === state && styles.stateTextSelected
                  ]}>
                    {state.replace(/_/g, ' ')}
                  </Text>
                  {selectedState === state && (
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
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

  const currentStateData = emergencyContactsData[selectedState];
  const contacts = currentStateData?.contacts || [];

  // Sort contacts by priority (emergency services first)
  const sortedContacts = [...contacts].sort((a, b) => {
    const aPriority = getContactType(a).priority;
    const bPriority = getContactType(b).priority;
    return aPriority - bPriority;
  });

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
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Emergency Contacts</Text>
                <Text style={styles.headerSubtitle}>
                  Nearby emergency services
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.stateSelector}
                onPress={() => setShowStatePicker(true)}
              >
                <Text style={styles.stateSelectorText}>
                  {selectedState.replace(/_/g, ' ')}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </TouchableOpacity>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
                style={styles.expandIcon}
              />
            </View>
          </View>

          {!expanded && (
            <View style={styles.quickContact}>
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.quickContactText}>
                Tap to expand - {contacts.length} emergency contacts
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* Category Switcher */}
            <View style={styles.categoryTabs}>
              <TouchableOpacity
                style={[styles.categoryTab, activeTab === 'callCenters' && styles.categoryTabActive]}
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
            </View>

            {activeTab === 'callCenters' ? (
              <>
                <View style={styles.headerInfo}>
                  <View style={styles.locationInfo}>
                    <Ionicons name="location" size={16} color="#4CAF50" />
                    <Text style={styles.locationText}>
                      Emergency services for {selectedState.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeLocationButton}
                    onPress={() => setShowStatePicker(true)}
                  >
                    <Text style={styles.changeLocationText}>Change Location</Text>
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
          </ScrollView>
        </View>
      )}

      {renderStatePicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
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
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  stateSelectorText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
    marginRight: 4,
  },
  expandIcon: {
    marginLeft: 4,
  },
  quickContact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickContactText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
  content: {
    maxHeight: 400,
    flex: 1,
  },
  scrollContent: {
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
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
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourcesSection: {
    padding: 16,
    backgroundColor: '#F8F9FA',
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
    backgroundColor: '#FFF8E1',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    backgroundColor: '#F0F8FF',
  },
  stateText: {
    fontSize: 16,
    color: '#333',
  },
  stateTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  // Category tabs styles
  categoryTabs: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
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
  categoryTabActive: {
    backgroundColor: '#fff',
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
  directionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EmergencyContacts;