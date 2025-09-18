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
import LocationManager from '../services/LocationManager';
import ChildPersonalizationService from '../services/ChildPersonalizationService';
import ChildSummaryBanner from './ChildSummaryBanner';
import ComfortItemsTracker from './ComfortItemsTracker';
import { UserContext } from '../context/UserContext';

const { width } = Dimensions.get('window');

const EmergencyKit = ({ emergencyKitData }) => {
  const { userProfile, updateUserProfile } = useContext(UserContext);
  const [expanded, setExpanded] = useState(false);
  const [completedItems, setCompletedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [storeFinderModal, setStoreFinderModal] = useState({ visible: false, item: null });

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

      const location = await LocationManager.getCurrentLocation({
        priority: 'fast',
        allowStale: true,
        showError: false
      });

      if (location) {
        setCurrentLocation({
          latitude: location.latitude,
          longitude: location.longitude
        });
        console.log('✅ EmergencyKit: Location acquired for store finder');
      }
    } catch (error) {
      console.log('📍 EmergencyKit: Location failed for store finder:', error.message);

      // Don't block the UI, just log the issue
      // Google Maps will work without precise location using general search
    }
  };

  const getShopCategories = (whereToShop) => {
    if (!whereToShop) return [];

    const shopMapping = {
      'Grocery store': { searchTerm: 'grocery store', icon: 'storefront-outline' },
      'bulk stores': { searchTerm: 'warehouse store', icon: 'cube-outline' },
      'camping stores': { searchTerm: 'outdoor store', icon: 'hardware-chip-outline' },
      'Pharmacy': { searchTerm: 'pharmacy', icon: 'medical-outline' },
      'department stores': { searchTerm: 'department store', icon: 'business-outline' },
      'Office supply stores': { searchTerm: 'office supply store', icon: 'document-outline' },
      'Hardware store': { searchTerm: 'hardware store', icon: 'hammer-outline' },
      'Electronics': { searchTerm: 'electronics store', icon: 'phone-portrait-outline' },
      'Any store with electronics': { searchTerm: 'electronics store', icon: 'phone-portrait-outline' },
      'Sporting goods': { searchTerm: 'sporting goods store', icon: 'fitness-outline' },
      'Bank': { searchTerm: 'bank', icon: 'card-outline' },
      'ATM': { searchTerm: 'ATM', icon: 'card-outline' },
      'Outdoor stores': { searchTerm: 'outdoor store', icon: 'hardware-chip-outline' }
    };

    const categories = [];
    const shopText = whereToShop.toLowerCase();

    Object.keys(shopMapping).forEach(key => {
      if (shopText.includes(key.toLowerCase())) {
        categories.push({
          ...shopMapping[key],
          category: key
        });
      }
    });

    // Remove duplicates based on searchTerm
    return categories.filter((category, index, self) =>
      index === self.findIndex(c => c.searchTerm === category.searchTerm)
    );
  };

  const openGoogleMaps = (searchTerm) => {
    const query = encodeURIComponent(searchTerm);
    let url;

    if (currentLocation) {
      // Use precise location if available
      const { latitude, longitude } = currentLocation;
      url = `https://www.google.com/maps/search/${query}/@${latitude},${longitude},15z`;
      console.log('📍 EmergencyKit: Opening Google Maps with precise location');
    } else {
      // Fallback to general area search (will work without precise location)
      url = `https://www.google.com/maps/search/${query}+near+me`;
      console.log('📍 EmergencyKit: Opening Google Maps with general area search');
    }

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open Google Maps. Please try again or search manually.');
    });
  };

  const showStoreFinder = (item) => {
    setStoreFinderModal({ visible: true, item });
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
        <View style={[styles.priorityHeader, { backgroundColor: color + '20' }]}>
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
                  onPress={() => showStoreFinder(item)}
                >
                  <Ionicons name="map-outline" size={14} color="#4CAF50" />
                  <Text style={styles.findStoresText}>Find Stores</Text>
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
                <Text style={styles.modalSubtitle}>Available at these store types:</Text>

                <ScrollView style={styles.storeList}>
                  {getShopCategories(storeFinderModal.item.whereToShop).map((store, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.storeOption}
                      onPress={() => {
                        openGoogleMaps(store.searchTerm);
                        setStoreFinderModal({ visible: false, item: null });
                      }}
                    >
                      <View style={styles.storeIconContainer}>
                        <Ionicons name={store.icon} size={24} color="#4CAF50" />
                      </View>
                      <View style={styles.storeDetails}>
                        <Text style={styles.storeCategory}>{store.category}</Text>
                        <Text style={styles.storeAction}>Tap to find nearby on Google Maps</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {!currentLocation && (
                  <View style={styles.locationWarning}>
                    <Ionicons name="information-circle-outline" size={16} color="#2196F3" />
                    <Text style={styles.locationWarningText}>
                      No precise location - will search your general area
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
  },
  personalizationBanner: {
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#dee2e6',
    marginHorizontal: 16,
  },
  prioritySection: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
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
    backgroundColor: '#fef7f7',
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
    backgroundColor: '#ffe6e6',
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
    backgroundColor: '#e8f5e8',
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
    backgroundColor: '#fff3e0',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#e8f5e8',
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
    backgroundColor: '#e3f2fd',
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
});

export default EmergencyKit;