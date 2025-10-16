import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext } from '../context/UserContext';
import { useReliableLocation } from '../context/ReliableLocationContext';
import airQualityService from '../services/AirQualityService';
import ReliableLocationService from '../services/ReliableLocationService';

const { width } = Dimensions.get('window');

const FloodRecoveryPlan = ({ recoveryGuideData, currentLocationInfo, offlineMode = false }) => {
  const { userProfile } = useContext(UserContext);
  const { currentLocation } = useReliableLocation();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('assessment');
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [damageAssessment, setDamageAssessment] = useState({
    water_depth: null,
    water_type: null,
    structural_damage: [],
    electrical_damage: [],
    furniture_items: [],
    mold_growth: null,
    insurance_coverage: null,
  });
  const [completedSteps, setCompletedSteps] = useState({});
  const [loading, setLoading] = useState(true);
  const [customTimeline, setCustomTimeline] = useState(null);
  const [airQualityData, setAirQualityData] = useState(null);
  const [airQualityLoading, setAirQualityLoading] = useState(false);
  const [airQualityModalVisible, setAirQualityModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all, critical, incomplete, today
  const [expandedCategories, setExpandedCategories] = useState({});
  const [quickAssessmentMode, setQuickAssessmentMode] = useState(false);

  useEffect(() => {
    loadSavedData();
  }, []);

  useEffect(() => {
    if (assessmentCompleted && damageAssessment.water_depth) {
      calculateCustomTimeline();
    }
  }, [assessmentCompleted, damageAssessment, userProfile]);

  useEffect(() => {
    fetchAirQualityData();
  }, [currentLocationInfo?.lat, currentLocationInfo?.lon, currentLocation?.latitude, currentLocation?.longitude]);

  const fetchAirQualityData = async () => {
    setAirQualityLoading(true);
    try {
      let locationToUse = null;

      if (currentLocationInfo?.lat && currentLocationInfo?.lon) {
        locationToUse = {
          lat: currentLocationInfo.lat,
          lon: currentLocationInfo.lon
        };
      }
      else if (currentLocation?.latitude && currentLocation?.longitude) {
        locationToUse = {
          lat: currentLocation.latitude,
          lon: currentLocation.longitude
        };
      }
      else {
        const locationResult = await ReliableLocationService.getCurrentLocation({
          forceRefresh: true,
          enableHighAccuracy: true,
        });

        if (locationResult?.lat && locationResult?.lon) {
          locationToUse = {
            lat: locationResult.lat,
            lon: locationResult.lon
          };
        }
      }

      if (locationToUse) {
        const airQuality = await airQualityService.getAirQuality(
          locationToUse.lat,
          locationToUse.lon
        );
        setAirQualityData(airQuality);
      } else {
        const airQuality = await airQualityService.getAirQuality(3.139, 101.6869);
        setAirQualityData(airQuality);
      }
    } catch (error) {
      console.error('Error fetching air quality:', error);
      setAirQualityData(null);
    } finally {
      setAirQualityLoading(false);
    }
  };

  const loadSavedData = async () => {
    try {
      const [savedAssessment, savedProgress, savedCompleted] = await Promise.all([
        AsyncStorage.getItem('floodRecoveryAssessment'),
        AsyncStorage.getItem('floodRecoveryProgress'),
        AsyncStorage.getItem('floodRecoveryAssessmentCompleted'),
      ]);

      console.log('[FloodRecovery] Loading saved data:', {
        hasAssessment: !!savedAssessment,
        completedFlag: savedCompleted,
      });

      if (savedAssessment) {
        const assessment = JSON.parse(savedAssessment);

        // Migration: If there's saved assessment data but no completion flag,
        // assume it's incomplete (from old version)
        console.log('[FloodRecovery] Assessment data:', {
          water_depth: assessment.water_depth,
          water_type: assessment.water_type,
          hasCompletionFlag: savedCompleted !== null,
        });

        setDamageAssessment(assessment);
        setAssessmentStarted(true);

        // Only switch to timeline if assessment was EXPLICITLY marked as completed
        // This prevents old incomplete assessments from auto-completing
        if (savedCompleted === 'true') {
          console.log('[FloodRecovery] Assessment marked as completed, switching to timeline');
          setAssessmentCompleted(true);
          setActiveTab('timeline');
        } else {
          console.log('[FloodRecovery] Assessment incomplete or no completion flag, staying on assessment tab');
          // Stay on assessment tab to allow user to complete it
          setAssessmentCompleted(false);
        }
      }
      if (savedProgress) {
        setCompletedSteps(JSON.parse(savedProgress));
      }
    } catch (error) {
      console.log('Error loading flood recovery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveDamageAssessment = async (assessment) => {
    try {
      await AsyncStorage.setItem('floodRecoveryAssessment', JSON.stringify(assessment));
      setDamageAssessment(assessment);
    } catch (error) {
      console.log('Error saving damage assessment:', error);
    }
  };

  const saveProgress = async (progress) => {
    try {
      await AsyncStorage.setItem('floodRecoveryProgress', JSON.stringify(progress));
      setCompletedSteps(progress);
    } catch (error) {
      console.log('Error saving recovery progress:', error);
    }
  };

  const calculateCustomTimeline = () => {
    if (!damageAssessment.water_depth || !recoveryGuideData) return;

    const { mobilityAssistance = false, familySize = 1, childrenAges = [] } = userProfile;
    const hasChildren = childrenAges.length > 0;
    const hasInfants = childrenAges.some(age => age < 2);
    const hasToddlers = childrenAges.some(age => age >= 2 && age < 6);
    const hasSchoolChildren = childrenAges.some(age => age >= 6 && age <= 12);

    const waterDepthOption = recoveryGuideData.damage_assessment.categories
      .find(cat => cat.id === 'water_depth')
      ?.options.find(opt => opt.id === damageAssessment.water_depth);

    let baseTimeline = waterDepthOption?.timeline_impact?.total_days || 7;
    let cleanupDays = waterDepthOption?.timeline_impact?.cleanup_days || 2;
    let dryingDays = waterDepthOption?.timeline_impact?.drying_days || 5;

    let additionalDays = 0;

    damageAssessment.structural_damage.forEach(damageId => {
      const damage = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'structural_damage')
        ?.options.find(opt => opt.id === damageId);
      if (damage?.timeline_addition_days) {
        additionalDays += damage.timeline_addition_days;
      }
    });

    damageAssessment.electrical_damage.forEach(damageId => {
      const damage = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'electrical_damage')
        ?.options.find(opt => opt.id === damageId);
      if (damage?.timeline_addition_days) {
        additionalDays += damage.timeline_addition_days;
      }
    });

    damageAssessment.furniture_items.forEach(itemId => {
      const item = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'furniture_items')
        ?.options.find(opt => opt.id === itemId);
      if (item?.timeline_addition_days) {
        additionalDays += item.timeline_addition_days;
      }
    });

    if (damageAssessment.mold_growth) {
      const moldOption = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'mold_growth')
        ?.options.find(opt => opt.id === damageAssessment.mold_growth);
      if (moldOption?.timeline_addition_days) {
        additionalDays += moldOption.timeline_addition_days;
      }
    }

    let totalDays = baseTimeline + additionalDays;

    let adjustmentMultiplier = 1.0;
    const adjustmentReasons = [];

    if (mobilityAssistance) {
      adjustmentMultiplier += 0.5;
      adjustmentReasons.push('mobility assistance (+50%)');
    }

    if (familySize > 1) {
      const familyImpact = (familySize - 1) * 0.1;
      adjustmentMultiplier += familyImpact;
      adjustmentReasons.push(`${familySize} household members (+${Math.round(familyImpact * 100)}%)`);
    }

    if (hasChildren) {
      const childrenImpact = childrenAges.length * 0.2;
      adjustmentMultiplier += childrenImpact;
      adjustmentReasons.push(`${childrenAges.length} children (+${Math.round(childrenImpact * 100)}%)`);

      if (hasInfants || hasToddlers) {
        adjustmentMultiplier += 0.3;
        adjustmentReasons.push('young children supervision (+30%)');
      } else if (hasSchoolChildren) {
        adjustmentMultiplier += 0.15;
        adjustmentReasons.push('school-age children supervision (+15%)');
      }
    }

    totalDays = Math.ceil(totalDays * adjustmentMultiplier);
    cleanupDays = Math.ceil(cleanupDays * adjustmentMultiplier);
    dryingDays = Math.ceil(dryingDays * adjustmentMultiplier);

    const immediateDays = 3;
    const cleanupPhaseDays = cleanupDays;
    const dryingPhaseDays = dryingDays;
    const restorationDays = Math.max(totalDays - immediateDays - cleanupPhaseDays - dryingPhaseDays, 7);

    setCustomTimeline({
      totalDays,
      adjustmentReasons,
      phases: {
        immediate: { days: immediateDays, label: 'Day 1-3' },
        cleanup: { days: cleanupPhaseDays, label: `Day 4-${3 + cleanupPhaseDays}` },
        drying: { days: dryingPhaseDays, label: `Day ${4 + cleanupPhaseDays}-${3 + cleanupPhaseDays + dryingPhaseDays}` },
        restoration: { days: restorationDays, label: `Week ${Math.ceil((4 + cleanupPhaseDays + dryingPhaseDays) / 7)}-${Math.ceil(totalDays / 7)}` },
      },
      needsProfessionalHelp: checkProfessionalHelp(),
    });
  };

  const checkProfessionalHelp = () => {
    const professionals = [];

    if (damageAssessment.structural_damage.includes('foundation') ||
        damageAssessment.structural_damage.includes('walls_cracks')) {
      professionals.push({
        type: 'Structural Engineer / Jurutera Struktur',
        reason: 'Foundation or structural damage detected',
        urgent: true,
      });
    }

    if (damageAssessment.electrical_damage.includes('breaker_box') ||
        damageAssessment.electrical_damage.includes('wiring_exposed')) {
      professionals.push({
        type: 'Licensed Electrician / Juruelektrik Berlesen',
        reason: 'Electrical system damage detected',
        urgent: true,
      });
    }

    if (damageAssessment.water_type === 'sewage_water') {
      professionals.push({
        type: 'Professional Cleaning Company / Syarikat Pembersihan Profesional',
        reason: 'Sewage contamination requires professional sanitization',
        urgent: false,
      });
    }

    if (damageAssessment.mold_growth === 'large_areas' ||
        damageAssessment.mold_growth === 'widespread') {
      professionals.push({
        type: 'Mold Remediation Specialist / Pakar Pembersihan Kulat',
        reason: 'Extensive mold growth detected',
        urgent: false,
      });
    }

    return professionals;
  };

  const getRelevantCategories = () => {
    if (!recoveryGuideData?.categories) return [];

    const { water_depth, water_type, structural_damage, electrical_damage, mold_growth, furniture_items, insurance_coverage } = damageAssessment;

    // Map categories to phases for Timeline alignment
    const categoryPhaseMap = {
      immediate_safety: 'immediate',
      safety_protection: 'immediate',
      water_debris_removal: 'cleanup',
      sorting_sanitization: 'cleanup',
      drying_ventilation: 'drying',
      documentation_insurance: 'immediate', // ongoing but starts immediately
      health_hygiene: 'cleanup',
      utilities_services: 'restoration'
    };

    // Always show all categories, but mark applicability
    let categories = recoveryGuideData.categories.map(category => {
      let isApplicable = true;
      let applicabilityReason = '';

      // Always applicable categories
      if (['immediate_safety', 'safety_protection'].includes(category.id)) {
        isApplicable = true;
        applicabilityReason = 'Critical for all flood situations';
      }
      // Check if category is triggered by user's damage assessment
      else if (category.triggered_by_damage) {
        const isTriggered = category.triggered_by_damage.some(trigger => {
          if (trigger === 'water_depth.*' && water_depth) return true;
          if (trigger === 'water_type.*' && water_type) return true;
          if (trigger.startsWith('water_type.') && trigger.includes(water_type)) return true;
          if (trigger.startsWith('structural_damage.') && structural_damage.some(d => trigger.includes(d))) return true;
          if (trigger.startsWith('electrical_damage.') && electrical_damage.some(d => trigger.includes(d))) return true;
          if (trigger.startsWith('mold_growth.') && trigger.includes(mold_growth)) return true;
          if (trigger.startsWith('furniture_items.') && furniture_items.some(d => trigger.includes(d))) return true;
          if (trigger.startsWith('insurance_coverage.') && trigger.includes(insurance_coverage)) return true;
          return false;
        });

        isApplicable = isTriggered;
        if (!isTriggered) {
          // Provide helpful reason why it's optional
          if (category.id === 'drying_ventilation') {
            applicabilityReason = 'Important for preventing mold - recommended for all floods';
            isApplicable = true; // Override - drying is always important
          } else if (category.id === 'utilities_services') {
            applicabilityReason = electrical_damage.length > 0 ? 'Critical due to electrical damage' : 'Optional - utility restoration';
          } else if (category.id === 'sorting_sanitization') {
            applicabilityReason = furniture_items.length > 0 ? 'Critical for damaged items' : 'Optional if no items damaged';
          } else if (category.id === 'documentation_insurance') {
            applicabilityReason = insurance_coverage ? 'Critical for insurance claims' : 'Optional - no insurance indicated';
          } else if (category.id === 'health_hygiene') {
            applicabilityReason = water_type === 'sewage_water' || water_type === 'river_water' ? 'Critical due to contaminated water' : 'Recommended for health safety';
            isApplicable = true; // Override - health is always important
          }
        } else {
          applicabilityReason = 'Required based on your damage assessment';
        }
      } else {
        // No trigger specified - always show
        isApplicable = true;
        applicabilityReason = 'Recommended for all flood recovery';
      }

      return {
        ...category,
        isApplicable,
        applicabilityReason,
        phase: categoryPhaseMap[category.id] || 'restoration'
      };
    });

    // Apply filters
    if (filterMode === 'critical') {
      categories = categories.filter(cat => cat.priority_en === 'CRITICAL' || cat.priority_en === 'HIGH');
    } else if (filterMode === 'incomplete') {
      categories = categories.filter(cat => {
        const categorySteps = cat.steps || [];
        const completedCount = categorySteps.filter(step =>
          completedSteps[`${cat.id}_step_${step.step_number}`]
        ).length;
        return completedCount < categorySteps.length;
      });
    } else if (filterMode === 'today') {
      // Filter to show current phase categories based on timeline
      const currentPhase = getCurrentPhase().toLowerCase();
      categories = categories.filter(cat =>
        cat.phase === currentPhase || cat.priority_en === 'CRITICAL'
      );
    }

    // Apply search filter
    if (searchQuery) {
      categories = categories.filter(cat => {
        const searchLower = searchQuery.toLowerCase();
        return cat.category_name_en.toLowerCase().includes(searchLower) ||
               cat.brief_description_en.toLowerCase().includes(searchLower) ||
               cat.steps?.some(step =>
                 step.title_en.toLowerCase().includes(searchLower) ||
                 step.brief_en.toLowerCase().includes(searchLower)
               );
      });
    }

    return categories;
  };

  const getTodaysPriorities = () => {
    const categories = getRelevantCategories();
    const priorities = [];

    categories.forEach(category => {
      if (category.priority_en === 'CRITICAL' || category.priority_en === 'HIGH') {
        const incompleteSteps = (category.steps || []).filter(step =>
          !completedSteps[`${category.id}_step_${step.step_number}`]
        );

        if (incompleteSteps.length > 0) {
          priorities.push({
            categoryName: category.category_name_en,
            categoryId: category.id,
            icon: category.icon,
            priority: category.priority_en,
            step: incompleteSteps[0],
          });
        }
      }
    });

    return priorities.slice(0, 3); // Return top 3 priorities
  };

  const isAssessmentValid = () => {
    // Check if required questions are answered
    const requiredQuestions = ['water_depth', 'water_type'];
    return requiredQuestions.every(question => damageAssessment[question] !== null);
  };

  const getRequiredQuestionsStatus = () => {
    if (!recoveryGuideData?.damage_assessment) return { answered: 0, total: 0 };

    const questions = quickAssessmentMode
      ? getQuickAssessmentQuestions()
      : recoveryGuideData.damage_assessment.categories;

    const requiredQuestions = questions.filter(q => q.required);
    const answeredRequired = requiredQuestions.filter(q => {
      const value = damageAssessment[q.id];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== null;
    });

    return {
      answered: answeredRequired.length,
      total: requiredQuestions.length,
    };
  };

  const completeAssessment = async () => {
    console.log('[FloodRecovery] completeAssessment called');

    if (!isAssessmentValid()) {
      console.log('[FloodRecovery] Assessment invalid, showing alert');
      Alert.alert(
        'Incomplete Assessment',
        'Please answer all required questions (marked with *) before completing the assessment.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('[FloodRecovery] Assessment valid, marking as completed');
    try {
      await AsyncStorage.setItem('floodRecoveryAssessmentCompleted', 'true');
      setAssessmentCompleted(true);
      setActiveTab('timeline');
      console.log('[FloodRecovery] Assessment completed and switched to timeline');
    } catch (error) {
      console.log('Error saving assessment completion:', error);
    }
  };

  const handleAssessmentSelection = (categoryId, optionId, isMultiple = false) => {
    console.log('[FloodRecovery] handleAssessmentSelection:', { categoryId, optionId, isMultiple });

    let newAssessment = { ...damageAssessment };

    if (isMultiple) {
      const currentSelections = newAssessment[categoryId] || [];
      if (currentSelections.includes(optionId)) {
        newAssessment[categoryId] = currentSelections.filter(id => id !== optionId);
      } else {
        newAssessment[categoryId] = [...currentSelections, optionId];
      }
    } else {
      newAssessment[categoryId] = optionId;
    }

    console.log('[FloodRecovery] New assessment state:', {
      water_depth: newAssessment.water_depth,
      water_type: newAssessment.water_type,
      assessmentCompleted: assessmentCompleted,
    });

    saveDamageAssessment(newAssessment);
  };

  const toggleStepCompletion = (categoryId, stepNumber) => {
    const stepId = `${categoryId}_step_${stepNumber}`;
    const newProgress = {
      ...completedSteps,
      [stepId]: !completedSteps[stepId],
    };
    saveProgress(newProgress);
  };

  const toggleCategoryExpanded = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const resetAssessment = () => {
    Alert.alert(
      'Reset Assessment',
      'Are you sure you want to reset your damage assessment? This will clear all your progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            console.log('[FloodRecovery] Resetting assessment...');
            await AsyncStorage.multiRemove([
              'floodRecoveryAssessment',
              'floodRecoveryProgress',
              'floodRecoveryAssessmentCompleted'
            ]);
            setDamageAssessment({
              water_depth: null,
              water_type: null,
              structural_damage: [],
              electrical_damage: [],
              furniture_items: [],
              mold_growth: null,
              insurance_coverage: null,
            });
            setCompletedSteps({});
            setCustomTimeline(null);
            setAssessmentStarted(false);
            setAssessmentCompleted(false);
            setActiveTab('assessment');
            console.log('[FloodRecovery] Assessment reset complete');
          },
        },
      ]
    );
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
    setExpanded(true);
  };

  const getQuickAssessmentQuestions = () => {
    if (!recoveryGuideData?.damage_assessment) return [];

    // Return only the 3 most critical questions for quick assessment
    return [
      recoveryGuideData.damage_assessment.categories.find(cat => cat.id === 'water_depth'),
      recoveryGuideData.damage_assessment.categories.find(cat => cat.id === 'water_type'),
      {
        ...recoveryGuideData.damage_assessment.categories.find(cat => cat.id === 'structural_damage'),
        options: [
          { id: 'major_damage', label_en: 'Major structural damage', severity: 'critical' },
          { id: 'minor_damage', label_en: 'Minor damage only', severity: 'moderate' },
          { id: 'no_structural', label_en: 'No structural damage', severity: 'none' },
          { id: 'not_sure', label_en: 'Not sure - need professional assessment', severity: 'moderate' },
        ],
      },
    ].filter(Boolean);
  };

  const renderProgressHeader = () => {
    const totalSteps = getRelevantCategories().reduce((total, category) => {
      return total + (category.steps?.length || 0);
    }, 0);
    const completedCount = Object.values(completedSteps).filter(Boolean).length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    const currentPhase = customTimeline ? getCurrentPhase() : 'Assessment';
    const daysSinceStart = customTimeline ? getDaysSinceStart() : 0;

    return (
      <View style={styles.progressHeader}>
        <View style={styles.progressHeaderContent}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressDay}>Day {daysSinceStart}</Text>
            <Text style={styles.progressPhase}>Phase: {currentPhase}</Text>
          </View>

          <View style={styles.progressRingContainer}>
            <View style={styles.progressRing}>
              <Text style={styles.progressPercentage}>{progressPercentage}%</Text>
            </View>
          </View>

          {!offlineMode && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => setAirQualityModalVisible(true)}
              >
                <Ionicons name="leaf-outline" size={20} color="#2196F3" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const getCurrentPhase = () => {
    if (!customTimeline) return 'Assessment';
    const daysSinceStart = getDaysSinceStart();

    if (daysSinceStart <= 3) return 'Immediate';
    if (daysSinceStart <= 3 + customTimeline.phases.cleanup.days) return 'Cleanup';
    if (daysSinceStart <= 3 + customTimeline.phases.cleanup.days + customTimeline.phases.drying.days) return 'Drying';
    return 'Restoration';
  };

  const getDaysSinceStart = () => {
    // This would typically calculate actual days since flood
    // For demo purposes, returning a static value
    return 2;
  };

  const renderTabBar = () => {
    const tabs = [
      { id: 'assessment', label: assessmentCompleted ? 'Summary' : 'Assessment', icon: 'clipboard-outline' },
      { id: 'timeline', label: 'Timeline', icon: 'calendar-outline', disabled: !assessmentCompleted },
      { id: 'steps', label: 'Steps', icon: 'list-outline', disabled: !assessmentCompleted },
    ];

    return (
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.activeTabButton,
              tab.disabled && styles.disabledTabButton,
            ]}
            onPress={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
          >
            <Ionicons
              name={tab.icon}
              size={24}
              color={tab.disabled ? '#ccc' : (activeTab === tab.id ? '#2196F3' : '#666')}
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.id && styles.activeTabLabel,
              tab.disabled && styles.disabledTabLabel,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderQuickActionCards = () => {
    const priorities = getTodaysPriorities();

    if (priorities.length === 0) return null;

    return (
      <View style={styles.quickActionsContainer}>
        <Text style={styles.quickActionsTitle}>Today's Priorities</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {priorities.map((priority, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.quickActionCard,
                priority.priority === 'CRITICAL' && styles.criticalActionCard,
              ]}
              onPress={() => {
                setActiveTab('steps');
                setExpandedCategories({ [priority.categoryId]: true });
              }}
            >
              <View style={styles.quickActionHeader}>
                <Text style={styles.quickActionIcon}>{priority.icon}</Text>
                <View style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(priority.priority) + '20' },
                ]}>
                  <Text style={[
                    styles.priorityBadgeText,
                    { color: getPriorityColor(priority.priority) },
                  ]}>
                    {priority.priority}
                  </Text>
                </View>
              </View>
              <Text style={styles.quickActionCategory}>{priority.categoryName}</Text>
              <Text style={styles.quickActionStep} numberOfLines={2}>
                {priority.step.title_en}
              </Text>
              <View style={styles.quickActionButton}>
                <Text style={styles.quickActionButtonText}>Start</Text>
                <Ionicons name="arrow-forward" size={16} color="#2196F3" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAssessmentTab = () => {
    if (!recoveryGuideData?.damage_assessment) return null;

    const questions = quickAssessmentMode ? getQuickAssessmentQuestions() : recoveryGuideData.damage_assessment.categories;
    const requiredStatus = getRequiredQuestionsStatus();
    const isValid = isAssessmentValid();

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.assessmentScrollContent}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {!assessmentCompleted ? (
          <>
            <View style={styles.assessmentModeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, !quickAssessmentMode && styles.activeModeButton]}
                onPress={() => setQuickAssessmentMode(false)}
              >
                <Text style={[styles.modeButtonText, !quickAssessmentMode && styles.activeModeButtonText]}>
                  Full Assessment
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, quickAssessmentMode && styles.activeModeButton]}
                onPress={() => setQuickAssessmentMode(true)}
              >
                <Text style={[styles.modeButtonText, quickAssessmentMode && styles.activeModeButtonText]}>
                  Quick (3 Questions)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.assessmentTitle}>
              {quickAssessmentMode ? 'Quick Damage Assessment' : 'Comprehensive Damage Assessment'}
            </Text>
            <Text style={styles.assessmentSubtitle}>
              {quickAssessmentMode
                ? 'Answer 3 key questions for a basic recovery plan'
                : recoveryGuideData.damage_assessment.description_en}
            </Text>

            {/* Progress Indicator */}
            <View style={styles.assessmentProgressContainer}>
              <View style={styles.assessmentProgressBar}>
                <View
                  style={[
                    styles.assessmentProgressFill,
                    {
                      width: requiredStatus.total > 0
                        ? `${(requiredStatus.answered / requiredStatus.total) * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.assessmentProgressText}>
                {requiredStatus.answered} of {requiredStatus.total} required questions answered
              </Text>
            </View>

            {questions.map((category, index) => {
              const isMultiple = category.type === 'multiple_choice';
              const currentValue = damageAssessment[category.id];
              const hasSelection = isMultiple ? currentValue?.length > 0 : currentValue !== null;

              return (
                <View key={category.id} style={styles.assessmentCategory}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>
                      {index + 1}. {category.category_en}
                      {category.required && <Text style={styles.requiredMark}> *</Text>}
                    </Text>
                    {isMultiple && (
                      <Text style={styles.multipleChoiceNote}>(Select all that apply)</Text>
                    )}
                  </View>

                  <View style={styles.optionsGrid}>
                    {category.options.map(option => {
                      const isSelected = isMultiple
                        ? currentValue?.includes(option.id)
                        : currentValue === option.id;

                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.assessmentOption,
                            isSelected && styles.assessmentOptionSelected,
                          ]}
                          onPress={() => handleAssessmentSelection(category.id, option.id, isMultiple)}
                        >
                          <Ionicons
                            name={isMultiple
                              ? (isSelected ? 'checkbox' : 'square-outline')
                              : (isSelected ? 'radio-button-on' : 'radio-button-off')
                            }
                            size={22}
                            color={isSelected ? '#2196F3' : '#999'}
                          />
                          <Text style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}>
                            {option.label_en}
                          </Text>
                          {option.severity && (
                            <View style={[
                              styles.severityIndicator,
                              { backgroundColor: getSeverityColor(option.severity) },
                            ]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Complete Assessment Button */}
            <View style={styles.completeAssessmentContainer}>
              <TouchableOpacity
                style={[
                  styles.completeAssessmentButton,
                  !isValid && styles.completeAssessmentButtonDisabled,
                ]}
                onPress={completeAssessment}
                disabled={!isValid}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={isValid ? '#fff' : '#999'}
                />
                <Text
                  style={[
                    styles.completeAssessmentButtonText,
                    !isValid && styles.completeAssessmentButtonTextDisabled,
                  ]}
                >
                  Complete Assessment & View Plan
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={isValid ? '#fff' : '#999'}
                />
              </TouchableOpacity>
              {!isValid && (
                <Text style={styles.completeAssessmentHint}>
                  Please answer all required questions (marked with *) to continue
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.assessmentSummary}>
            <Text style={styles.summaryTitle}>Your Damage Assessment Summary</Text>

            {Object.entries(damageAssessment).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null;

              const category = recoveryGuideData.damage_assessment.categories.find(cat => cat.id === key);
              if (!category) return null;

              return (
                <View key={key} style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{category.category_en}:</Text>
                  <Text style={styles.summaryValue}>
                    {Array.isArray(value)
                      ? value.map(v => category.options.find(o => o.id === v)?.label_en).join(', ')
                      : category.options.find(o => o.id === value)?.label_en}
                  </Text>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetAssessment}
            >
              <Ionicons name="refresh" size={16} color="#FF5252" />
              <Text style={styles.resetButtonText}>Reset Assessment</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderTimelineTab = () => {
    if (!customTimeline) return null;

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.timelineScrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.timelineTotalDays}>
          <Text style={styles.totalDaysNumber}>{customTimeline.totalDays}</Text>
          <Text style={styles.totalDaysLabel}>Total Recovery Days</Text>
        </View>

        <View style={styles.timelinePhases}>
          {Object.entries(customTimeline.phases).map(([phase, data]) => {
            const isCurrentPhase = getCurrentPhase().toLowerCase() === phase;

            return (
              <TouchableOpacity
                key={phase}
                style={[
                  styles.phaseBlock,
                  isCurrentPhase && styles.currentPhaseBlock,
                ]}
                onPress={() => {
                  setActiveTab('steps');
                  // Filter to show relevant categories for this phase
                }}
              >
                <View style={[
                  styles.phaseIndicator,
                  { backgroundColor: getPhaseColor(phase) },
                ]} />
                <View style={styles.phaseContent}>
                  <Text style={styles.phaseName}>{getPhaseTitle(phase)}</Text>
                  <Text style={styles.phaseDate}>{data.label}</Text>
                  <Text style={styles.phaseDays}>{data.days} days</Text>
                </View>
                {isCurrentPhase && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {customTimeline.needsProfessionalHelp.length > 0 && (
          <View style={styles.professionalHelpCard}>
            <View style={styles.professionalHelpHeader}>
              <Ionicons name="warning" size={24} color="#FF6B6B" />
              <Text style={styles.professionalHelpTitle}>Professional Help Required</Text>
            </View>
            {customTimeline.needsProfessionalHelp.map((prof, index) => (
              <View key={index} style={styles.professionalItem}>
                {prof.urgent && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>URGENT</Text>
                  </View>
                )}
                <Text style={styles.professionalType}>{prof.type}</Text>
                <Text style={styles.professionalReason}>{prof.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {customTimeline.adjustmentReasons.length > 0 && (
          <View style={styles.adjustmentCard}>
            <Text style={styles.adjustmentTitle}>Timeline Adjustments</Text>
            {customTimeline.adjustmentReasons.map((reason, index) => (
              <Text key={index} style={styles.adjustmentReason}>• {reason}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderStepsTab = () => {
    const categories = getRelevantCategories();

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.stepsScrollViewContent}
        showsVerticalScrollIndicator={true}
        stickyHeaderIndices={[0, 1]}
      >
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { id: 'all', label: 'All' },
              { id: 'critical', label: 'Critical Only' },
              { id: 'incomplete', label: 'Incomplete' },
              { id: 'today', label: "Today's Tasks" },
            ].map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterButton,
                  filterMode === filter.id && styles.activeFilterButton,
                ]}
                onPress={() => setFilterMode(filter.id)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filterMode === filter.id && styles.activeFilterButtonText,
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recovery steps..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {categories.map(category => {
          const categorySteps = category.steps || [];
          const completedCategorySteps = categorySteps.filter(step =>
            completedSteps[`${category.id}_step_${step.step_number}`]
          ).length;
          const isExpanded = expandedCategories[category.id];
          const isApplicable = category.isApplicable !== false; // Default to true if not set

          return (
            <View key={category.id} style={[
              styles.collapsibleCategory,
              !isApplicable && styles.categoryNotApplicable
            ]}>
              <TouchableOpacity
                style={[
                  styles.categoryCollapsibleHeader,
                  { borderLeftColor: getPriorityColor(category.priority_en) },
                  !isApplicable && styles.categoryHeaderNotApplicable
                ]}
                onPress={() => toggleCategoryExpanded(category.id)}
              >
                <View style={styles.categoryHeaderLeft}>
                  <Text style={[
                    styles.categoryIcon,
                    !isApplicable && styles.iconNotApplicable
                  ]}>{category.icon}</Text>
                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryNameRow}>
                      <Text style={[
                        styles.categoryName,
                        !isApplicable && styles.textNotApplicable
                      ]}>{category.category_name_en}</Text>
                      {category.phase && (
                        <View style={[
                          styles.phaseBadge,
                          { backgroundColor: getPhaseColor(category.phase) + '20' }
                        ]}>
                          <Text style={[
                            styles.phaseBadgeText,
                            { color: getPhaseColor(category.phase) }
                          ]}>
                            {getPhaseTitle(category.phase)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[
                      styles.categoryProgress,
                      !isApplicable && styles.textNotApplicable
                    ]}>
                      {completedCategorySteps}/{categorySteps.length} steps completed
                    </Text>
                    {category.applicabilityReason && (
                      <Text style={[
                        styles.applicabilityReason,
                        !isApplicable && styles.textNotApplicable
                      ]}>
                        {category.applicabilityReason}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.categoryHeaderRight}>
                  <View style={[
                    styles.priorityIndicator,
                    { backgroundColor: getPriorityColor(category.priority_en) + '20' },
                    !isApplicable && styles.priorityIndicatorNotApplicable
                  ]}>
                    <Text style={[
                      styles.priorityText,
                      { color: getPriorityColor(category.priority_en) },
                      !isApplicable && styles.textNotApplicable
                    ]}>
                      {category.priority_en}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={!isApplicable ? '#ccc' : '#666'}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.categorySteps}>
                  {categorySteps.map(step => {
                    const stepId = `${category.id}_step_${step.step_number}`;
                    const isCompleted = completedSteps[stepId];

                    return (
                      <TouchableOpacity
                        key={stepId}
                        style={[
                          styles.stepItem,
                          isCompleted && styles.stepCompleted,
                          !isApplicable && styles.stepNotApplicable
                        ]}
                        onPress={() => toggleStepCompletion(category.id, step.step_number)}
                      >
                        <Ionicons
                          name={isCompleted ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={isCompleted ? '#4CAF50' : (!isApplicable ? '#ccc' : '#999')}
                        />
                        <View style={styles.stepContent}>
                          <Text style={[
                            styles.stepTitle,
                            isCompleted && styles.stepTitleCompleted,
                            !isApplicable && styles.textNotApplicable
                          ]}>
                            {step.title_en}
                          </Text>
                          <Text style={[
                            styles.stepBrief,
                            !isApplicable && styles.textNotApplicable
                          ]}>{step.brief_en}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };


  const renderAirQualityModal = () => {
    return (
      <Modal
        visible={airQualityModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAirQualityModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Air Quality Assessment</Text>
              <TouchableOpacity onPress={() => setAirQualityModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {airQualityLoading ? (
                <View style={styles.airQualityLoading}>
                  <ActivityIndicator size="large" color="#2196F3" />
                  <Text>Fetching air quality data...</Text>
                </View>
              ) : airQualityData ? (
                <View>
                  <View style={[
                    styles.airQualityStatus,
                    { backgroundColor: airQualityData.overallSafety.color + '15' }
                  ]}>
                    <Ionicons
                      name={airQualityData.overallSafety.icon}
                      size={32}
                      color={airQualityData.overallSafety.color}
                    />
                    <View style={styles.airQualityStatusText}>
                      <Text style={[
                        styles.airQualityLevel,
                        { color: airQualityData.overallSafety.color }
                      ]}>
                        {airQualityData.overallSafety.level}
                      </Text>
                      <Text style={styles.airQualityMessage}>
                        {airQualityData.overallSafety.message}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pollutantsGrid}>
                    {Object.keys(airQualityData.pollutants).map(pollutantKey => {
                      const pollutant = airQualityData.pollutants[pollutantKey];
                      return (
                        <View key={pollutantKey} style={styles.pollutantCard}>
                          <Text style={styles.pollutantName}>{pollutant.name}</Text>
                          <Text style={styles.pollutantValue}>
                            {pollutant.value !== null ? pollutant.value : 'N/A'}
                            <Text style={styles.pollutantUnit}> {pollutant.unit}</Text>
                          </Text>
                          <View style={[
                            styles.pollutantStatus,
                            { backgroundColor: pollutant.safetyColor + '20' }
                          ]}>
                            <Text style={{ color: pollutant.safetyColor, fontSize: 10 }}>
                              {pollutant.safetyLevel}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {airQualityData.recommendations && (
                    <View style={styles.recommendationsSection}>
                      <Text style={styles.recommendationsTitle}>Recommendations</Text>
                      {airQualityData.recommendations.map((rec, index) => (
                        <Text key={index} style={styles.recommendationItem}>• {rec}</Text>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.airQualityError}>
                  <Text>Unable to fetch air quality data</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={fetchAirQualityData}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const getSeverityColor = (severity) => {
    const colors = {
      none: '#9E9E9E',
      minor: '#4CAF50',
      moderate: '#FF9800',
      severe: '#FF5722',
      critical: '#F44336',
    };
    return colors[severity] || '#999';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      CRITICAL: '#F44336',
      HIGH: '#FF9800',
      MEDIUM: '#2196F3',
      LOW: '#4CAF50',
    };
    return colors[priority] || '#2196F3';
  };

  const getPhaseColor = (phase) => {
    const colors = {
      immediate: '#F44336',
      cleanup: '#FF9800',
      drying: '#2196F3',
      restoration: '#4CAF50',
    };
    return colors[phase] || '#999';
  };

  const getPhaseTitle = (phase) => {
    const titles = {
      immediate: 'Immediate',
      cleanup: 'Cleanup',
      drying: 'Drying',
      restoration: 'Restoration',
    };
    return titles[phase] || phase;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text>Loading recovery guide...</Text>
        </View>
      </View>
    );
  }

  const totalStepsCount = getRelevantCategories().reduce((total, category) => {
    return total + (category.steps?.length || 0);
  }, 0);
  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#2196F3', '#1976D2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Ionicons name="water" size={28} color="#fff" style={styles.headerIcon} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Recovery Guide</Text>
              <Text style={styles.headerSubtitle}>
                {assessmentStarted && customTimeline
                  ? `${customTimeline.totalDays} days • ${completedStepsCount}/${totalStepsCount} steps`
                  : 'Tap to start assessment'}
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#fff"
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {!assessmentStarted ? (
            <View style={styles.welcomeScreen}>
              <Ionicons name="information-circle" size={48} color="#2196F3" />
              <Text style={styles.welcomeTitle}>Post-Flood Recovery Guide</Text>
              <Text style={styles.welcomeDescription}>
                Get a personalized recovery plan based on your damage assessment
              </Text>
              <TouchableOpacity style={styles.startButton} onPress={startAssessment}>
                <Text style={styles.startButtonText}>Start Assessment</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {assessmentCompleted && renderProgressHeader()}
              {assessmentCompleted && renderQuickActionCards()}
              {renderTabBar()}

              {activeTab === 'assessment' && renderAssessmentTab()}
              {activeTab === 'timeline' && renderTimelineTab()}
              {activeTab === 'steps' && renderStepsTab()}
            </>
          )}
        </View>
      )}

      {renderAirQualityModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
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
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  expandedContent: {
    backgroundColor: '#f8f9fa',
  },
  welcomeScreen: {
    padding: 32,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeDescription: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  progressHeader: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  progressHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressInfo: {
    flex: 1,
  },
  progressDay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  progressPhase: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  progressRingContainer: {
    marginHorizontal: 16,
  },
  progressRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 16,
    marginBottom: 8,
  },
  quickActionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginLeft: 16,
    marginRight: 8,
    width: 160,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  criticalActionCard: {
    borderColor: '#F44336',
    borderWidth: 2,
  },
  quickActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickActionCategory: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  quickActionStep: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingVertical: 6,
    gap: 4,
  },
  quickActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  disabledTabButton: {
    opacity: 0.5,
  },
  tabLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#2196F3',
    fontWeight: '600',
  },
  disabledTabLabel: {
    color: '#ccc',
  },
  tabContent: {
    backgroundColor: '#fff',
    flex: 1,
  },
  assessmentScrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  assessmentModeToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeModeButton: {
    backgroundColor: '#fff',
  },
  modeButtonText: {
    fontSize: 13,
    color: '#6c757d',
  },
  activeModeButtonText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  assessmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginHorizontal: 16,
    marginBottom: 4,
  },
  assessmentSubtitle: {
    fontSize: 13,
    color: '#6c757d',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  assessmentCategory: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  requiredMark: {
    color: '#F44336',
  },
  multipleChoiceNote: {
    fontSize: 11,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  optionsGrid: {
    gap: 8,
  },
  assessmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  assessmentOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  optionLabel: {
    fontSize: 13,
    color: '#495057',
    flex: 1,
    marginLeft: 10,
  },
  optionLabelSelected: {
    fontWeight: '500',
    color: '#1976D2',
  },
  severityIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  assessmentSummary: {
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    width: 140,
  },
  summaryValue: {
    fontSize: 13,
    color: '#6c757d',
    flex: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF5252',
  },
  timelineScrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  timelineTotalDays: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalDaysNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  totalDaysLabel: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
  },
  timelinePhases: {
    gap: 12,
  },
  phaseBlock: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  currentPhaseBlock: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  phaseIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  phaseContent: {
    flex: 1,
  },
  phaseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  phaseDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  phaseDays: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  currentBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  professionalHelpCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  professionalHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  professionalHelpTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
  },
  professionalItem: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 8,
  },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  professionalType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
  },
  professionalReason: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  adjustmentCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  adjustmentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  adjustmentReason: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  filterBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#6c757d',
  },
  activeFilterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  collapsibleCategory: {
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  categoryNotApplicable: {
    opacity: 0.6,
  },
  categoryCollapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderLeftWidth: 4,
  },
  categoryHeaderNotApplicable: {
    backgroundColor: '#f8f9fa',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  iconNotApplicable: {
    opacity: 0.5,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  categoryProgress: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 2,
  },
  applicabilityReason: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 3,
    fontStyle: 'italic',
  },
  textNotApplicable: {
    color: '#adb5bd',
  },
  phaseBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  phaseBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityIndicatorNotApplicable: {
    opacity: 0.5,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  categorySteps: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  stepItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  stepCompleted: {
    opacity: 0.6,
  },
  stepNotApplicable: {
    opacity: 0.5,
  },
  stepContent: {
    flex: 1,
    marginLeft: 10,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
  },
  stepTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#6c757d',
  },
  stepBrief: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  stepsScrollViewContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  resourcesContainer: {
    padding: 16,
    gap: 12,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 10,
    gap: 12,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  resourceDescription: {
    fontSize: 12,
    color: '#6c757d',
  },
  modalContainer: {
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalBody: {
    padding: 16,
  },
  airQualityLoading: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  airQualityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  airQualityStatusText: {
    flex: 1,
    marginLeft: 12,
  },
  airQualityLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  airQualityMessage: {
    fontSize: 13,
    color: '#2c3e50',
  },
  pollutantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  pollutantCard: {
    width: '47%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
  },
  pollutantName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  pollutantValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  pollutantUnit: {
    fontSize: 12,
    color: '#6c757d',
  },
  pollutantStatus: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  recommendationsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  recommendationItem: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  airQualityError: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  assessmentProgressContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  assessmentProgressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  assessmentProgressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  assessmentProgressText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  completeAssessmentContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  completeAssessmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  completeAssessmentButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  completeAssessmentButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  completeAssessmentButtonTextDisabled: {
    color: '#999',
  },
  completeAssessmentHint: {
    fontSize: 12,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});

export default React.memo(FloodRecoveryPlan);