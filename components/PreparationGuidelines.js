import React, { useState, useEffect, useContext } from 'react';
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
import { UserContext } from '../context/UserContext';
import ChildPersonalizationService from '../services/ChildPersonalizationService';
import ChildSummaryBanner from './ChildSummaryBanner';

const { width } = Dimensions.get('window');

const PreparationGuidelines = () => {
  const { userProfile, updateUserProfile } = useContext(UserContext);
  const [expanded, setExpanded] = useState(false);
  const [completedSections, setCompletedSections] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadProgress();
  }, []);

  // Auto-update child categorization when children ages change
  useEffect(() => {
    if (userProfile.hasChildren && userProfile.childrenAges) {
      ChildPersonalizationService.updateChildCategorization(userProfile, updateUserProfile);
    }
  }, [userProfile.childrenAges, userProfile.hasChildren]);

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

  const getChildSpecificSections = () => {
    const { hasChildren, hasInfants, hasToddlers, hasSchoolChildren, hasTeens, childrenDetails = [] } = userProfile;

    if (!hasChildren) return [];

    const childSections = [];

    // Child Safety Planning section
    childSections.push({
      id: 'child_safety_planning',
      title: 'Plan child safety and comfort measures',
      timeEstimate: '20 min',
      icon: 'shield-checkmark',
      color: '#FF6B6B',
      category: 'Child Safety',
      isChildSection: true,
      tasks: [
        'Create child identification cards with emergency contacts',
        'Pack comfort items (favorite toys, blankets) for each child',
        'Practice evacuation routes with children',
        'Teach children how to dial emergency numbers',
        'Prepare age-appropriate entertainment for stress relief'
      ]
    });

    // School coordination section for school-age children
    if (hasSchoolChildren || hasTeens) {
      childSections.push({
        id: 'school_coordination',
        title: 'Coordinate with schools and childcare',
        timeEstimate: '15 min',
        icon: 'school',
        color: '#4ECDC4',
        category: 'Child Safety',
        isChildSection: true,
        tasks: [
          'Update emergency contacts at school/childcare',
          'Review school emergency procedures with children',
          'Establish child pickup plan with authorized persons',
          'Share family emergency plan with school',
          'Ensure children know safe meeting locations'
        ]
      });
    }

    // Infant/toddler specific preparation
    if (hasInfants || hasToddlers) {
      childSections.push({
        id: 'infant_toddler_prep',
        title: 'Prepare supplies for infants and toddlers',
        timeEstimate: '25 min',
        icon: 'baby',
        color: '#FFB347',
        category: 'Child Safety',
        isChildSection: true,
        tasks: [
          'Pack 72-hour supply of diapers and formula',
          'Organize baby food, bottles, and feeding supplies',
          'Include favorite pacifiers and comfort objects',
          'Prepare portable crib or travel bed',
          'Pack extra clothes and blankets for temperature changes'
        ]
      });
    }

    // Children's emergency communication section
    if (hasChildren) {
      childSections.push({
        id: 'child_communication',
        title: 'Set up child communication plan',
        timeEstimate: '15 min',
        icon: 'chatbubbles',
        color: '#A78BFA',
        category: 'Child Safety',
        isChildSection: true,
        tasks: [
          'Teach children family emergency contact numbers',
          'Practice using emergency communication devices',
          'Create simple emergency instruction cards for children',
          'Establish check-in procedures for older children',
          'Plan for children who may be separated from family'
        ]
      });
    }

    return childSections;
  };

  const baseSections = [
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
        userProfile.hasChildren ? 'Store infant formula and baby food if needed' : 'Store infant formula if needed'
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
        userProfile.hasChildren ? 'Include children\'s birth certificates and medical records' : 'Include contact information for family and doctors'
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
        userProfile.hasChildren ? 'Include children\'s school and childcare contacts' : 'Share contact list with all family members',
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
        userProfile.hasChildren ? 'Practice evacuation with all family members, including children' : 'Practice evacuation with all family members',
        'Plan for pets and livestock',
        'Keep vehicle gas tanks at least half full'
      ]
    }
  ];

  // Combine base sections with child-specific sections
  const childSections = getChildSpecificSections();
  const preparationSections = [...baseSections, ...childSections];

  const totalSections = preparationSections.length;
  const completedCount = Object.values(completedSections).filter(Boolean).length;
  const progressPercentage = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  const totalEstimatedTime = preparationSections
    .filter(section => !completedSections[section.id])
    .reduce((total, section) => {
      const timeMatch = section.timeEstimate.match(/(\d+)/);
      const baseTime = timeMatch ? parseInt(timeMatch[0]) : 5;

      // Apply child-specific time adjustments
      const adjustedTime = ChildPersonalizationService.calculateChildAdjustedTime(baseTime, userProfile);

      return total + adjustedTime;
    }, 0);

  const renderPreparationSection = (section) => {
    const isCompleted = completedSections[section.id];
    const isExpanded = expandedSections[section.id];

    return (
      <View key={section.id} style={[
        styles.sectionContainer,
        section.isChildSection && styles.childSectionContainer
      ]}>
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
              <View style={styles.sectionTitleRow}>
                <Text style={[
                  styles.sectionTitle,
                  isCompleted && styles.sectionTitleCompleted
                ]}>
                  {section.title}
                </Text>
                {section.isChildSection && (
                  <View style={styles.childSectionBadge}>
                    <Ionicons name="people-outline" size={10} color="#FF6B6B" />
                    <Text style={styles.childSectionBadgeText}>Child</Text>
                  </View>
                )}
              </View>
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
                  {preparationSections.length}-step personalized plan
                  {userProfile.hasChildren && ` with child safety measures`}
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
                  {userProfile.hasChildren && ', including child-specific safety measures'}
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

            {/* Child Summary Banner */}
            <ChildSummaryBanner
              userProfile={userProfile}
              showTimeAdjustment={true}
              estimatedTime={totalEstimatedTime}
            />

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
  childSectionContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
    backgroundColor: '#FFF8F8',
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
    flex: 1,
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
  childSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFCCCB',
  },
  childSectionBadgeText: {
    fontSize: 9,
    color: '#FF6B6B',
    fontWeight: '600',
    marginLeft: 2,
  },
});

export default PreparationGuidelines;