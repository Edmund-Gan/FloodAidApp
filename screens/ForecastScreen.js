import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, Feather } from '@expo/vector-icons';
import { FloodContext } from '../context/FloodContext';
import { LocationContext } from '../context/LocationContext';
import { UserContext } from '../context/UserContext';
import { COLORS } from '../utils/constants';
import { 
  formatTimeRemaining, 
  formatProbability, 
  getTimeBasedGradient,
  formatDateTime 
} from '../utils/helpers';

const { width, height } = Dimensions.get('window');

export default function ForecastScreen({ navigation }) {
  const { 
    currentRisk, 
    weatherSummary, 
    riskFactors, 
    alerts, 
    isLoading, 
    refreshFloodData,
    getRiskColor 
  } = useContext(FloodContext);
  
  const { currentLocation, getCurrentLocation } = useContext(LocationContext);
  const { userProfile, logFeatureUsage } = useContext(UserContext);
  
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    logFeatureUsage('forecast');
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFloodData();
    setRefreshing(false);
  };

  const getGradientColors = () => {
    return getTimeBasedGradient();
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return COLORS.SUCCESS;
    if (confidence >= 0.6) return COLORS.WARNING;
    return COLORS.ERROR;
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getRiskIcon = () => {
    const probability = currentRisk.probability;
    if (probability >= 0.8) return 'warning';
    if (probability >= 0.6) return 'alert-circle';
    if (probability >= 0.3) return 'information-circle';
    return 'checkmark-circle';
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 0.9],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <BlurView intensity={100} tint="light" style={styles.headerBlur}>
          <Text style={styles.headerTitle}>FloodAid Forecast</Text>
          <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
            <Ionicons 
              name="refresh" 
              size={24} 
              color={COLORS.TEXT_PRIMARY} 
              style={refreshing && styles.rotating}
            />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Background Gradient */}
        <LinearGradient
          colors={getGradientColors()}
          style={styles.backgroundGradient}
        >
          <View style={styles.content}>
            
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.screenTitle}>Forecast</Text>
              <Text style={styles.locationText}>{currentRisk.location}</Text>
            </View>

            {/* Main Forecast Card */}
            <View style={styles.forecastCard}>
              <BlurView intensity={20} tint="light" style={styles.cardBlur}>
                
                {/* City Image Placeholder */}
                <LinearGradient
                  colors={['#4A90E2', '#357ABD']}
                  style={styles.cityImage}
                >
                  <Ionicons name="business" size={40} color="white" />
                </LinearGradient>

                <View style={styles.forecastContent}>
                  <Text style={styles.forecastSubtitle}>24-48 Hour Forecast</Text>
                  
                  {/* Risk Display */}
                  <View style={styles.riskContainer}>
                    <View style={styles.riskHeader}>
                      <Ionicons 
                        name={getRiskIcon()} 
                        size={24} 
                        color={getRiskColor(currentRisk.probability)} 
                      />
                      <Text style={[
                        styles.riskPercentage, 
                        { color: getRiskColor(currentRisk.probability) }
                      ]}>
                        Flood Risk: {formatProbability(currentRisk.probability)}
                      </Text>
                    </View>
                    <Text style={styles.riskLevel}>
                      Risk Level: {currentRisk.riskLevel}
                    </Text>
                  </View>

                  {/* Time Information */}
                  <Text style={styles.timeInfo}>
                    Predicted Timeframe: 12:00 PM - 5:00 PM
                  </Text>
                  <Text style={styles.timeRemaining}>Time Remaining</Text>
                  
                  {/* Countdown Timer */}
                  <View style={styles.timerContainer}>
                    <View style={styles.timerBlock}>
                      <Text style={styles.timerNumber}>
                        {currentRisk.timeToFlood.hours.toString().padStart(2, '0')}
                      </Text>
                      <Text style={styles.timerLabel}>Hours</Text>
                    </View>
                    <View style={styles.timerSeparator}>
                      <Text style={styles.timerColon}>:</Text>
                    </View>
                    <View style={styles.timerBlock}>
                      <Text style={styles.timerNumber}>
                        {currentRisk.timeToFlood.minutes.toString().padStart(2, '0')}
                      </Text>
                      <Text style={styles.timerLabel}>Minutes</Text>
                    </View>
                    <View style={styles.timerSeparator}>
                      <Text style={styles.timerColon}>:</Text>
                    </View>
                    <View style={styles.timerBlock}>
                      <Text style={styles.timerNumber}>
                        {currentRisk.timeToFlood.seconds.toString().padStart(2, '0')}
                      </Text>
                      <Text style={styles.timerLabel}>Seconds</Text>
                    </View>
                  </View>
                </View>
              </BlurView>
            </View>

            {/* Weather Summary */}
            <View style={styles.weatherSummaryCard}>
              <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                <Text style={styles.cardTitle}>Current Conditions</Text>
                <View style={styles.weatherGrid}>
                  <View style={styles.weatherItem}>
                    <Ionicons name="thermometer" size={16} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.weatherLabel}>Temperature</Text>
                    <Text style={styles.weatherValue}>
                      {Math.round(weatherSummary.currentTempMax)}°C
                    </Text>
                  </View>
                  <View style={styles.weatherItem}>
                    <Ionicons name="water" size={16} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.weatherLabel}>Precipitation</Text>
                    <Text style={styles.weatherValue}>
                      {weatherSummary.currentPrecipitation.toFixed(1)} mm
                    </Text>
                  </View>
                  <View style={styles.weatherItem}>
                    <Ionicons name="speedometer" size={16} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.weatherLabel}>Wind</Text>
                    <Text style={styles.weatherValue}>
                      {weatherSummary.currentWindSpeed.toFixed(1)} km/h
                    </Text>
                  </View>
                  <View style={styles.weatherItem}>
                    <Ionicons name="boat" size={16} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.weatherLabel}>River Level</Text>
                    <Text style={styles.weatherValue}>
                      {weatherSummary.riverLevel.toFixed(1)} ft
                    </Text>
                  </View>
                </View>
              </BlurView>
            </View>

            {/* Risk Factors */}
            <View style={styles.riskFactorsCard}>
              <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                <View style={styles.riskFactorsHeader}>
                  <Ionicons name="cloudy" size={20} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.cardTitle}>Risk Factors</Text>
                </View>
                <View style={styles.riskFactorsList}>
                  {riskFactors.map((factor, index) => (
                    <View key={index} style={styles.riskFactorItem}>
                      <View style={styles.riskFactorBullet} />
                      <Text style={styles.riskFactorText}>{factor}</Text>
                    </View>
                  ))}
                </View>
              </BlurView>
            </View>

            {/* Prediction Confidence */}
            <View style={styles.confidenceCard}>
              <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                <View style={styles.confidenceContent}>
                  <View style={styles.confidenceInfo}>
                    <Text style={styles.confidenceTitle}>
                      Prediction Confidence: {formatProbability(currentRisk.confidence)}
                    </Text>
                    <Text style={[
                      styles.confidenceLevel,
                      { color: getConfidenceColor(currentRisk.confidence) }
                    ]}>
                      {getConfidenceText(currentRisk.confidence)}
                    </Text>
                    <Text style={styles.confidenceSubtext}>
                      Based on AI analysis and weather patterns
                    </Text>
                  </View>
                  <View style={styles.confidenceIcon}>
                    <Ionicons 
                      name="checkmark-circle" 
                      size={40} 
                      color={getConfidenceColor(currentRisk.confidence)} 
                    />
                  </View>
                </View>
              </BlurView>
            </View>

            {/* Active Alerts */}
            {alerts.length > 0 && (
              <View style={styles.alertsCard}>
                <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                  <Text style={styles.cardTitle}>Active Alerts</Text>
                  {alerts.map((alert, index) => (
                    <View key={alert.id} style={styles.alertItem}>
                      <Ionicons 
                        name="warning" 
                        size={20} 
                        color={COLORS.WARNING} 
                      />
                      <View style={styles.alertContent}>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                        <Text style={styles.alertDescription}>{alert.description}</Text>
                      </View>
                    </View>
                  ))}
                </BlurView>
              </View>
            )}

            {/* Last Updated */}
            <View style={styles.lastUpdatedContainer}>
              <Text style={styles.lastUpdatedText}>
                Last updated: {formatDateTime(currentRisk.lastUpdated)}
              </Text>
            </View>

            {/* Bottom Spacing for Tab Bar */}
            <View style={styles.bottomSpacing} />
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: Platform.OS === 'ios' ? 90 : 70,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  headerBlur: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  scrollView: {
    flex: 1,
  },
  backgroundGradient: {
    minHeight: height,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingHorizontal: 20,
  },
  titleSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 5,
  },
  locationText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  forecastCard: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardBlur: {
    padding: 20,
  },
  cityImage: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 15,
  },
  forecastContent: {
    // Content styling
  },
  forecastSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 10,
  },
  riskContainer: {
    marginBottom: 15,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  riskPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  riskLevel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 32,
  },
  timeInfo: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 5,
  },
  timeRemaining: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 15,
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    minWidth: 60,
  },
  timerNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  timerLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  timerSeparator: {
    marginHorizontal: 5,
  },
  timerColon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  weatherSummaryCard: {
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 15,
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  weatherItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  weatherLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 5,
    marginBottom: 2,
  },
  weatherValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  riskFactorsCard: {
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  riskFactorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  riskFactorsList: {
    // List styling
  },
  riskFactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskFactorBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
    marginRight: 12,
  },
  riskFactorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 20,
  },
  confidenceCard: {
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  confidenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceInfo: {
    flex: 1,
  },
  confidenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 5,
  },
  confidenceLevel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  confidenceSubtext: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  confidenceIcon: {
    marginLeft: 15,
  },
  alertsCard: {
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  lastUpdatedContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  bottomSpacing: {
    height: 100,
  },
  rotating: {
    // Add rotation animation if needed
  },
});