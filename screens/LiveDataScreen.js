import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserContext } from '../context/UserContext';
import { COLORS } from '../utils/constants';
import RealTimeWeatherService from '../services/RealTimeWeatherService';
import openMeteoService from '../services/OpenMeteoService';
import ReliableLocationService from '../services/ReliableLocationService';
import FloodRiskMapView from '../components/FloodRiskMapView';

const realTimeWeatherService = new RealTimeWeatherService();

const FALLBACK_LOCATION = {
  lat: 3.139,
  lon: 101.6869,
  label: 'Kuala Lumpur, Malaysia',
};

export default function LiveDataScreen() {
  const { logFeatureUsage } = useContext(UserContext);
  const insets = useSafeAreaInsets();
  const [weatherData, setWeatherData] = useState(null);
  const [riverData, setRiverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [locationLabel, setLocationLabel] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [isWeatherExpanded, setIsWeatherExpanded] = useState(false);
  const [isRainOutlookExpanded, setIsRainOutlookExpanded] = useState(false);

  const loadWeather = useCallback(async (refresh = false) => {
    if (refresh) {
      realTimeWeatherService.clearCache();
    }

    if (!refresh) {
      setLoading(true);
    }

    setError(null);

    try {
      let weatherLocation = null;

      try {
        const locationResult = await ReliableLocationService.getCurrentLocation({
          forceRefresh: true,
          enableHighAccuracy: true,
          includeAddress: true // Include address for weather display
        });
        if (locationResult?.lat && locationResult?.lon) {
          console.log(`📍 LiveDataScreen: === LIVE DATA LOCATION SOURCE TRACKING ===`);
          console.log(`📍 LiveDataScreen: Received coordinates: ${locationResult.lat}, ${locationResult.lon}`);
          console.log(`📍 LiveDataScreen: Location source: ${locationResult.source || 'gps'}`);
          console.log(`📍 LiveDataScreen: This location will be used for LIVE DATA display`);

          weatherLocation = {
            lat: locationResult.lat,
            lon: locationResult.lon,
            label: locationResult.display_name || 'Current Location',
          };
        }
      } catch (locationError) {
        console.warn('LiveDataScreen: Falling back to default location', locationError);
      }

      if (!weatherLocation) {
        console.log(`📍 LiveDataScreen: === LIVE DATA FALLBACK LOCATION TRACKING ===`);
        console.log(`📍 LiveDataScreen: Falling back to: ${FALLBACK_LOCATION.lat}, ${FALLBACK_LOCATION.lon}`);
        console.log(`📍 LiveDataScreen: Fallback reason: GPS failed`);
        console.log(`📍 LiveDataScreen: This FALLBACK location will be used for LIVE DATA display`);
        weatherLocation = FALLBACK_LOCATION;
      }

      const data = await realTimeWeatherService.getHomePageWeatherData(
        weatherLocation.lat,
        weatherLocation.lon
      );

      setWeatherData(data);
      setLocationLabel(weatherLocation.label);

      // Fetch river discharge data
      try {
        const riverResult = await openMeteoService.getCurrentRiverDischarge(
          weatherLocation.lat,
          weatherLocation.lon
        );
        setRiverData(riverResult);
      } catch (riverError) {
        console.warn('LiveDataScreen: Failed to load river data', riverError);
        setRiverData(null); // Set to null if river data fails
      }
    } catch (apiError) {
      console.error('LiveDataScreen: Failed to load weather data', apiError);
      setError('Unable to load live weather data right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const hasLoggedUsageRef = useRef(false);

  useEffect(() => {
    if (!hasLoggedUsageRef.current) {
      logFeatureUsage('live_data');
      hasLoggedUsageRef.current = true;
    }
  }, [logFeatureUsage]);

  useEffect(() => {
    loadWeather();
  }, []); // Remove loadWeather from dependency array to prevent infinite loop

  const handleRefresh = () => {
    setRefreshing(true);
    loadWeather(true);
  };

  const handleStateSelected = (state) => {
    console.log(`📍 State selected from map: ${state.name}`);
    setSelectedState(state);
  };

  const toggleWeatherExpansion = () => {
    setIsWeatherExpanded(!isWeatherExpanded);
  };

  const toggleRainOutlookExpansion = () => {
    setIsRainOutlookExpanded(!isRainOutlookExpanded);
  };

  const formatMetricValue = (value, decimals = 0) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '--';
    }

    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  };

  const processRiverData = (riverData) => {
    if (!riverData || riverData.error || !riverData.current) {
      return {
        discharge: 'N/A',
        status: 'N/A',
        statusColor: COLORS.TEXT_SECONDARY
      };
    }

    const discharge = parseFloat(riverData.current);
    const percentile = riverData.statistics?.percentile || 0;

    let status, statusColor;
    if (percentile >= 95) {
      status = 'Extreme';
      statusColor = COLORS.ERROR;
    } else if (percentile >= 90) {
      status = 'Very High';
      statusColor = COLORS.ERROR;
    } else if (percentile >= 75) {
      status = 'High';
      statusColor = COLORS.WARNING;
    } else if (percentile >= 50) {
      status = 'Above Normal';
      statusColor = COLORS.INFO;
    } else {
      status = 'Normal';
      statusColor = COLORS.SUCCESS;
    }

    return {
      discharge: formatMetricValue(discharge, 1),
      status,
      statusColor
    };
  };

  const renderMetric = (iconName, label, rawValue, unit) => {
    const displayValue = rawValue === undefined || rawValue === null ? '--' : rawValue;
    const valueText = displayValue === '--' ? '--' : `${displayValue}${unit}`;

    return (
      <View style={styles.metricCard} key={label}>
        <View style={styles.metricIconWrapper}>
          <Ionicons name={iconName} size={20} color={COLORS.PRIMARY} />
        </View>
        <Text style={styles.metricValue}>{valueText}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    );
  };

  const renderCompactMetric = (iconName, rawValue, unit, label) => {
    const displayValue = rawValue === undefined || rawValue === null ? '--' : rawValue;
    const valueText = displayValue === '--' ? '--' : `${displayValue}${unit}`;

    return (
      <View style={styles.compactMetricCard} key={label}>
        <View style={styles.compactMetricHeader}>
          <Ionicons name={iconName} size={16} color={COLORS.PRIMARY} />
          <Text style={styles.compactMetricValue}>{valueText}</Text>
        </View>
        <Text style={styles.compactMetricLabel}>{label}</Text>
      </View>
    );
  };

  // Visual forecast components
  const renderWaterDropIndicator = (amount) => {
    // Don't show drops for dry days
    if (amount === 0) {
      return (
        <View style={styles.precipitationBarContainer}>
          <Text style={styles.dryLabel}>Dry</Text>
        </View>
      );
    }

    const filledDrops = getWaterDropsFilled(amount);
    const totalDrops = 5;

    return (
      <View style={styles.precipitationBarContainer}>
        <View style={styles.waterDropRow}>
          {[...Array(totalDrops)].map((_, index) => {
            const isFilled = index < filledDrops;
            const dropColor = isFilled ? getWaterDropColor(amount, index) : '#E0E0E0';

            return (
              <Ionicons
                key={index}
                name={isFilled ? "water" : "water-outline"}
                size={14}
                color={dropColor}
                style={styles.waterDrop}
              />
            );
          })}
        </View>
        <Text style={styles.precipitationAmount}>{amount}mm</Text>
      </View>
    );
  };

  const renderProbabilityBadge = (probability) => {
    const label = getProbabilityLabel(probability);
    const style = getProbabilityStyle(probability);

    // Don't show badge for dry days
    if (!label || !style) {
      return null;
    }

    return (
      <View style={[styles.probabilityLabel, style]}>
        <Text style={[styles.probabilityText, { color: style.color }]}>{label}</Text>
      </View>
    );
  };

  const formatUpdatedLabel = (timestamp) => {
    if (!timestamp) {
      return 'Updated just now';
    }

    const updatedTime = new Date(timestamp);
    const diffMinutes = Math.floor((Date.now() - updatedTime.getTime()) / 60000);

    if (diffMinutes < 1) {
      return 'Updated just now';
    }

    if (diffMinutes < 60) {
      return `Updated ${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `Updated ${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    }

    return `Updated on ${updatedTime.toLocaleDateString()} ${updatedTime
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      .toLowerCase()}`;
  };

  const rainDays = weatherData?.rain_forecast?.upcoming_rain_days || [];

  // Generate smart summary for rain outlook
  const generateRainSummary = (rainDays) => {
    if (!rainDays || rainDays.length === 0) return 'No rain data available';

    const rainyDays = rainDays.filter(day => day.precipitation > 0);
    const rainDaysCount = rainyDays.length;

    if (rainDaysCount >= 5) return 'Very rainy week ahead';
    if (rainDaysCount >= 3) return 'Rainy week expected';
    if (rainDaysCount >= 1) return 'Some rain expected';
    return 'Dry week ahead';
  };

  // Visual forecast helper functions
  const getWeatherIcon = (intensity, precipitation) => {
    if (precipitation === 0) return 'partly-sunny-outline';
    if (intensity === 'Heavy') return 'thunderstorm-outline';
    if (intensity === 'Moderate') return 'rainy-outline';
    return 'rainy-outline'; // Light/Drizzle
  };

  const getWaterDropsFilled = (amount) => {
    // 0-10mm = 1 drop, 11-20mm = 2 drops, 21-30mm = 3 drops, 31-40mm = 4 drops, 40mm+ = 5 drops
    if (amount <= 0) return 0;
    if (amount <= 10) return 1;
    if (amount <= 20) return 2;
    if (amount <= 30) return 3;
    if (amount <= 40) return 4;
    return 5; // 40mm+
  };

  const getProbabilityLabel = (probability) => {
    if (probability <= 20) return null; // No label for dry days
    if (probability <= 50) return 'Low chance';
    if (probability <= 80) return 'Likely';
    return 'High chance';
  };

  const getProbabilityStyle = (probability) => {
    if (probability <= 20) return null;
    if (probability <= 50) return {
      backgroundColor: '#FFF3E0',
      color: '#F57C00',
      borderColor: '#F57C00'
    };
    if (probability <= 80) return {
      backgroundColor: '#E8F5E9',
      color: '#388E3C',
      borderColor: '#388E3C'
    };
    return {
      backgroundColor: '#E3F2FD',
      color: '#1976D2',
      borderColor: '#1976D2'
    };
  };

  const getWaterDropColor = (amount, index) => {
    // Color gradient based on rain intensity
    // Light rain (1-10mm): Light blue
    // Moderate rain (11-20mm): Medium blue, gradient
    // Heavy rain (21-30mm): Darker blue, stronger gradient
    // Very heavy (31-40mm): Dark blue
    // Extreme (40mm+): Darkest blue

    if (amount <= 10) return '#42A5F5'; // Light blue for all drops
    if (amount <= 20) {
      // Gradient from light to medium blue
      return index === 0 ? '#42A5F5' : '#1E88E5';
    }
    if (amount <= 30) {
      // Gradient from medium to dark blue
      const colors = ['#42A5F5', '#1E88E5', '#1976D2'];
      return colors[Math.min(index, 2)];
    }
    if (amount <= 40) {
      // Gradient to darker blue
      const colors = ['#1E88E5', '#1976D2', '#1565C0', '#1565C0'];
      return colors[Math.min(index, 3)];
    }
    // Extreme rain - darkest blue with gradient
    const colors = ['#1976D2', '#1565C0', '#0D47A1', '#0D47A1', '#0D47A1'];
    return colors[Math.min(index, 4)];
  };

  // Calculate proper bottom padding to account for tab bar and safe area
  const scrollContentStyle = [
    styles.scrollContent,
    { paddingBottom: 40 + insets.bottom + 60 + 20 } // base padding + safe area + tab bar height + buffer
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BACKGROUND }} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={scrollContentStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.PRIMARY}
          />
        }
      >
      <View style={styles.headerRow}>
        <View style={styles.headingContainer}>
          <Text style={styles.pageTitle}>Live Weather Dashboard</Text>
          <Text style={styles.pageSubtitle} numberOfLines={2}>
            {locationLabel || 'Detecting your location...'}
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Data</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loaderText}>Fetching real-time weather...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={32} color={COLORS.ERROR} />
          <Text style={styles.errorTitle}>Unable to load live data</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadWeather(true)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : weatherData ? (
        <>
          <View style={styles.compactWeatherCard}>
            <View style={styles.compactCardHeader}>
              <View style={styles.headerLeft}>
                <Ionicons name="cloud-outline" size={24} color={COLORS.PRIMARY} style={styles.weatherIcon} />
                <Text style={styles.compactCardTitle}>Environmental Monitoring</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDotSmall} />
                  <Text style={styles.liveTextSmall}>Live Data</Text>
                </View>
                <TouchableOpacity onPress={toggleWeatherExpansion} style={styles.expandButton}>
                  <Ionicons
                    name={isWeatherExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={COLORS.TEXT_SECONDARY}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.compactMetricGrid}>
              {/* Compact view: Show only 2 most critical flood-risk metrics */}
              {renderCompactMetric(
                'rainy-outline',
                formatMetricValue(weatherData.weather_summary?.rainfall_24h_forecast, 1),
                'mm',
                'Rainfall'
              )}
              {(() => {
                const riverProcessed = processRiverData(riverData);
                return renderCompactMetric(
                  'analytics-outline',
                  riverProcessed.status,
                  '',
                  'River Level'
                );
              })()}

              {/* Expanded view: Show additional metrics */}
              {isWeatherExpanded && renderCompactMetric(
                'thermometer-outline',
                formatMetricValue(weatherData.weather_summary?.current_temp),
                '°C',
                'Temperature'
              )}
              {isWeatherExpanded && (() => {
                const riverProcessed = processRiverData(riverData);
                return renderCompactMetric(
                  'water-outline',
                  riverProcessed.discharge,
                  riverProcessed.discharge === 'N/A' ? '' : ' m³/s',
                  'River Flow'
                );
              })()}
              {isWeatherExpanded && renderCompactMetric(
                'partly-sunny-outline',
                formatMetricValue(weatherData.weather_summary?.current_humidity),
                '%',
                'Humidity'
              )}
              {isWeatherExpanded && renderCompactMetric(
                'speedometer-outline',
                formatMetricValue(weatherData.weather_summary?.wind_speed),
                'km/h',
                'Wind Speed'
              )}
            </View>
          </View>

          <View style={styles.forecastCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>7-Day Rain Outlook</Text>
                <Text style={styles.sectionSubtitle}>
                  {generateRainSummary(rainDays)}
                </Text>
              </View>
              <View style={styles.sectionHeaderRight}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.PRIMARY} />
                <TouchableOpacity onPress={toggleRainOutlookExpansion} style={styles.expandButton}>
                  <Ionicons
                    name={isRainOutlookExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={COLORS.TEXT_SECONDARY}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {rainDays.length > 0 ? (
              <View style={styles.forecastList}>
                {(isRainOutlookExpanded ? rainDays : rainDays.slice(0, 1)).map((day, index, displayedDays) => (
                  <View
                    key={day.date}
                    style={[styles.forecastRow, index === displayedDays.length - 1 && styles.forecastRowLast]}
                  >
                    {(() => {
                      const isDryDay = day.precipitation === 0;

                      if (isRainOutlookExpanded) {
                        // Expanded view: Different layouts for dry vs rainy days
                        if (isDryDay) {
                          return (
                            <View style={styles.dryDayExpanded}>
                              <View style={styles.forecastDaySection}>
                                <Text style={styles.forecastDay}>{day.day_name}</Text>
                              </View>
                              <View style={styles.forecastWeatherSection}>
                                <Ionicons
                                  name="partly-sunny-outline"
                                  size={24}
                                  color="#FFA726"
                                  style={styles.weatherIcon}
                                />
                              </View>
                              <View style={styles.dryIndicatorSection}>
                                <Text style={styles.dryText}>Dry</Text>
                              </View>
                            </View>
                          );
                        } else {
                          return (
                            <View style={styles.rainyDayExpanded}>
                              <View style={styles.forecastDaySection}>
                                <Text style={styles.forecastDay}>{day.day_name}</Text>
                              </View>
                              <View style={styles.forecastWeatherSection}>
                                <Ionicons
                                  name={getWeatherIcon(day.intensity, day.precipitation)}
                                  size={24}
                                  color={COLORS.PRIMARY}
                                  style={styles.weatherIcon}
                                />
                              </View>
                              <View style={styles.forecastPrecipSection}>
                                {renderWaterDropIndicator(day.precipitation)}
                              </View>
                              <View style={styles.forecastProbabilitySection}>
                                {renderProbabilityBadge(day.probability)}
                              </View>
                            </View>
                          );
                        }
                      } else {
                        // Compact view: Different layouts for dry vs rainy days
                        if (isDryDay) {
                          return (
                            <View style={styles.dryDayCompact}>
                              <View style={styles.compactDaySection}>
                                <Text style={styles.compactDayText}>{day.day_name}</Text>
                              </View>
                              <View style={styles.compactWeatherSection}>
                                <Ionicons
                                  name="partly-sunny-outline"
                                  size={20}
                                  color="#FFA726"
                                />
                              </View>
                              <View style={styles.compactDrySection}>
                                <Text style={styles.compactDryText}>Dry</Text>
                              </View>
                            </View>
                          );
                        } else {
                          return (
                            <View style={styles.rainyDayCompact}>
                              <View style={styles.compactDaySection}>
                                <Text style={styles.compactDayText}>{day.day_name}</Text>
                              </View>
                              <View style={styles.compactWeatherSection}>
                                <Ionicons
                                  name={getWeatherIcon(day.intensity, day.precipitation)}
                                  size={20}
                                  color={COLORS.PRIMARY}
                                />
                              </View>
                              <View style={styles.compactPrecipSection}>
                                {renderWaterDropIndicator(day.precipitation)}
                              </View>
                              <View style={styles.compactProbabilitySection}>
                                {renderProbabilityBadge(day.probability)}
                              </View>
                            </View>
                          );
                        }
                      }
                    })()}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noRainMessage}>No significant rainfall expected in the next 7 days.</Text>
            )}

          </View>

          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.sectionTitle}>Malaysia Flood Risk Map</Text>
                <Text style={styles.sectionSubtitle}>
                  Real-time flood risk assessment across Malaysian states
                </Text>
              </View>
              <Ionicons name="map-outline" size={24} color={COLORS.PRIMARY} />
            </View>

            <View style={styles.mapContainer}>
              <FloodRiskMapView
                style={styles.floodMap}
                onStateSelected={handleStateSelected}
              />
            </View>

            {selectedState && (
              <View style={styles.selectedStateInfo}>
                <Text style={styles.selectedStateTitle}>
                  {selectedState.name} - {selectedState.riskData.riskLevel} Risk
                </Text>
                <Text style={styles.selectedStateDetails}>
                  {Math.round(selectedState.riskData.floodProbability * 100)}% flood probability
                  {selectedState.riskData.weatherSummary &&
                    ` • ${selectedState.riskData.weatherSummary.temperature}°C • ${selectedState.riskData.weatherSummary.rainfall}mm rain`
                  }
                </Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headingContainer: {
    flex: 1,
    paddingRight: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  pageSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SUCCESS,
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  loaderContainer: {
    marginTop: 80,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  errorCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  retryButtonText: {
    color: COLORS.TEXT_ON_PRIMARY,
    fontWeight: '600',
  },
  weatherCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 5,
    marginBottom: 20,
  },
  compactWeatherCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  compactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherIcon: {
    marginRight: 8,
  },
  compactCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.SUCCESS,
    marginRight: 4,
  },
  liveTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  expandButton: {
    marginLeft: 8,
    padding: 4,
  },
  compactMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  compactMetricCard: {
    flexBasis: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  compactMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 6,
  },
  compactMetricLabel: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  metricCard: {
    flexBasis: '48%',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  metricIconWrapper: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  metricLabel: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  forecastCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderLeft: {
    flex: 1,
    paddingRight: 16,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 6,
    maxWidth: '85%',
  },
  forecastList: {
    marginTop: 20,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
  },
  forecastRowLast: {
    borderBottomWidth: 0,
  },
  forecastInfo: {
    flex: 1,
  },
  forecastDay: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  forecastCondition: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  forecastMetrics: {
    alignItems: 'flex-end',
  },
  forecastAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  forecastProbability: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  noRainMessage: {
    marginTop: 20,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  forecastCompact: {
    flex: 1,
  },
  forecastCompactText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
  },
  nextRainText: {
    marginTop: 18,
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  mapSection: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#F5F5F5',
  },
  floodMap: {
    flex: 1,
  },
  selectedStateInfo: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectedStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  selectedStateDetails: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  // Visual forecast component styles
  precipitationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  precipitationSegment: {
    width: 8,
    height: 4,
    borderRadius: 2,
  },
  waterDropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  waterDrop: {
    marginHorizontal: 1,
  },
  probabilityBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  probabilityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Visual forecast layout styles
  visualForecastCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  visualForecastExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  compactDaySection: {
    flex: 2,
  },
  compactDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  compactWeatherSection: {
    flex: 1,
    alignItems: 'center',
  },
  compactPrecipSection: {
    flex: 2,
    alignItems: 'center',
  },
  compactProbabilitySection: {
    flex: 1,
    alignItems: 'center',
  },
  // Expanded view sections
  forecastDaySection: {
    flex: 2,
  },
  forecastWeatherSection: {
    flex: 1,
    alignItems: 'center',
  },
  forecastPrecipSection: {
    flex: 2.5,
    alignItems: 'center',
  },
  forecastProbabilitySection: {
    flex: 1.2,
    alignItems: 'center',
  },
  precipitationAmount: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    textAlign: 'center',
  },
  weatherIcon: {
    marginRight: 4,
  },
  // Enhanced visual styles for improved contrast and clarity
  precipitationBarContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  dryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
  },
  probabilityLabel: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 50,
    maxWidth: 80,
    alignItems: 'center',
  },
  // Dry day layouts
  dryDayExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
    opacity: 0.7, // Subtle visual hierarchy
  },
  dryDayCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    opacity: 0.7, // Subtle visual hierarchy
  },
  dryIndicatorSection: {
    flex: 3,
    alignItems: 'center',
  },
  dryText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
  },
  compactDrySection: {
    flex: 2,
    alignItems: 'center',
  },
  compactDryText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
  },
  // Rainy day layouts
  rainyDayExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  rainyDayCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
});
