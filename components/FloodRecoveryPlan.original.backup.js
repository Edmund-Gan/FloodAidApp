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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext } from '../context/UserContext';
import { useReliableLocation } from '../context/ReliableLocationContext';
import airQualityService from '../services/AirQualityService';
import ReliableLocationService from '../services/ReliableLocationService';

const { width } = Dimensions.get('window');

const FloodRecoveryPlan = ({ recoveryGuideData, currentLocationInfo }) => {
  const { userProfile } = useContext(UserContext);
  const { currentLocation } = useReliableLocation();
  const [expanded, setExpanded] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
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
  const [airQualityExpanded, setAirQualityExpanded] = useState(true);

  useEffect(() => {
    loadSavedData();
  }, []);

  useEffect(() => {
    if (damageAssessment.water_depth) {
      calculateCustomTimeline();
    }
  }, [damageAssessment, userProfile]);

  // Fetch air quality data on component mount AND when location changes
  useEffect(() => {
    console.log('🌍 FloodRecoveryPlan: Location changed, re-fetching air quality');
    console.log('🌍 FloodRecoveryPlan: Location from prop (saved):', currentLocationInfo?.lat, currentLocationInfo?.lon);
    console.log('🌍 FloodRecoveryPlan: Location from context (GPS):', currentLocation?.latitude, currentLocation?.longitude);
    fetchAirQualityData();
  }, [currentLocationInfo?.lat, currentLocationInfo?.lon, currentLocation?.latitude, currentLocation?.longitude]);

  const fetchAirQualityData = async () => {
    console.log('🌍 FloodRecoveryPlan: fetchAirQualityData called');
    setAirQualityLoading(true);
    try {
      let locationToUse = null;

      // Priority 1: Use currentLocationInfo prop (from saved location selection)
      if (currentLocationInfo?.lat && currentLocationInfo?.lon) {
        console.log('🌍 FloodRecoveryPlan: Using location from prop (saved location):', currentLocationInfo.display_name || 'saved location');
        locationToUse = {
          lat: currentLocationInfo.lat,
          lon: currentLocationInfo.lon
        };
      }
      // Priority 2: Use context location (GPS)
      else if (currentLocation?.latitude && currentLocation?.longitude) {
        console.log('🌍 FloodRecoveryPlan: Using location from context (GPS):', currentLocation.latitude, currentLocation.longitude);
        locationToUse = {
          lat: currentLocation.latitude,
          lon: currentLocation.longitude
        };
      }
      // Priority 3: Force refresh GPS location
      else {
        console.log('🌍 FloodRecoveryPlan: No location available, fetching fresh GPS');
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
        console.log('🌍 FloodRecoveryPlan: Fetching air quality for', locationToUse.lat, locationToUse.lon);
        const airQuality = await airQualityService.getAirQuality(
          locationToUse.lat,
          locationToUse.lon
        );
        console.log('🌍 FloodRecoveryPlan: Air quality data received:', airQuality?.overallSafety?.level);
        setAirQualityData(airQuality);
      } else {
        // Fallback to default location (Kuala Lumpur)
        console.log('🌍 FloodRecoveryPlan: Using fallback location for air quality');
        const airQuality = await airQualityService.getAirQuality(3.139, 101.6869);
        console.log('🌍 FloodRecoveryPlan: Fallback air quality data received:', airQuality?.overallSafety?.level);
        setAirQualityData(airQuality);
      }
    } catch (error) {
      console.error('🌍 FloodRecoveryPlan: Error fetching air quality:', error);
      // Set error state but don't block the UI
      setAirQualityData(null);
    } finally {
      setAirQualityLoading(false);
      console.log('🌍 FloodRecoveryPlan: Air quality loading complete');
    }
  };

  const loadSavedData = async () => {
    try {
      const [savedAssessment, savedProgress] = await Promise.all([
        AsyncStorage.getItem('floodRecoveryAssessment'),
        AsyncStorage.getItem('floodRecoveryProgress'),
      ]);

      if (savedAssessment) {
        setDamageAssessment(JSON.parse(savedAssessment));
        setAssessmentStarted(true);
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

    // Get base timeline from water depth
    const waterDepthOption = recoveryGuideData.damage_assessment.categories
      .find(cat => cat.id === 'water_depth')
      ?.options.find(opt => opt.id === damageAssessment.water_depth);

    let baseTimeline = waterDepthOption?.timeline_impact?.total_days || 7;
    let cleanupDays = waterDepthOption?.timeline_impact?.cleanup_days || 2;
    let dryingDays = waterDepthOption?.timeline_impact?.drying_days || 5;

    // Add timeline additions from all selected damage
    let additionalDays = 0;

    // Structural damage additions
    damageAssessment.structural_damage.forEach(damageId => {
      const damage = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'structural_damage')
        ?.options.find(opt => opt.id === damageId);
      if (damage?.timeline_addition_days) {
        additionalDays += damage.timeline_addition_days;
      }
    });

    // Electrical damage additions
    damageAssessment.electrical_damage.forEach(damageId => {
      const damage = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'electrical_damage')
        ?.options.find(opt => opt.id === damageId);
      if (damage?.timeline_addition_days) {
        additionalDays += damage.timeline_addition_days;
      }
    });

    // Furniture items additions
    damageAssessment.furniture_items.forEach(itemId => {
      const item = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'furniture_items')
        ?.options.find(opt => opt.id === itemId);
      if (item?.timeline_addition_days) {
        additionalDays += item.timeline_addition_days;
      }
    });

    // Mold growth additions
    if (damageAssessment.mold_growth) {
      const moldOption = recoveryGuideData.damage_assessment.categories
        .find(cat => cat.id === 'mold_growth')
        ?.options.find(opt => opt.id === damageAssessment.mold_growth);
      if (moldOption?.timeline_addition_days) {
        additionalDays += moldOption.timeline_addition_days;
      }
    }

    let totalDays = baseTimeline + additionalDays;

    // Apply user profile adjustments
    let adjustmentMultiplier = 1.0;
    const adjustmentReasons = [];

    // Mobility assistance adds 50% time for physical tasks
    if (mobilityAssistance) {
      adjustmentMultiplier += 0.5;
      adjustmentReasons.push('mobility assistance (+50%)');
    }

    // Family size impact - more people means more items affected
    if (familySize > 1) {
      const familyImpact = (familySize - 1) * 0.1;
      adjustmentMultiplier += familyImpact;
      adjustmentReasons.push(`${familySize} household members (+${Math.round(familyImpact * 100)}%)`);
    }

    // Children impact - supervision and safety considerations
    if (hasChildren) {
      const childrenImpact = childrenAges.length * 0.2;
      adjustmentMultiplier += childrenImpact;
      adjustmentReasons.push(`${childrenAges.length} children (+${Math.round(childrenImpact * 100)}%)`);

      // Young children require extra time
      if (hasInfants || hasToddlers) {
        adjustmentMultiplier += 0.3;
        adjustmentReasons.push('young children supervision (+30%)');
      } else if (hasSchoolChildren) {
        adjustmentMultiplier += 0.15;
        adjustmentReasons.push('school-age children supervision (+15%)');
      }
    }

    // Apply adjustments
    totalDays = Math.ceil(totalDays * adjustmentMultiplier);
    cleanupDays = Math.ceil(cleanupDays * adjustmentMultiplier);
    dryingDays = Math.ceil(dryingDays * adjustmentMultiplier);

    // Calculate phase durations
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

    // Check structural damage
    if (damageAssessment.structural_damage.includes('foundation') ||
        damageAssessment.structural_damage.includes('walls_cracks')) {
      professionals.push({
        type: 'Structural Engineer / Jurutera Struktur',
        reason: 'Foundation or structural damage detected',
        urgent: true,
      });
    }

    // Check electrical damage
    if (damageAssessment.electrical_damage.includes('breaker_box') ||
        damageAssessment.electrical_damage.includes('wiring_exposed')) {
      professionals.push({
        type: 'Licensed Electrician / Juruelektrik Berlesen',
        reason: 'Electrical system damage detected',
        urgent: true,
      });
    }

    // Check sewage water
    if (damageAssessment.water_type === 'sewage_water') {
      professionals.push({
        type: 'Professional Cleaning Company / Syarikat Pembersihan Profesional',
        reason: 'Sewage contamination requires professional sanitization',
        urgent: false,
      });
    }

    // Check mold
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

    const { water_depth, water_type, structural_damage, electrical_damage, mold_growth } = damageAssessment;

    return recoveryGuideData.categories.filter(category => {
      // Always include immediate safety and safety protection
      if (['immediate_safety', 'safety_protection'].includes(category.id)) {
        return true;
      }

      // Include based on triggers
      if (category.triggered_by_damage) {
        return category.triggered_by_damage.some(trigger => {
          if (trigger === 'water_depth.*' && water_depth) return true;
          if (trigger === 'water_type.*' && water_type) return true;
          if (trigger.startsWith('water_type.') && trigger.includes(water_type)) return true;
          if (trigger.startsWith('structural_damage.') && structural_damage.some(d => trigger.includes(d))) return true;
          if (trigger.startsWith('electrical_damage.') && electrical_damage.some(d => trigger.includes(d))) return true;
          if (trigger.startsWith('mold_growth.') && trigger.includes(mold_growth)) return true;
          return false;
        });
      }

      return true;
    });
  };

  const handleAssessmentSelection = (categoryId, optionId, isMultiple = false) => {
    let newAssessment = { ...damageAssessment };

    if (isMultiple) {
      // Handle multiple choice
      const currentSelections = newAssessment[categoryId] || [];
      if (currentSelections.includes(optionId)) {
        newAssessment[categoryId] = currentSelections.filter(id => id !== optionId);
      } else {
        newAssessment[categoryId] = [...currentSelections, optionId];
      }
    } else {
      // Handle single choice
      newAssessment[categoryId] = optionId;
    }

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
            await AsyncStorage.multiRemove(['floodRecoveryAssessment', 'floodRecoveryProgress']);
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
          },
        },
      ]
    );
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
    setExpanded(true);
  };

  const renderDamageAssessmentForm = () => {
    if (!recoveryGuideData?.damage_assessment) return null;

    return (
      <View style={styles.assessmentForm}>
        <View style={styles.assessmentHeader}>
          <Text style={styles.assessmentTitle}>Damage Assessment</Text>
          <Text style={styles.assessmentSubtitle}>
            {recoveryGuideData.damage_assessment.description_en}
          </Text>
        </View>

        {recoveryGuideData.damage_assessment.categories.map((category, index) => {
          const isMultiple = category.type === 'multiple_choice';
          const currentValue = damageAssessment[category.id];
          const hasSelection = isMultiple
            ? currentValue?.length > 0
            : currentValue !== null;

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
                    <View style={styles.optionCheckbox}>
                      <Ionicons
                        name={isMultiple
                          ? (isSelected ? 'checkbox' : 'square-outline')
                          : (isSelected ? 'radio-button-on' : 'radio-button-off')
                        }
                        size={22}
                        color={isSelected ? '#2196F3' : '#999'}
                      />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}>
                        {option.label_en}
                      </Text>
                      {option.severity && (
                        <View style={[
                          styles.severityBadge,
                          { backgroundColor: getSeverityColor(option.severity) + '20' },
                        ]}>
                          <Text style={[
                            styles.severityText,
                            { color: getSeverityColor(option.severity) },
                          ]}>
                            {option.severity.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {damageAssessment.water_depth && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetAssessment}
          >
            <Ionicons name="refresh" size={16} color="#FF5252" />
            <Text style={styles.resetButtonText}>Reset Assessment</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAirQualitySafetyPanel = () => {
    console.log('🎨 FloodRecoveryPlan: renderAirQualitySafetyPanel called');
    console.log('🎨 FloodRecoveryPlan: airQualityData:', airQualityData ? 'DATA PRESENT' : 'NULL');
    console.log('🎨 FloodRecoveryPlan: airQualityLoading:', airQualityLoading);
    console.log('🎨 FloodRecoveryPlan: airQualityExpanded:', airQualityExpanded);

    return (
      <View style={styles.airQualityPanel}>
        <TouchableOpacity
          style={styles.airQualityHeader}
          onPress={() => setAirQualityExpanded(!airQualityExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.airQualityHeaderContent}>
            <Ionicons name="leaf-outline" size={24} color="#2196F3" />
            <View style={styles.airQualityHeaderText}>
              <Text style={styles.airQualityTitle}>Air Quality Safety Assessment</Text>
              <Text style={styles.airQualitySubtitle}>
                Check if it's safe to return home
              </Text>
            </View>
            <Ionicons
              name={airQualityExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#6c757d"
            />
          </View>
        </TouchableOpacity>

        {airQualityExpanded && (
          <View style={styles.airQualityContent}>
            {airQualityLoading ? (
              <View style={styles.airQualityLoading}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.airQualityLoadingText}>Fetching air quality data...</Text>
              </View>
            ) : airQualityData ? (
              <>
                {/* Overall Safety Banner */}
                <View style={[
                  styles.overallSafetyBanner,
                  { backgroundColor: airQualityData.overallSafety.color + '15' }
                ]}>
                  <Ionicons
                    name={airQualityData.overallSafety.icon}
                    size={32}
                    color={airQualityData.overallSafety.color}
                  />
                  <View style={styles.overallSafetyText}>
                    <Text style={[
                      styles.overallSafetyLevel,
                      { color: airQualityData.overallSafety.color }
                    ]}>
                      Overall Safety: {airQualityData.overallSafety.level}
                    </Text>
                    <Text style={styles.overallSafetyMessage}>
                      {airQualityData.overallSafety.message}
                    </Text>
                    <Text style={styles.overallSafetyDescription}>
                      {airQualityData.overallSafety.description}
                    </Text>
                  </View>
                </View>

                {/* Pollutants Grid */}
                <View style={styles.pollutantsGrid}>
                  {Object.keys(airQualityData.pollutants).map(pollutantKey => {
                    const pollutant = airQualityData.pollutants[pollutantKey];

                    return (
                      <View key={pollutantKey} style={styles.pollutantCard}>
                        <View style={styles.pollutantHeader}>
                          <Text style={styles.pollutantName}>{pollutant.name}</Text>
                          <View style={[
                            styles.pollutantSafetyBadge,
                            { backgroundColor: pollutant.safetyColor + '20' }
                          ]}>
                            <Text style={[
                              styles.pollutantSafetyText,
                              { color: pollutant.safetyColor }
                            ]}>
                              {pollutant.safetyLevel}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.pollutantValue}>
                          <Text style={styles.pollutantNumber}>
                            {pollutant.value !== null ? pollutant.value : 'N/A'}
                          </Text>
                          <Text style={styles.pollutantUnit}> {pollutant.unit}</Text>
                        </View>

                        <View style={styles.pollutantThresholds}>
                          <View style={styles.thresholdRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                            <Text style={styles.thresholdText}>
                              Safe: {'<'}{pollutant.thresholds.safe} ({pollutant.thresholds.safeStandard})
                            </Text>
                          </View>
                          <View style={styles.thresholdRow}>
                            <Ionicons name="warning" size={14} color="#FF9800" />
                            <Text style={styles.thresholdText}>
                              Caution: {pollutant.thresholds.safe}-{pollutant.thresholds.caution} ({pollutant.thresholds.cautionStandard})
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Recommendations */}
                {airQualityData.recommendations && airQualityData.recommendations.length > 0 && (
                  <View style={styles.recommendationsSection}>
                    <Text style={styles.recommendationsTitle}>Safety Recommendations</Text>
                    {airQualityData.recommendations.map((rec, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#2196F3" />
                        <Text style={styles.recommendationText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Data Source and Timestamp */}
                <View style={styles.airQualityFooter}>
                  <Text style={styles.airQualitySource}>
                    Data source: {airQualityData.source}
                    {airQualityData.isMock && ' (Simulated)'}
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={fetchAirQualityData}
                  >
                    <Ionicons name="refresh" size={16} color="#2196F3" />
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                  </TouchableOpacity>
                </View>

                {/* Threshold Info Button */}
                <TouchableOpacity
                  style={styles.thresholdInfoButton}
                  onPress={() => {
                    Alert.alert(
                      'Air Quality Standards',
                      'This assessment uses WHO (World Health Organization), EPA (US Environmental Protection Agency), and CDC ATSDR (Centers for Disease Control) thresholds.\n\nSAFE: Air quality is within safe levels\nCAUTION: Use protective equipment\nUNSAFE: Do not return home',
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <Ionicons name="information-circle-outline" size={18} color="#2196F3" />
                  <Text style={styles.thresholdInfoText}>
                    View Detailed Thresholds & Explanations
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.airQualityError}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF9800" />
                <Text style={styles.airQualityErrorTitle}>Air Quality Data Unavailable</Text>
                <Text style={styles.airQualityErrorText}>
                  Unable to fetch air quality data. Please check your internet connection.
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchAirQualityData}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderTimelineOverview = () => {
    if (!customTimeline) return null;

    const totalSteps = getRelevantCategories().reduce((total, category) => {
      return total + (category.steps?.length || 0);
    }, 0);

    const completedCount = Object.values(completedSteps).filter(Boolean).length;
    const progressPercentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    return (
      <View style={styles.timelineOverview}>
        <View style={styles.timelineHeader}>
          <Ionicons name="calendar-outline" size={24} color="#2196F3" />
          <Text style={styles.timelineTitle}>Your Personalized Recovery Timeline</Text>
        </View>

        <View style={styles.totalTimelineCard}>
          <Text style={styles.totalDaysNumber}>{customTimeline.totalDays}</Text>
          <Text style={styles.totalDaysLabel}>Estimated Recovery Days</Text>
          {customTimeline.adjustmentReasons.length > 0 && (
            <View style={styles.adjustmentReasons}>
              <Text style={styles.adjustmentLabel}>Timeline adjusted for:</Text>
              {customTimeline.adjustmentReasons.map((reason, index) => (
                <Text key={index} style={styles.adjustmentReason}>
                  • {reason}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.phasesContainer}>
          {Object.entries(customTimeline.phases).map(([phaseKey, phase]) => (
            <View key={phaseKey} style={styles.phaseCard}>
              <View style={styles.phaseIcon}>
                <Ionicons
                  name={getPhaseIcon(phaseKey)}
                  size={20}
                  color={getPhaseColor(phaseKey)}
                />
              </View>
              <View style={styles.phaseInfo}>
                <Text style={styles.phaseName}>{getPhaseTitle(phaseKey)}</Text>
                <Text style={styles.phaseTimeline}>{phase.label}</Text>
              </View>
              <View style={styles.phaseDuration}>
                <Text style={styles.phaseDays}>{phase.days}d</Text>
              </View>
            </View>
          ))}
        </View>

        {customTimeline.needsProfessionalHelp.length > 0 && (
          <View style={styles.professionalHelpAlert}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={20} color="#FF6B6B" />
              <Text style={styles.alertTitle}>Professional Help Required</Text>
            </View>
            {customTimeline.needsProfessionalHelp.map((prof, index) => (
              <View key={index} style={[
                styles.professionalItem,
                prof.urgent && styles.urgentProfessional,
              ]}>
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

        <View style={styles.progressOverview}>
          <Text style={styles.progressTitle}>Overall Progress</Text>
          <View style={styles.progressStats}>
            <Text style={styles.progressNumber}>{completedCount} / {totalSteps}</Text>
            <Text style={styles.progressLabel}>Steps Completed</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
          </View>
        </View>
      </View>
    );
  };

  const renderRecoveryCategories = () => {
    const categories = getRelevantCategories();

    return (
      <View style={styles.categoriesContainer}>
        <Text style={styles.categoriesTitle}>Recovery Steps</Text>
        {categories.map((category, index) => renderCategorySection(category, index))}
      </View>
    );
  };

  const renderCategorySection = (category, index) => {
    const categorySteps = category.steps || [];
    const completedCategorySteps = categorySteps.filter(step =>
      completedSteps[`${category.id}_step_${step.step_number}`]
    ).length;

    return (
      <View key={category.id} style={styles.categorySection}>
        <View style={[
          styles.categoryHeader,
          { backgroundColor: getPriorityColor(category.priority_en || 'MEDIUM') + '15' },
        ]}>
          <View style={styles.categoryTitleRow}>
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <View style={styles.categoryHeaderText}>
              <Text style={styles.categoryName}>{category.category_name_en}</Text>
              <Text style={styles.categoryTimeline}>{category.base_timeline_en}</Text>
            </View>
          </View>
          <View style={styles.categoryProgress}>
            <Text style={styles.categoryProgressText}>
              {completedCategorySteps}/{categorySteps.length}
            </Text>
          </View>
        </View>

        <View style={styles.categoryDescription}>
          <Text style={styles.categoryDescriptionText}>
            {category.brief_description_en}
          </Text>
        </View>

        {categorySteps.map(step => renderRecoveryStep(category.id, step))}
      </View>
    );
  };

  const renderRecoveryStep = (categoryId, step) => {
    const stepId = `${categoryId}_step_${step.step_number}`;
    const isCompleted = completedSteps[stepId];

    return (
      <TouchableOpacity
        key={stepId}
        style={[styles.stepCard, isCompleted && styles.stepCompleted]}
        onPress={() => toggleStepCompletion(categoryId, step.step_number)}
      >
        <View style={styles.stepHeader}>
          <View style={styles.stepCheckbox}>
            <Ionicons
              name={isCompleted ? 'checkbox' : 'square-outline'}
              size={24}
              color={isCompleted ? '#4CAF50' : '#999'}
            />
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepNumber}>Step {step.step_number}</Text>
              {step.applies_to_all && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>Required</Text>
                </View>
              )}
            </View>
            <Text style={[styles.stepTitle, isCompleted && styles.stepTitleCompleted]}>
              {step.title_en}
            </Text>
            <Text style={styles.stepBrief}>{step.brief_en}</Text>
          </View>
        </View>

        {step.safety_warnings_en && step.safety_warnings_en.length > 0 && (
          <View style={styles.safetyWarnings}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning-outline" size={14} color="#FF6B6B" />
              <Text style={styles.warningHeaderText}>Safety Warnings</Text>
            </View>
            {step.safety_warnings_en.map((warning, index) => (
              <Text key={index} style={styles.warningText}>• {warning}</Text>
            ))}
          </View>
        )}

        {userProfile.hasChildren && step.extra_caution_if && (
          <View style={styles.childrenNote}>
            <Ionicons name="people-outline" size={14} color="#FF9800" />
            <Text style={styles.childrenNoteText}>
              Extra caution needed with children in household
            </Text>
          </View>
        )}
      </TouchableOpacity>
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

  const getPhaseIcon = (phase) => {
    const icons = {
      immediate: 'alert-circle',
      cleanup: 'water',
      drying: 'sunny',
      restoration: 'hammer',
    };
    return icons[phase] || 'checkmark-circle';
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
          <Text>Loading flood recovery guide...</Text>
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
            <Ionicons name="water" size={32} color="#fff" style={styles.headerIcon} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Access Your Recovery Guide</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {assessmentStarted && customTimeline
                  ? `${customTimeline.totalDays}-day personalized recovery plan, ${completedStepsCount} Steps Done, ${customTimeline.needsProfessionalHelp.length} Pro Help`
                  : 'Post-flood recovery guidance'}
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
          {!assessmentStarted ? (
            <View style={styles.welcomeScreen}>
              <View style={styles.welcomeIcon}>
                <Ionicons name="information-circle" size={64} color="#2196F3" />
              </View>
              <Text style={styles.welcomeTitle}>Post-Flood Recovery Planner</Text>
              <Text style={styles.welcomeDescription}>
                Get a personalized recovery plan based on the damage to your property.
                This tool will help you understand the steps needed, estimated timeline,
                and when to seek professional help.
              </Text>
              <TouchableOpacity style={styles.startButton} onPress={startAssessment}>
                <Text style={styles.startButtonText}>Start Damage Assessment</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {renderDamageAssessmentForm()}
              {renderAirQualitySafetyPanel()}
              {customTimeline && renderTimelineOverview()}
              {customTimeline && renderRecoveryCategories()}

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Recovery plan personalized for your household and damage assessment
                </Text>
              </View>
            </>
          )}
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
    lineHeight: 18,
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingBottom: 20,
  },
  welcomeScreen: {
    padding: 32,
    alignItems: 'center',
  },
  welcomeIcon: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  assessmentForm: {
    padding: 16,
  },
  assessmentHeader: {
    marginBottom: 20,
  },
  assessmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  assessmentSubtitle: {
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
  },
  assessmentCategory: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  categoryHeader: {
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#495057',
  },
  requiredMark: {
    color: '#F44336',
  },
  multipleChoiceNote: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 2,
  },
  assessmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  assessmentOptionSelected: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderColor: '#2196F3',
  },
  optionCheckbox: {
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
  },
  optionLabelSelected: {
    fontWeight: '500',
    color: '#1976D2',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF5252',
  },
  timelineOverview: {
    padding: 16,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  totalTimelineCard: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalDaysNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  totalDaysLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  adjustmentReasons: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 150, 243, 0.2)',
    width: '100%',
  },
  adjustmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  adjustmentReason: {
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 8,
  },
  phasesContainer: {
    gap: 8,
    marginBottom: 16,
  },
  phaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  phaseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  phaseInfo: {
    flex: 1,
  },
  phaseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  phaseTimeline: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  phaseDuration: {
    alignItems: 'center',
  },
  phaseDays: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  professionalHelpAlert: {
    backgroundColor: 'rgba(255, 243, 224, 0.8)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#e65100',
  },
  professionalItem: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 6,
    marginBottom: 8,
  },
  urgentProfessional: {
    borderWidth: 1,
    borderColor: '#F44336',
  },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  professionalType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  professionalReason: {
    fontSize: 12,
    color: '#6c757d',
  },
  progressOverview: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  progressNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(189, 189, 189, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  categoriesContainer: {
    padding: 16,
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  categorySection: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryHeaderText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  categoryTimeline: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  categoryProgress: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  categoryDescription: {
    padding: 12,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
  },
  categoryDescriptionText: {
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
  },
  stepCard: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  stepCompleted: {
    opacity: 0.6,
  },
  stepHeader: {
    flexDirection: 'row',
  },
  stepCheckbox: {
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2196F3',
    textTransform: 'uppercase',
  },
  requiredBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#F44336',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  stepTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#6c757d',
  },
  stepBrief: {
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
  },
  safetyWarnings: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 235, 238, 0.8)',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  warningHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d32f2f',
  },
  warningText: {
    fontSize: 11,
    color: '#c62828',
    lineHeight: 16,
  },
  childrenNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 243, 224, 0.8)',
    borderRadius: 6,
    gap: 6,
  },
  childrenNoteText: {
    fontSize: 11,
    color: '#e65100',
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
  // Air Quality Panel Styles
  airQualityPanel: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  airQualityHeader: {
    padding: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  airQualityHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  airQualityHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  airQualityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  airQualitySubtitle: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  airQualityContent: {
    padding: 16,
  },
  airQualityLoading: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  airQualityLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6c757d',
  },
  overallSafetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  overallSafetyText: {
    flex: 1,
    marginLeft: 12,
  },
  overallSafetyLevel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  overallSafetyMessage: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  overallSafetyDescription: {
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
  },
  pollutantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  pollutantCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  pollutantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pollutantName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  pollutantSafetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pollutantSafetyText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  pollutantValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  pollutantNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  pollutantUnit: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 4,
  },
  pollutantThresholds: {
    marginTop: 8,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  thresholdText: {
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 6,
    flex: 1,
  },
  recommendationsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recommendationText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
    marginLeft: 10,
    flex: 1,
  },
  airQualityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  airQualitySource: {
    fontSize: 11,
    color: '#6c757d',
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
    gap: 4,
  },
  refreshButtonText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  thresholdInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  thresholdInfoText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
  },
  airQualityError: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  airQualityErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  airQualityErrorText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

// Memoized to prevent unnecessary re-renders when parent re-renders
export default React.memo(FloodRecoveryPlan, (prevProps, nextProps) => {
  // Only re-render if recoveryGuideData changes
  return prevProps.recoveryGuideData === nextProps.recoveryGuideData;
});
