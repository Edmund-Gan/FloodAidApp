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
import { UserContext } from '../context/UserContext';
import { COLORS } from '../utils/constants';
import RealTimeWeatherService from '../services/RealTimeWeatherService';
import LocationService from '../services/LocationService';
import FloodRiskMapView from '../components/FloodRiskMapView';

const realTimeWeatherService = new RealTimeWeatherService();

const FALLBACK_LOCATION = {
  lat: 3.139,
  lon: 101.6869,
  label: 'Kuala Lumpur, Malaysia',
};

export default function LiveDataScreen() {
  const { logFeatureUsage } = useContext(UserContext);
  const [weatherData, setWeatherData] = useState(null);
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
        const locationResult = await LocationService.getCurrentLocation();
        if (locationResult?.lat && locationResult?.lon) {
          weatherLocation = {
            lat: locationResult.lat,
            lon: locationResult.lon,
            label:
              locationResult.display_name ||
              locationResult.name ||
              locationResult.locationName ||
              'Current Location',
          };
        }
      } catch (locationError) {
        console.warn('LiveDataScreen: Falling back to default location', locationError);
      }

      if (!weatherLocation) {
        weatherLocation = FALLBACK_LOCATION;
      }

      const data = await realTimeWeatherService.getHomePageWeatherData(
        weatherLocation.lat,
        weatherLocation.lon
      );

      setWeatherData(data);
      setLocationLabel(weatherLocation.label);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
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
                <Text style={styles.compactCardTitle}>Weather Monitoring</Text>
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
              {renderCompactMetric(
                'thermometer-outline',
                formatMetricValue(weatherData.weather_summary?.current_temp),
                '°C',
                'Temperature'
              )}
              {renderCompactMetric(
                'rainy-outline',
                formatMetricValue(weatherData.weather_summary?.rainfall_24h_forecast, 1),
                'mm',
                'Rainfall'
              )}
              {isWeatherExpanded && renderCompactMetric(
                'water-outline',
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
                  {weatherData.rain_forecast?.rain_summary || 'Monitoring precipitation trends for your area'}
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
                {(isRainOutlookExpanded ? rainDays : rainDays.slice(0, 2)).map((day, index, displayedDays) => (
                  <View
                    key={day.date}
                    style={[styles.forecastRow, index === displayedDays.length - 1 && styles.forecastRowLast]}
                  >
                    <View style={styles.forecastInfo}>
                      <Text style={styles.forecastDay}>{day.day_name}</Text>
                      <Text style={styles.forecastCondition}>{day.intensity}</Text>
                    </View>
                    <View style={styles.forecastMetrics}>
                      <Text style={styles.forecastAmount}>{day.precipitation}mm</Text>
                      <Text style={styles.forecastProbability}>{day.probability}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noRainMessage}>No significant rainfall expected in the next 7 days.</Text>
            )}

            {weatherData.rain_forecast?.next_rain_in_hours != null && (
              <Text style={styles.nextRainText}>
                Next rain in approximately {weatherData.rain_forecast.next_rain_in_hours} hours.
              </Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 50,
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
    paddingVertical: 16,
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
});
