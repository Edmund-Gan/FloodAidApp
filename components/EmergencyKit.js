import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext } from '../context/UserContext';

const { width } = Dimensions.get('window');

const EmergencyKit = ({ emergencyKitData }) => {
  const { userProfile } = useContext(UserContext);
  const [expanded, setExpanded] = useState(false);
  const [completedItems, setCompletedItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

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

  const getPersonalizedItems = () => {
    if (!emergencyKitData?.Items) return [];

    const { familySize = 1, hasChildren, healthConditions = [] } = userProfile;
    const hasSpecialMedical = healthConditions.length > 0;

    return emergencyKitData.Items.map((item, index) => {
      let scaledTime = item['Base Prep Time'];
      let scaledQuantity = item.Item;
      let mobilityNote = '';

      if (item['Scaling for More People'] && familySize > 1) {
        if (item['Scaling for More People'].includes('Linear scaling')) {
          if (item.Item.includes('4L/person/day')) {
            scaledQuantity = item.Item.replace('4L/person/day', `${4 * familySize}L total/day`);
          } else if (item['Scaling for More People'].includes('12L')) {
            scaledQuantity = `${item.Item} (${12 * familySize}L for ${familySize} people)`;
          } else if (item.Item.includes('per person')) {
            scaledQuantity = `${item.Item.replace('per person', `for ${familySize} people`)}`;
          }
        } else if (item['Scaling for More People'].includes('per person')) {
          scaledQuantity = `${item.Item} (${familySize} needed)`;
        }
      }

      if (item['Mobility Considerations'] && hasSpecialMedical) {
        mobilityNote = item['Mobility Considerations'];
      }

      return {
        id: `item_${index}`,
        title: scaledQuantity,
        priority: item.Priority,
        prepTime: scaledTime,
        mobilityNote,
        whereToShop: item['Where to Shop'],
        originalItem: item.Item
      };
    });
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
              completedItems[item.id] && styles.itemCompleted
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
              <Text style={[
                styles.itemTitle,
                completedItems[item.id] && styles.itemTitleCompleted
              ]}>
                {item.title}
              </Text>
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
              {item.mobilityNote && (
                <View style={styles.mobilityNote}>
                  <Ionicons name="accessibility-outline" size={12} color="#FF9800" />
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
                  Personalized for {userProfile.familySize} {userProfile.familySize === 1 ? 'person' : 'people'}
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Recommendations personalized for your family profile
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
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
  progressContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
  },
  timeText: {
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
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  prioritySection: {
    marginBottom: 16,
  },
  priorityHeader: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
  },
  priorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  priorityProgress: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemCompleted: {
    backgroundColor: '#F8F9FA',
  },
  itemCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemDetail: {
    fontSize: 12,
    color: '#666',
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobilityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
  },
  mobilityText: {
    fontSize: 11,
    color: '#E65100',
    marginLeft: 4,
    flex: 1,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default EmergencyKit;