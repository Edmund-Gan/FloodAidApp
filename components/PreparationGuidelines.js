import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const PreparationGuidelines = () => {
  const [expanded, setExpanded] = useState(false);
  const [completedSections, setCompletedSections] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem('preparationGuidelinesProgress');
      if (stored) {
        setCompletedSections(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Error loading preparation guidelines progress:', error);
    }
  };

  const saveProgress = async (newProgress) => {
    try {
      await AsyncStorage.setItem('preparationGuidelinesProgress', JSON.stringify(newProgress));
      setCompletedSections(newProgress);
    } catch (error) {
      console.log('Error saving preparation guidelines progress:', error);
    }
  };

  const toggleSection = (sectionId) => {
    const newProgress = {
      ...completedSections,
      [sectionId]: !completedSections[sectionId]
    };
    saveProgress(newProgress);
  };

  const toggleSectionExpansion = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const preparationSections = [
    {
      id: 'water_storage',
      title: 'Check water storage (3 days minimum)',
      timeEstimate: '5 min',
      icon: 'water',
      color: '#2196F3',
      category: 'Emergency Supplies',
      tasks: [
        'Store 4 liters per person per day for 3 days',
        'Use food-grade water storage containers',
        'Replace stored water every 6 months',
        'Keep water purification tablets as backup',
        'Store in cool, dark place away from toxic materials'
      ]
    },
    {
      id: 'food_supplies',
      title: 'Verify food supplies (non-perishable)',
      timeEstimate: '10 min',
      icon: 'nutrition',
      color: '#4CAF50',
      category: 'Emergency Supplies',
      tasks: [
        'Stock canned goods and dry foods for 3 days',
        'Include manual can opener and utensils',
        'Check expiration dates and rotate stock',
        'Pack comfort foods and special dietary items',
        'Store infant formula if needed'
      ]
    },
    {
      id: 'flashlights_batteries',
      title: 'Test flashlights and batteries',
      timeEstimate: '5 min',
      icon: 'flashlight',
      color: '#FF9800',
      category: 'Emergency Supplies',
      tasks: [
        'Test all flashlights and replace dead batteries',
        'Pack extra batteries for all devices',
        'Include hand-crank or solar-powered radio',
        'Pack glow sticks as backup lighting',
        'Ensure one flashlight per family member'
      ]
    },
    {
      id: 'important_documents',
      title: 'Secure important documents in waterproof bag',
      timeEstimate: '15 min',
      icon: 'document-text',
      color: '#9C27B0',
      category: 'Documents',
      tasks: [
        'Gather identification documents (IC, passport)',
        'Include insurance policies and medical records',
        'Copy bank account and credit card information',
        'Store digital copies on encrypted USB drive',
        'Include contact information for family and doctors'
      ]
    },
    {
      id: 'mobile_devices',
      title: 'Charge all mobile devices',
      timeEstimate: '5 min',
      icon: 'phone-portrait',
      color: '#607D8B',
      category: 'Communication',
      tasks: [
        'Charge all phones and tablets to 100%',
        'Pack portable power banks and charging cables',
        'Download offline maps and emergency apps',
        'Enable emergency contact information on lock screen',
        'Test emergency alert settings'
      ]
    },
    {
      id: 'first_aid',
      title: 'Check first aid kit and medications',
      timeEstimate: '10 min',
      icon: 'medical',
      color: '#F44336',
      category: 'Medical',
      tasks: [
        'Verify first aid supplies are complete and current',
        'Pack 7-day supply of prescription medications',
        'Include over-the-counter pain relievers',
        'Pack emergency medical information',
        'Include emergency glasses/contacts if needed'
      ]
    },
    {
      id: 'emergency_contacts',
      title: 'Update emergency contact list',
      timeEstimate: '10 min',
      icon: 'call',
      color: '#795548',
      category: 'Communication',
      tasks: [
        'Create written list of emergency numbers',
        'Include family, friends, and local authorities',
        'Add medical providers and insurance contacts',
        'Share contact list with all family members',
        'Post copy in accessible location'
      ]
    },
    {
      id: 'evacuation_plan',
      title: 'Review evacuation routes and meeting points',
      timeEstimate: '15 min',
      icon: 'navigate',
      color: '#3F51B5',
      category: 'Planning',
      tasks: [
        'Identify primary and alternate evacuation routes',
        'Choose meeting points near home and neighborhood',
        'Practice evacuation with all family members',
        'Plan for pets and livestock',
        'Keep vehicle gas tanks at least half full'
      ]
    }
  ];

  const totalSections = preparationSections.length;
  const completedCount = Object.values(completedSections).filter(Boolean).length;
  const progressPercentage = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  const totalEstimatedTime = preparationSections
    .filter(section => !completedSections[section.id])
    .reduce((total, section) => {
      const timeMatch = section.timeEstimate.match(/(\d+)/);
      return total + (timeMatch ? parseInt(timeMatch[0]) : 5);
    }, 0);

  const renderPreparationSection = (section) => {
    const isCompleted = completedSections[section.id];
    const isExpanded = expandedSections[section.id];

    return (
      <View key={section.id} style={styles.sectionContainer}>
        <TouchableOpacity
          style={[
            styles.sectionHeader,
            isCompleted && styles.sectionHeaderCompleted
          ]}
          onPress={() => toggleSectionExpansion(section.id)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionLeft}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => toggleSection(section.id)}
            >
              <Ionicons
                name={isCompleted ? 'checkbox' : 'square-outline'}
                size={24}
                color={isCompleted ? '#4CAF50' : '#666'}
              />
            </TouchableOpacity>
            <View style={[styles.sectionIcon, { backgroundColor: section.color + '20' }]}>
              <Ionicons name={section.icon} size={20} color={section.color} />
            </View>
            <View style={styles.sectionInfo}>
              <Text style={[
                styles.sectionTitle,
                isCompleted && styles.sectionTitleCompleted
              ]}>
                {section.title}
              </Text>
              <View style={styles.sectionMeta}>
                <Text style={styles.sectionCategory}>{section.category}</Text>
                <Text style={styles.sectionTime}>{section.timeEstimate}</Text>
              </View>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {section.tasks.map((task, index) => (
              <View key={index} style={styles.taskRow}>
                <View style={styles.taskBullet}>
                  <View style={[styles.bullet, { backgroundColor: section.color }]} />
                </View>
                <Text style={styles.taskText}>{task}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#9C27B0', '#7B1FA2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="time" size={28} color="#fff" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Preparation Guidelines</Text>
                <Text style={styles.headerSubtitle}>
                  4-step personalized plan
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>{completedCount}/{totalSections}</Text>
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

          {!expanded && totalEstimatedTime > 0 && (
            <View style={styles.timeEstimate}>
              <Ionicons name="time-outline" size={14} color="#fff" />
              <Text style={styles.timeText}>
                Est. {totalEstimatedTime} min total
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
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Flood Preparedness Checklist</Text>
                <Text style={styles.summarySubtitle}>
                  Complete these essential preparation steps to ensure your family's safety
                </Text>
              </View>

              <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{completedCount}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{totalSections - completedCount}</Text>
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{totalEstimatedTime}m</Text>
                  <Text style={styles.statLabel}>Est. Time</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionsContainer}>
              {preparationSections.map(renderPreparationSection)}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Preparation guidelines based on Malaysian emergency management best practices
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
    maxHeight: 500,
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
  summaryHeader: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  sectionsContainer: {
    paddingHorizontal: 16,
  },
  sectionContainer: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  sectionHeaderCompleted: {
    backgroundColor: '#F8F9FA',
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    marginRight: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  sectionTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCategory: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  sectionTime: {
    fontSize: 12,
    color: '#9C27B0',
    fontWeight: '500',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskBullet: {
    marginTop: 6,
    marginRight: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
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
    textAlign: 'center',
  },
});

export default PreparationGuidelines;