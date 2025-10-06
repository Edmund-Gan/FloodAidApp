import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Linking,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReliableLocationService from '../services/ReliableLocationService';
import ChildPersonalizationService from '../services/ChildPersonalizationService';
import StoreFinderService from '../services/StoreFinderService';
import ChildSummaryBanner from './ChildSummaryBanner';
import ComfortItemsTracker from './ComfortItemsTracker';
import FloodSafeRouteViewer from './FloodSafeRouteViewer';
import { UserContext } from '../context/UserContext';

const { width } = Dimensions.get('window');

const EmergencyKit = ({ emergencyKitData }) => {
  const { userProfile, updateUserProfile } = useContext(UserContext);
  const [expanded, setExpanded] = useState(false);
  const [completedItems, setCompletedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [storeFinderModal, setStoreFinderModal] = useState({ visible: false, item: null });
  const [nearbyStores, setNearbyStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStoreForRoute, setSelectedStoreForRoute] = useState(null);
  const [routeViewerVisible, setRouteViewerVisible] = useState(false);

  useEffect(() => {
    loadProgress();
    getCurrentLocation();
  }, []);

  // Auto-update child categorization when children ages change
  useEffect(() => {
    if (userProfile.hasChildren && userProfile.childrenAges) {
      ChildPersonalizationService.updateChildCategorization(userProfile, updateUserProfile);
    }
  }, [userProfile.childrenAges, userProfile.hasChildren]);

  const getCurrentLocation = async () => {
    try {
      console.log('📍 EmergencyKit: Getting current location for store finder...');

      const location = await ReliableLocationService.getCurrentLocation({
        forceRefresh: true,
        enableHighAccuracy: true,
        includeAddress: false // Don't need address for store finder
      });

      if (location) {
        setCurrentLocation({
          latitude: location.lat,
          longitude: location.lon
        });
        console.log('✅ EmergencyKit: Location acquired for store finder');
      }
    } catch (error) {
      console.log('📍 EmergencyKit: Location failed for store finder:', error.message);

      // Don't block the UI, just log the issue
      // Google Maps will work without precise location using general search
    }
  };

  const findNearbyStores = async (item) => {
    if (!currentLocation) {
      Alert.alert(
        'Location Required',
        'Unable to determine your location. Please enable location services and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoadingStores(true);
    setStoreFinderModal({ visible: true, item });
    setNearbyStores([]);

    try {
      const categories = StoreFinderService.parseStoreCategories(item.whereToShop);

      if (categories.length === 0) {
        Alert.alert('No Stores', 'No store categories found for this item.');
        setLoadingStores(false);
        return;
      }

      // Search for the first category (can be enhanced to search all)
      const stores = await StoreFinderService.findNearbyStores(
        currentLocation,
        categories[0],
        { radius: 5000, maxResults: 20 }
      );

      // Add distance to each store
      const storesWithDistance = stores.map(store => ({
        ...store,
        distance: StoreFinderService.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          store.location.lat,
          store.location.lng
        )
      }));

      // Sort by distance
      storesWithDistance.sort((a, b) => a.distance - b.distance);

      setNearbyStores(storesWithDistance);
    } catch (error) {
      console.error('Error finding stores:', error);
      Alert.alert('Error', 'Failed to find nearby stores. Please try again.');
    } finally {
      setLoadingStores(false);
    }
  };

  const openDirections = (store) => {
    const { lat, lng } = store.location;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open Google Maps for directions.');
    });
  };

  const openFloodSafeRoute = (store) => {
    if (!currentLocation) {
      Alert.alert(
        'Location Required',
        'Unable to determine your location for flood-safe routing.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedStoreForRoute(store);
    setRouteViewerVisible(true);
    setStoreFinderModal({ visible: false, item: null });
  };

  const loadProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem('emergencyKitProgress');
      if (stored) {
        setCompletedItems(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Error loading emergency kit progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (newProgress) => {
    try {
      await AsyncStorage.setItem('emergencyKitProgress', JSON.stringify(newProgress));
      setCompletedItems(newProgress);
    } catch (error) {
      console.log('Error saving emergency kit progress:', error);
    }
  };

  const toggleItem = (itemId) => {
    const newProgress = {
      ...completedItems,
      [itemId]: !completedItems[itemId]
    };
    saveProgress(newProgress);
  };

  const parseScalingRule = (scalingRule, familySize, originalItem) => {
    if (!scalingRule) return originalItem;

    // Linear scaling patterns
    if (scalingRule.includes('Linear scaling')) {
      if (originalItem.includes('4L/person/day')) {
        return originalItem.replace('4L/person/day', `${4 * familySize}L total/day (${familySize} people)`);
      }
      if (scalingRule.includes('12L')) {
        return `${originalItem} (${12 * familySize}L for ${familySize} people)`;
      }
      if (scalingRule.includes('per person')) {
        return originalItem.replace('per person', `for ${familySize} people`);
      }
    }

    // Specific scaling patterns
    if (scalingRule.includes('per person')) {
      if (scalingRule.includes('10 per person')) {
        return `${originalItem} (${10 * familySize} total for ${familySize} people)`;
      }
      return `${originalItem} (${familySize} needed for ${familySize} people)`;
    }

    // Group-based scaling
    if (scalingRule.includes('1 basic + 1 extra per 4 people')) {
      const extraKits = Math.floor((familySize - 1) / 4) + 1;
      return `${originalItem} (${extraKits} kit${extraKits > 1 ? 's' : ''} for ${familySize} people)`;
    }

    if (scalingRule.includes('1 per person + 2 extras')) {
      return `${originalItem} (${familySize + 2} total for ${familySize} people + 2 extras)`;
    }

    if (scalingRule.includes('1 per 2–3 people')) {
      const needed = Math.ceil(familySize / 2.5);
      return `${originalItem} (${needed} needed for ${familySize} people)`;
    }

    if (scalingRule.includes('1–2 per person')) {
      return `${originalItem} (${familySize * 2} recommended for ${familySize} people)`;
    }

    if (scalingRule.includes('2–3 sets per group')) {
      return `${originalItem} (3 sets recommended for group of ${familySize})`;
    }

    // Same for all patterns
    if (scalingRule.includes('Same for all') || scalingRule.includes('1 per group')) {
      return originalItem;
    }

    return originalItem;
  };

  const calculatePrepTime = (baseTime, mobilityAssistance, mobilityConsiderations) => {
    // Parse time from string (e.g., "15–30 min" -> average 22.5)
    const timeMatch = baseTime.match(/(\d+)(?:–(\d+))?/);
    if (!timeMatch) {
      return baseTime;
    }

    const minTime = parseInt(timeMatch[1]);
    const maxTime = timeMatch[2] ? parseInt(timeMatch[2]) : minTime;
    const avgTime = (minTime + maxTime) / 2;

    // Apply child-specific time adjustments first
    let adjustedTime = ChildPersonalizationService.calculateChildAdjustedTime(avgTime, userProfile);

    // Apply mobility assistance adjustments
    if (mobilityAssistance) {
      adjustedTime = Math.round(adjustedTime * 1.5);
    }

    const adjustmentNotes = [];
    if (userProfile.hasChildren) {
      adjustmentNotes.push('child-adjusted');
    }
    if (mobilityAssistance && mobilityConsiderations) {
      adjustmentNotes.push('mobility-adjusted');
    }

    if (adjustmentNotes.length > 0) {
      return `${adjustedTime} min (${adjustmentNotes.join(', ')})`;
    }
    return `${adjustedTime} min`;
  };

  const getChildSpecificItems = () => {
    const { hasChildren, hasInfants, hasToddlers, hasSchoolChildren, hasTeens, childrenDetails = [] } = userProfile;

    if (!hasChildren) return [];

    const childItems = [];
    let itemIndex = 1000; // Start from high number to avoid conflicts

    // Items for infants (under 2 years)
    if (hasInfants) {
      childItems.push(
        {
          id: `child_item_${itemIndex++}`,
          title: `Baby formula and bottles (3-day supply)`,
          priority: 'HIGH',
          prepTime: '30 min',
          mobilityNote: '',
          whereToShop: 'Pharmacy, Grocery store',
          originalItem: 'Baby formula and bottles',
          isChildItem: true,
          ageGroup: 'infants'
        },
        {
          id: `child_item_${itemIndex++}`,
          title: `Diapers and wipes (72 hours worth)`,
          priority: 'HIGH',
          prepTime: '15 min',
          mobilityNote: '',
          whereToShop: 'Pharmacy, Grocery store',
          originalItem: 'Diapers and wipes',
          isChildItem: true,
          ageGroup: 'infants'
        },
        {
          id: `child_item_${itemIndex++}`,
          title: `Baby food and snacks`,
          priority: 'MEDIUM',
          prepTime: '20 min',
          mobilityNote: '',
          whereToShop: 'Grocery store',
          originalItem: 'Baby food and snacks',
          isChildItem: true,
          ageGroup: 'infants'
        }
      );
    }

    // Items for toddlers (2-5 years)
    if (hasToddlers) {
      childItems.push(
        {
          id: `child_item_${itemIndex++}`,
          title: `Child-safe snacks and drinks`,
          priority: 'HIGH',
          prepTime: '15 min',
          mobilityNote: '',
          whereToShop: 'Grocery store',
          originalItem: 'Child-safe snacks and drinks',
          isChildItem: true,
          ageGroup: 'toddlers'
        },
        {
          id: `child_item_${itemIndex++}`,
          title: `Extra clothes and shoes for toddlers`,
          priority: 'MEDIUM',
          prepTime: '20 min',
          mobilityNote: '',
          whereToShop: 'Department stores',
          originalItem: 'Extra clothes and shoes for toddlers',
          isChildItem: true,
          ageGroup: 'toddlers'
        }
      );
    }

    // Items for school children (6-12 years)
    if (hasSchoolChildren) {
      childItems.push(
        {
          id: `child_item_${itemIndex++}`,
          title: `School emergency contact cards`,
          priority: 'HIGH',
          prepTime: '25 min',
          mobilityNote: '',
          whereToShop: 'Home preparation',
          originalItem: 'School emergency contact cards',
          isChildItem: true,
          ageGroup: 'schoolChildren'
        },
        {
          id: `child_item_${itemIndex++}`,
          title: `Activities and books for children`,
          priority: 'MEDIUM',
          prepTime: '15 min',
          mobilityNote: '',
          whereToShop: 'Bookstore, Department stores',
          originalItem: 'Activities and books for children',
          isChildItem: true,
          ageGroup: 'schoolChildren'
        }
      );
    }

    // Items for teens (13-17 years)
    if (hasTeens) {
      childItems.push(
        {
          id: `child_item_${itemIndex++}`,
          title: `Teen personal care items`,
          priority: 'MEDIUM',
          prepTime: '15 min',
          mobilityNote: '',
          whereToShop: 'Pharmacy, Department stores',
          originalItem: 'Teen personal care items',
          isChildItem: true,
          ageGroup: 'teens'
        }
      );
    }

    // Add comfort items for children who need them
    const needsComfortItems = childrenDetails.some(child => child.needsComfortItems);
    if (needsComfortItems) {
      childItems.push({
        id: `child_item_${itemIndex++}`,
        title: `Comfort items (favorite toy, blanket, pacifier)`,
        priority: 'MEDIUM',
        prepTime: '10 min',
        mobilityNote: 'Important for reducing child anxiety during emergencies',
        whereToShop: 'Home collection',
        originalItem: 'Comfort items',
        isChildItem: true,
        ageGroup: 'all'
      });
    }

    // Universal child items
    if (hasChildren) {
      childItems.push(
        {
          id: `child_item_${itemIndex++}`,
          title: `Child identification cards with emergency contacts`,
          priority: 'HIGH',
          prepTime: '30 min',
          mobilityNote: '',
          whereToShop: 'Home preparation',
          originalItem: 'Child identification cards',
          isChildItem: true,
          ageGroup: 'all'
        },
        {
          id: `child_item_${itemIndex++}`,
          title: `Entertainment items (coloring books, small toys)`,
          priority: 'LOW',
          prepTime: '15 min',
          mobilityNote: 'Helps keep children calm and occupied',
          whereToShop: 'Toy store, Department stores',
          originalItem: 'Entertainment items',
          isChildItem: true,
          ageGroup: 'all'
        }
      );
    }

    return childItems;
  };

  const getPersonalizedItems = () => {
    if (!emergencyKitData?.Items) return [];

    const { familySize = 1, hasChildren, healthConditions = [], mobilityAssistance = false } = userProfile;
    const hasSpecialMedical = healthConditions.length > 0;

    // Get base emergency kit items
    const baseItems = emergencyKitData.Items.map((item, index) => {
      const scaledQuantity = parseScalingRule(item['Scaling for More People'], familySize, item.Item);
      const adjustedPrepTime = calculatePrepTime(item['Base Prep Time'], mobilityAssistance, item['Mobility Considerations']);

      let mobilityNote = '';
      if (item['Mobility Considerations'] && (mobilityAssistance || hasSpecialMedical)) {
        mobilityNote = item['Mobility Considerations'];
      }

      return {
        id: `item_${index}`,
        title: scaledQuantity,
        priority: item.Priority,
        prepTime: adjustedPrepTime,
        mobilityNote,
        whereToShop: item['Where to Shop'],
        originalItem: item.Item,
        scalingRule: item['Scaling for More People'],
        isChildItem: false
      };
    });

    // Add child-specific items if user has children
    const childItems = getChildSpecificItems();

    return [...baseItems, ...childItems];
  };

  const personalizedItems = getPersonalizedItems();
  const priorityGroups = {
    HIGH: personalizedItems.filter(item => item.priority === 'HIGH'),
    MEDIUM: personalizedItems.filter(item => item.priority === 'MEDIUM'),
    LOW: personalizedItems.filter(item => item.priority === 'LOW')
  };

  const totalItems = personalizedItems.length;
  const completedCount = Object.values(completedItems).filter(Boolean).length;
  const progressPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const estimatedTime = personalizedItems
    .filter(item => !completedItems[item.id])
    .reduce((total, item) => {
      const timeMatch = item.prepTime.match(/(\d+)/);
      return total + (timeMatch ? parseInt(timeMatch[0]) : 15);
    }, 0);

  const renderPrioritySection = (priority, items, color, icon) => {
    const sectionCompleted = items.filter(item => completedItems[item.id]).length;

    return (
      <View key={priority} style={styles.prioritySection}>
        <View style={[styles.priorityHeader, { backgroundColor: color + '15' }]}>
          <View style={styles.priorityTitleRow}>
            <Ionicons name={icon} size={20} color={color} />
            <Text style={[styles.priorityTitle, { color }]}>{priority} Priority</Text>
            <Text style={styles.priorityProgress}>
              {sectionCompleted}/{items.length}
            </Text>
          </View>
        </View>

        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemRow,
              completedItems[item.id] && styles.itemCompleted,
              item.isChildItem && styles.childItemRow
            ]}
            onPress={() => toggleItem(item.id)}
          >
            <View style={styles.itemCheckbox}>
              <Ionicons
                name={completedItems[item.id] ? 'checkbox' : 'square-outline'}
                size={24}
                color={completedItems[item.id] ? '#4CAF50' : '#666'}
              />
            </View>
            <View style={styles.itemContent}>
              <View style={styles.itemTitleRow}>
                <Text style={[
                  styles.itemTitle,
                  completedItems[item.id] && styles.itemTitleCompleted
                ]}>
                  {item.title}
                </Text>
                {item.isChildItem && (
                  <View style={styles.childItemBadge}>
                    <Ionicons name="people-outline" size={12} color="#FF6B6B" />
                    <Text style={styles.childItemBadgeText}>Child</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemDetail}>
                  <Ionicons name="time-outline" size={12} color="#666" /> {item.prepTime}
                </Text>
                {item.whereToShop && (
                  <Text style={styles.itemDetail}>
                    <Ionicons name="location-outline" size={12} color="#666" /> {item.whereToShop}
                  </Text>
                )}
              </View>
              {item.whereToShop && (
                <TouchableOpacity
                  style={styles.findStoresButton}
                  onPress={() => findNearbyStores(item)}
                >
                  <Ionicons name="map-outline" size={14} color="#4CAF50" />
                  <Text style={styles.findStoresText}>Find Nearby Stores</Text>
                </TouchableOpacity>
              )}
              {item.mobilityNote && (
                <View style={styles.mobilityNote}>
                  <Ionicons name="accessibility" size={12} color="#FF9800" />
                  <Text style={styles.mobilityText}>{item.mobilityNote}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading emergency kit...</Text>
        </View>
      </View>
    );
  }

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
                <Ionicons name="briefcase" size={28} color="#fff" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Emergency Kit</Text>
                <Text style={styles.headerSubtitle}>
                  Optimized for {userProfile.familySize} {userProfile.familySize === 1 ? 'person' : 'people'}
                  {userProfile.hasChildren && ` including ${userProfile.childrenAges?.length || 0} ${userProfile.childrenAges?.length === 1 ? 'child' : 'children'}`}
                  {userProfile.mobilityAssistance && ' with mobility assistance'}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>{completedCount}/{totalItems}</Text>
                <Text style={styles.progressLabel}>{progressPercentage}%</Text>
              </View>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
              />
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercentage}%` }
                ]}
              />
            </View>
          </View>

          {!expanded && estimatedTime > 0 && (
            <View style={styles.timeEstimate}>
              <Ionicons name="time-outline" size={14} color="#fff" />
              <Text style={styles.timeText}>
                Est. {estimatedTime} min remaining
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.personalizationBanner}>
            <View style={styles.bannerContent}>
              <Ionicons name="person-outline" size={16} color="#4CAF50" />
              <Text style={styles.bannerText}>
                Recommendations optimized for your household of {userProfile.familySize} {userProfile.familySize === 1 ? 'person' : 'people'}
                {userProfile.hasChildren && ` including child-specific items for ${userProfile.childrenAges?.length || 0} ${userProfile.childrenAges?.length === 1 ? 'child' : 'children'}`}
                {userProfile.mobilityAssistance && ' with mobility assistance considerations'}
                {userProfile.healthConditions?.length > 0 && ' and special medical needs'}
              </Text>
            </View>
          </View>

          {/* Child Summary Banner */}
          <ChildSummaryBanner
            userProfile={userProfile}
            showTimeAdjustment={true}
            estimatedTime={estimatedTime}
          />

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{completedCount}</Text>
                  <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{totalItems - completedCount}</Text>
                  <Text style={styles.summaryLabel}>Remaining</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{estimatedTime}m</Text>
                  <Text style={styles.summaryLabel}>Est. Time</Text>
                </View>
              </View>
            </View>

            {renderPrioritySection('HIGH', priorityGroups.HIGH, '#F44336', 'alert-circle')}
            {renderPrioritySection('MEDIUM', priorityGroups.MEDIUM, '#FF9800', 'warning')}
            {renderPrioritySection('LOW', priorityGroups.LOW, '#2196F3', 'information-circle')}

            {/* Comfort Items Tracker */}
            <ComfortItemsTracker userProfile={userProfile} />

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Recommendations personalized for your family profile
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      <Modal
        visible={storeFinderModal.visible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStoreFinderModal({ visible: false, item: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find Stores</Text>
              <TouchableOpacity
                onPress={() => setStoreFinderModal({ visible: false, item: null })}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {storeFinderModal.item && (
              <View style={styles.modalBody}>
                <Text style={styles.modalItemTitle}>{storeFinderModal.item.originalItem}</Text>
                <Text style={styles.modalSubtitle}>
                  {loadingStores
                    ? 'Searching nearby stores...'
                    : `Found ${nearbyStores.length} nearby store${nearbyStores.length !== 1 ? 's' : ''}`}
                </Text>

                {loadingStores ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                  </View>
                ) : (
                  <ScrollView style={styles.storeList}>
                    {nearbyStores.length > 0 ? (
                      nearbyStores.map((store, index) => (
                        <View key={store.id || index} style={styles.storeCard}>
                          <View style={styles.storeHeader}>
                            <View style={styles.storeInfo}>
                              <Text style={styles.storeName}>{store.name}</Text>
                              <Text style={styles.storeAddress}>{store.address}</Text>
                              <View style={styles.storeMetaRow}>
                                <Text style={styles.storeDistance}>
                                  <Ionicons name="location-outline" size={12} color="#666" /> {store.distance} km
                                </Text>
                                {store.rating && (
                                  <Text style={styles.storeRating}>
                                    <Ionicons name="star" size={12} color="#FFB300" /> {store.rating}
                                  </Text>
                                )}
                                {store.isOpen !== undefined && (
                                  <Text style={[styles.storeStatus, store.isOpen && styles.storeOpen]}>
                                    {store.isOpen ? 'Open' : 'Closed'}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                          <View style={styles.storeActions}>
                            <TouchableOpacity
                              style={styles.storeActionButton}
                              onPress={() => openFloodSafeRoute(store)}
                            >
                              <Ionicons name="water" size={16} color="#2196F3" />
                              <Text style={styles.storeActionText}>Flood-Safe Route</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.storeActionButton, styles.directionsButtonGreen]}
                              onPress={() => openDirections(store)}
                            >
                              <Ionicons name="navigate" size={16} color="#4CAF50" />
                              <Text style={[styles.storeActionText, { color: '#4CAF50' }]}>Directions</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.noStoresContainer}>
                        <Ionicons name="storefront-outline" size={48} color="#ccc" />
                        <Text style={styles.noStoresText}>No stores found nearby</Text>
                        <Text style={styles.noStoresSubtext}>Try searching in a different area or category</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Flood-Safe Route Viewer */}
      {selectedStoreForRoute && (
        <FloodSafeRouteViewer
          visible={routeViewerVisible}
          onClose={() => {
            setRouteViewerVisible(false);
            setSelectedStoreForRoute(null);
          }}
          origin={{
            latitude: currentLocation?.latitude || 0,
            longitude: currentLocation?.longitude || 0,
          }}
          destination={{
            lat: selectedStoreForRoute.location.lat,
            lng: selectedStoreForRoute.location.lng,
          }}
          destinationName={selectedStoreForRoute.name}
          state={userProfile.emergencyPreferences?.selectedState}
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
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  progressContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 3,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  personalizationBanner: {
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bannerText: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  scrollContent: {
    maxHeight: 500,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(222, 226, 230, 0.8)',
    marginHorizontal: 16,
  },
  prioritySection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  priorityHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  priorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  priorityProgress: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    alignItems: 'flex-start',
  },
  childItemRow: {
    backgroundColor: 'rgba(254, 247, 247, 0.8)',
  },
  itemCompleted: {
    opacity: 0.6,
  },
  itemCheckbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#6c757d',
  },
  childItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 230, 230, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  childItemBadgeText: {
    fontSize: 10,
    color: '#FF6B6B',
    fontWeight: '500',
    marginLeft: 2,
  },
  itemDetails: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  itemDetail: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  findStoresButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 245, 232, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  findStoresText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  mobilityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 243, 224, 0.8)',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  mobilityText: {
    fontSize: 11,
    color: '#e65100',
    lineHeight: 14,
    marginLeft: 6,
    flex: 1,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  storeList: {
    maxHeight: 300,
  },
  storeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  storeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 245, 232, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  storeDetails: {
    flex: 1,
  },
  storeCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 2,
  },
  storeAction: {
    fontSize: 12,
    color: '#6c757d',
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 242, 253, 0.8)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  locationWarningText: {
    fontSize: 12,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
  },
  storeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  storeHeader: {
    marginBottom: 10,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 6,
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  storeDistance: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  storeRating: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  storeStatus: {
    fontSize: 11,
    color: '#dc3545',
    fontWeight: '500',
  },
  storeOpen: {
    color: '#28a745',
  },
  storeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  storeActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227, 242, 253, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  directionsButtonGreen: {
    backgroundColor: 'rgba(232, 245, 232, 0.8)',
  },
  storeActionText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 6,
  },
  noStoresContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noStoresText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginTop: 12,
  },
  noStoresSubtext: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default EmergencyKit;