import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  RefreshControl,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import Svg, { Path, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FloodPredictionModel from './services/FloodPredictionModel';
import LocationService from './services/LocationService';
import GeoJSONService from './services/GeoJSONService';
import FloodAlert from './components/FloodAlert';
import FloodAlertDetails from './components/FloodAlertDetails';
import RiskFactorIndicator from './components/RiskFactorIndicator';
import FactorDetailModal from './components/FactorDetailModal';
import CompactRiskFactorIndicator from './components/CompactRiskFactorIndicator';
import floodAlertService from './utils/FloodAlertService';
import devAlertTrigger from './utils/DevAlertTrigger';
import { STATE_ACCURACY_DATA } from './utils/constants';
import { RISK_COLORS, getRiskColor, getRiskLevel } from './utils/RiskCalculations';
import MockDataService from './utils/MockDataService';
import RealTimeWeatherService from './services/RealTimeWeatherService';
import DeveloperModeButton from './components/DeveloperModeButton';
import { notificationService } from './utils/NotificationService';

// Import FloodHotspotsScreen for Epic 3 - Using CSV data version
import FloodHotspotsScreen from './screens/FloodHotspotsCSV';

// Import Multi-Location Alerts Components and Context
import MyLocationsScreen from './screens/MyLocationsScreen';
import { LocationProvider } from './context/LocationContext';
import { UserProvider } from './context/UserContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// Google Maps API Key Configuration
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || 
                            Constants.manifest?.extra?.googleMapsApiKey ||
                            'AIzaSyC-0v96Q4G43rh8tuLfzTaACTfVA-oSwGM';



// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://192.168.1.100:8000/api'  // Local development
  : 'https://floodaid-api.malaysia.gov.my/api';  // Production

// Generate dynamic risk descriptions based on prediction data
const getRiskDescription = (prediction, locationInfo) => {
  
  // Safety check for null prediction or N/A values
  if (!prediction || prediction.flood_probability === undefined || prediction.flood_probability === null) {
    return prediction?.is_na ? 
      'Flood prediction unavailable. Please check your connection and try again.' :
      'Prediction data unavailable. Please try again.';
  }
  
  const riskLevel = getRiskLevel(prediction.flood_probability);
  const probability = Math.round(prediction.flood_probability * 100);
  
  // Handle both number (0.756) and string ("76%") confidence formats, plus null values
  const confidence = prediction.confidence !== null && prediction.confidence !== undefined ? 
    (typeof prediction.confidence === 'string' ? 
      Math.round(parseFloat(prediction.confidence.replace('%', '')) || 0) : 
      Math.round(prediction.confidence * 100)) : null;
      
  const location = locationInfo?.display_name || 'your area';
  
  
  const baseDescriptions = {
    'Low': [
      `${location} has a ${probability}% flood probability. Conditions are currently favorable with low risk.`,
      `Weather conditions show minimal flood risk (${probability}%) for ${location}. Continue normal activities.`,
      `Current forecast indicates low flood risk (${probability}%) for your location. Stay weather-aware.`
    ],
    'Medium': [
      `${location} shows ${probability}% flood probability. Monitor conditions and prepare for potential flooding.`,
      `Moderate flood risk (${probability}%) detected for ${location}. Consider reviewing your emergency plans.`,
      `Weather patterns indicate ${probability}% flood risk. Stay alert and monitor local conditions.`
    ],
    'High': [
      `HIGH ALERT: ${probability}% flood probability for ${location}. Take immediate precautions.`,
      `URGENT: ${location} faces ${probability}% flood risk. Prepare for potential evacuation.`,
      `CRITICAL: High flood probability (${probability}%) detected. Follow emergency procedures immediately.`
    ]
  };
  
  const descriptions = baseDescriptions[riskLevel] || baseDescriptions['Low'];
  const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
  
  // Add ML model confidence description
  let confidenceText = '';
  if (confidence !== null && confidence > 0) {
    // Use actual ML model confidence (F1 score: 71.25%)
    const displayConfidence = confidence;
    
    // Get data sources from enhanced prediction metadata  
    const dataSources = prediction.data_sources || ['GPS', 'Google Maps', 'Open Meteo Professional', 'Enhanced ML Model'];
    const primarySources = dataSources.slice(0, 3);
    
    const modelType = prediction.model_info?.model_type || 'ML Model';
    const featuresCount = prediction.model_info?.features_count || 'multiple';
    
    confidenceText = ` Based on enhanced ${featuresCount}-feature ${modelType}, we have ${displayConfidence}% accuracy.\nData Source: ${primarySources.join(', ')}.`;
    
    // Add monsoon context if available
    if (prediction.weather_summary?.monsoon_season && prediction.weather_summary?.monsoon_season !== 'Unknown') {
      confidenceText += ` Current ${prediction.weather_summary.monsoon_season} conditions are factored into this prediction.`;
    }
  } else if (prediction?.is_na) {
    confidenceText = ' Prediction confidence unavailable due to API connectivity issues.';
  }
  
  const finalDescription = randomDescription + confidenceText;
  
  return finalDescription;
};


// Detailed Flood Prediction Modal Component
function FloodDetailsModal({ prediction, locationInfo, realTimeWeather, onClose }) {
  const [activeTab, setActiveTab] = useState('risk');

  if (!prediction || !locationInfo) {
    return (
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Flood Prediction Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.modalContent}>
          <Text>Loading prediction details...</Text>
        </View>
      </View>
    );
  }

  const renderRiskAnalysis = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>
          {prediction?.is_na ? 'Weather Data (Flood Prediction Unavailable)' : 'Risk Breakdown'}
        </Text>
        <View style={styles.riskMeter}>
          <View style={[styles.riskMeterFill, { 
            width: prediction?.is_na ? '0%' : `${prediction.flood_probability * 100}%`,
            backgroundColor: prediction?.is_na ? '#E0E0E0' : getRiskColor(prediction.flood_probability)
          }]} />
          <Text style={styles.riskMeterText}>
            {prediction?.is_na ? 'Flood Prediction Not Available' :
              Math.round(prediction.flood_probability * 100) + '% Flood Probability'}
          </Text>
        </View>
        
        <View style={styles.riskStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Risk Level</Text>
            <Text style={[styles.statValue, { color: prediction?.is_na ? '#666' : getRiskColor(prediction.flood_probability) }]}>
              {prediction?.is_na ? 'N/A' : prediction.risk_level}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Confidence</Text>
            <Text style={styles.statValue}>{Math.round(prediction.confidence * 100)}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Peak Risk</Text>
            <Text style={styles.statValue}>
              {prediction?.is_na ? 'N/A' : Math.round(prediction.timeframe_hours) + 'h'}
            </Text>
          </View>
        </View>
      </View>

      {/* Information section when prediction is N/A */}
      {prediction?.is_na && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Data Status</Text>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#2196F3" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>AI Flood Prediction Unavailable</Text>
              <Text style={styles.infoText}>
                {realTimeWeather ? 
                  'Current weather conditions are being monitored. Weather data is provided by Open Meteo API.' :
                  'Both AI prediction and weather monitoring are currently unavailable. Please check your internet connection.'}
              </Text>
              {realTimeWeather && (
                <Text style={styles.infoSubtext}>
                  Real-time temperature, rainfall, and atmospheric conditions are still available below.
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>
          {prediction?.is_na ? 'System Status' : 'Contributing Factors'}
        </Text>
        {prediction?.is_na ? (
          <View style={styles.factorDetailItem}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <Text style={styles.factorDetailText}>AI flood prediction system unavailable</Text>
          </View>
        ) : (
          (prediction.contributing_factors?.structured && prediction.contributing_factors.legacy_text ?
            prediction.contributing_factors.legacy_text :
            (Array.isArray(prediction.contributing_factors) ? prediction.contributing_factors : [])
          ).map((factor, index) => (
            <View key={index} style={styles.factorDetailItem}>
              <Ionicons name="warning-outline" size={20} color="#FF9800" />
              <Text style={styles.factorDetailText}>
                {typeof factor === 'string' ? factor : factor?.feature?.title || 'Unknown factor'}
              </Text>
            </View>
          ))
        )}
      </View>

      {prediction.risk_indicators && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Risk Indicators</Text>
          <View style={styles.indicatorGrid}>
            <View style={styles.indicatorItem}>
              <Ionicons 
                name={prediction.risk_indicators.heavy_rain_warning ? "warning" : "checkmark-circle"} 
                size={24} 
                color={prediction.risk_indicators.heavy_rain_warning ? "#FF9800" : "#4CAF50"} 
              />
              <Text style={styles.indicatorText}>Heavy Rain</Text>
            </View>
            <View style={styles.indicatorItem}>
              <Ionicons 
                name={prediction.risk_indicators.high_humidity_warning ? "warning" : "checkmark-circle"} 
                size={24} 
                color={prediction.risk_indicators.high_humidity_warning ? "#FF9800" : "#4CAF50"} 
              />
              <Text style={styles.indicatorText}>High Humidity</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderWeatherDetails = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Current Weather</Text>
        <View style={styles.weatherDetailGrid}>
          <View style={styles.weatherDetailItem}>
            <Ionicons name="thermometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherDetailLabel}>Temperature</Text>
            <Text style={styles.weatherDetailValue}>
              {realTimeWeather?.weather_summary?.current_temp || 
               prediction?.weather_summary?.current_temp || '--'}°C
            </Text>
          </View>
          <View style={styles.weatherDetailItem}>
            <Ionicons name="rainy-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherDetailLabel}>Past 24h Rainfall</Text>
            <Text style={styles.weatherDetailValue}>
              {realTimeWeather?.weather_summary?.rainfall_24h_past || 
               prediction?.weather_summary?.rainfall_24h || 0}mm
            </Text>
          </View>
          <View style={styles.weatherDetailItem}>
            <Ionicons name="rainy" size={24} color="#1976D2" />
            <Text style={styles.weatherDetailLabel}>Next 24h Forecast</Text>
            <Text style={styles.weatherDetailValue}>
              {realTimeWeather?.weather_summary?.rainfall_24h_forecast || 0}mm
            </Text>
          </View>
          <View style={styles.weatherDetailItem}>
            <Ionicons name="speedometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherDetailLabel}>Wind Speed</Text>
            <Text style={styles.weatherDetailValue}>
              {realTimeWeather?.weather_summary?.wind_speed || 
               prediction?.weather_summary?.wind_speed || '--'}km/h
            </Text>
          </View>
        </View>
      </View>

      {prediction.risk_indicators && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Weather Trends</Text>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Consecutive Rain Days</Text>
            <Text style={styles.trendValue}>
              {realTimeWeather?.weather_indicators?.consecutive_rain_days || 
               prediction?.risk_indicators?.consecutive_rain_days || 0} days
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Next 7 Days Forecast</Text>
            <Text style={styles.trendValue}>
              {Math.round(realTimeWeather?.weather_indicators?.total_forecast_rain || 
                         prediction?.risk_indicators?.total_forecast_rain || 0)}mm
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderLocationIntelligence = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Location Details</Text>
        <View style={styles.locationDetailItem}>
          <Ionicons name="location-outline" size={20} color="#666" />
          <View style={styles.locationDetailText}>
            <Text style={styles.locationDetailLabel}>Address</Text>
            <Text style={styles.locationDetailValue}>{locationInfo.display_name}</Text>
          </View>
        </View>
        <View style={styles.locationDetailItem}>
          <Ionicons name="map-outline" size={20} color="#666" />
          <View style={styles.locationDetailText}>
            <Text style={styles.locationDetailLabel}>Coordinates</Text>
            <Text style={styles.locationDetailValue}>
              {locationInfo.lat.toFixed(4)}, {locationInfo.lon.toFixed(4)}
            </Text>
          </View>
        </View>
        <View style={styles.locationDetailItem}>
          <Ionicons name="flag-outline" size={20} color="#666" />
          <View style={styles.locationDetailText}>
            <Text style={styles.locationDetailLabel}>State</Text>
            <Text style={styles.locationDetailValue}>{locationInfo.state}</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Model Information</Text>
        <View style={styles.modelInfoItem}>
          <Text style={styles.modelInfoLabel}>Prediction Time</Text>
          <Text style={styles.modelInfoValue}>
            {new Date(prediction.timestamp).toLocaleString()}
          </Text>
        </View>
        <View style={styles.modelInfoItem}>
          <Text style={styles.modelInfoLabel}>Model Version</Text>
          <Text style={styles.modelInfoValue}>{prediction.model_version || 'v1.0'}</Text>
        </View>
        <View style={styles.modelInfoItem}>
          <Text style={styles.modelInfoLabel}>Data Sources</Text>
          <Text style={styles.modelInfoValue}>
            {prediction.data_sources?.join(', ') || 'GPS, Google Maps, Open Meteo'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const tabs = [
    { id: 'risk', label: 'Risk Analysis', icon: 'analytics-outline' },
    { id: 'weather', label: 'Weather', icon: 'cloud-outline' },
    { id: 'location', label: 'Location', icon: 'location-outline' }
  ];

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Flood Prediction Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.modalTabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? '#2196F3' : '#666'} 
            />
            <Text style={[
              styles.tabButtonText,
              activeTab === tab.id && styles.activeTabButtonText
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.modalContent}>
        {activeTab === 'risk' && renderRiskAnalysis()}
        {activeTab === 'weather' && renderWeatherDetails()}
        {activeTab === 'location' && renderLocationIntelligence()}
      </View>
    </View>
  );
}

// Development: Malaysian locations for manual testing
const malaysianLocations = [
  { name: 'Puchong, Selangor', lat: 3.0738, lon: 101.5183, state: 'Selangor' },
  { name: 'Kuala Lumpur', lat: 3.1390, lon: 101.6869, state: 'Kuala Lumpur' },
  { name: 'Subang Jaya, Selangor', lat: 3.1478, lon: 101.5820, state: 'Selangor' },
  { name: 'Johor Bahru, Johor', lat: 1.4927, lon: 103.7414, state: 'Johor' },
  { name: 'Penang, Penang', lat: 5.4164, lon: 100.3327, state: 'Penang' },
  { name: 'Kota Kinabalu, Sabah', lat: 5.9804, lon: 116.0735, state: 'Sabah' },
  { name: 'Kuching, Sarawak', lat: 1.5533, lon: 110.3592, state: 'Sarawak' },
];

// Use centralized mock data service
const getMockMLPrediction = () => MockDataService.getMockMLPrediction();

// Initialize real-time weather service
const realTimeWeatherService = new RealTimeWeatherService();

// Home/Current Risk Screen (Epic 1: AI-Based Prediction)
function HomeScreen() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [locationInfo, setLocationInfo] = useState(null);
  const [error, setError] = useState(null);
  const [realTimeWeather, setRealTimeWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [devLocation, setDevLocation] = useState(null);
  const [useMockData, setUseMockData] = useState(false);
  const [skipGPS, setSkipGPS] = useState(false);
  const [isGPSRequestActive, setIsGPSRequestActive] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [showFloodAlert, setShowFloodAlert] = useState(false);
  const [showAlertDetails, setShowAlertDetails] = useState(false);
  const [selectedProbability, setSelectedProbability] = useState(60);
  const [selectedTimeframe, setSelectedTimeframe] = useState(6);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mlAlertThreshold, setMLAlertThreshold] = useState(60);
  const [enableMLAlerts, setEnableMLAlerts] = useState(true);
  const [selectedFactor, setSelectedFactor] = useState(null);
  const [showFactorModal, setShowFactorModal] = useState(false);
  const insets = useSafeAreaInsets();


  useEffect(() => {
    loadPrediction();
    setupFloodAlertMonitoring();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => {
      clearInterval(interval);
      floodAlertService.stopAllMonitoring();
      // Cancel any active GPS requests when component unmounts
      LocationService.cancelAllRequests();
      // Clear weather service cache on unmount
      realTimeWeatherService.clearCache();
    };
  }, []);

  const setupFloodAlertMonitoring = async () => {
    try {
      // Get current location for alert monitoring
      const locationResult = await LocationService.getCurrentLocation();
      if (locationResult.success) {
        const location = {
          lat: locationResult.location.latitude,
          lng: locationResult.location.longitude,
          name: locationResult.locationInfo?.display_name || 'Your Location'
        };
        
        // Start monitoring for flood alerts
        await floodAlertService.startMonitoring(location, handleFloodAlert);
      }
    } catch (error) {
      console.error('Error setting up flood alert monitoring:', error);
    }
  };

  const handleFloodAlert = (alert) => {
    setCurrentAlert(alert);
    setShowFloodAlert(!!alert);
  };

  const handleDismissAlert = () => {
    setShowFloodAlert(false);
    if (currentAlert && locationInfo) {
      floodAlertService.dismissAlert(locationInfo.lat, locationInfo.lon);
    }
  };

  const handlePreparationGuide = (alert) => {
    setShowFloodAlert(false);
    Alert.alert(
      '📋 Preparation Guide',
      `Priority: ${alert.preparationGuidance.priority}\n\n${alert.preparationGuidance.message}\n\nRecommended actions:\n${alert.preparationGuidance.actions.map((action, index) => `${index + 1}. ${action}`).join('\n')}\n\nEstimated time: ${alert.preparationGuidance.timeEstimate}`,
      [
        { text: 'OK', style: 'default' },
        { text: 'View Full Guide', onPress: () => {/* Navigate to preparation screen */} }
      ]
    );
  };

  const handleViewAlertDetails = (alert) => {
    setShowFloodAlert(false);
    setShowAlertDetails(true);
  };

  const triggerTestAlert = async (scenarioKey) => {
    try {
      console.log(`🧪 Triggering test alert: ${scenarioKey}`);
      const alert = await devAlertTrigger.triggerTestAlert(scenarioKey, handleFloodAlert);
      if (alert) {
        console.log('✅ Test alert generated successfully');
      }
    } catch (error) {
      console.error('❌ Error triggering test alert:', error);
      Alert.alert('Test Alert Error', error.message);
    }
  };

  const handleMLAlertThresholdChange = (threshold) => {
    setMLAlertThreshold(threshold);
    floodAlertService.setMLAlertThreshold(threshold / 100);
  };

  const handleMLAlertsToggle = () => {
    const newEnabled = !enableMLAlerts;
    setEnableMLAlerts(newEnabled);
    floodAlertService.setMLAlertsEnabled(newEnabled);
  };

  const triggerTestMLAlert = async () => {
    try {
      const testLocation = selectedLocation || {
        lat: locationInfo?.lat || 3.1390,
        lon: locationInfo?.lon || 101.6869,
        name: locationInfo?.display_name || 'Current Location'
      };

      console.log(`🧪 Triggering ML alert test at ${mlAlertThreshold}% threshold`);
      const alert = await floodAlertService.triggerTestMLAlert(mlAlertThreshold / 100, testLocation);
      
      if (alert) {
        console.log('✅ ML test alert generated successfully');
      }
    } catch (error) {
      console.error('❌ Error triggering ML test alert:', error);
      Alert.alert('ML Alert Test Error', error.message);
    }
  };

  const triggerProbabilityAlert = async () => {
    try {
      // Use selected location or current location
      const location = selectedLocation || {
        lat: locationInfo?.lat || 3.1390,
        lon: locationInfo?.lon || 101.6869,
        name: locationInfo?.display_name || 'Current Location'
      };

      console.log(`🧪 Triggering probability-based alert:`, {
        probability: selectedProbability,
        timeframe: selectedTimeframe,
        location: location.name
      });

      const alert = await devAlertTrigger.generateProbabilityBasedAlert(
        selectedProbability,
        selectedTimeframe,
        location,
        handleFloodAlert
      );

      if (alert) {
        console.log('✅ Probability-based alert generated successfully');
      }
    } catch (error) {
      console.error('❌ Error triggering probability-based alert:', error);
      Alert.alert('Alert Generation Error', error.message);
    }
  };

  const handleFactorPress = (factor) => {
    setSelectedFactor(factor);
    setShowFactorModal(true);
  };

  const handleCloseFactorModal = () => {
    setShowFactorModal(false);
    setSelectedFactor(null);
  };

  useEffect(() => {
    // Set default selected location to current location when available
    if (locationInfo && !selectedLocation) {
      setSelectedLocation({
        lat: locationInfo.lat,
        lon: locationInfo.lon,
        name: locationInfo.display_name || 'Current Location'
      });
    }
    
    // Load real-time weather when location info becomes available
    if (locationInfo && !realTimeWeather && !weatherLoading) {
      loadRealTimeWeather();
    }
  }, [locationInfo]);

  // Independent weather loading - separate from ML prediction failures
  useEffect(() => {
    // Trigger weather loading after initial mount, regardless of ML prediction status
    const timer = setTimeout(() => {
      if (!realTimeWeather && !weatherLoading) {
        console.log('🌤️ Triggering independent weather data loading...');
        loadRealTimeWeather();
      }
    }, 2000); // Wait 2 seconds for ML prediction to complete first

    return () => clearTimeout(timer);
  }, []); // Run only once on mount

  const loadPredictionWithRetry = async (isManualRetry = false, retryAttempt = 0) => {
    const debugId = Date.now();
    const currentRetry = isManualRetry ? retryCount + 1 : retryAttempt;
    
    
    try {
      if (isManualRetry) {
        setIsRetrying(true);
        setRetryCount(currentRetry);
      }
      
      setLoading(true);
      setError(null);
      
      // Increase timeout based on retry count (60s, 90s, 120s) - More generous for complex ML pipeline
      const timeoutDuration = 60000 + (currentRetry * 30000);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Prediction timeout after ${timeoutDuration/1000} seconds [${debugId}] (attempt ${currentRetry + 1})`));
        }, timeoutDuration);
      });
      
      // Development bypass: Use mock data if enabled
      let mlPrediction;
      if (useMockData) {
        mlPrediction = getMockMLPrediction();
      } else {
        // Track GPS request state to prevent race conditions
        setIsGPSRequestActive(true);
        console.log(`📍 [${debugId}]: Starting GPS-based prediction (skipGPS: ${skipGPS})`);
        
        try {
          // Epic 1: Use real GPS location, Google reverse geocoding, Open Meteo weather, and ML model
          mlPrediction = await Promise.race([
            FloodPredictionModel.getPredictionWithML(null, null, skipGPS),
            timeoutPromise
          ]);
        } finally {
          setIsGPSRequestActive(false);
        }
      }
      
      if (!mlPrediction) {
        throw new Error('ML prediction returned null/undefined');
      }
      
      
      // Store location info for UI
      setLocationInfo(mlPrediction.location);
      
      // Convert ML prediction to format expected by UI
      const uiPrediction = {
        risk_level: mlPrediction.risk_level,
        flood_probability: mlPrediction.flood_probability,
        confidence: mlPrediction.confidence,
        timeframe_hours: mlPrediction.timeframe_hours,
        expected_duration_hours: mlPrediction.expected_duration_hours,
        peak_probability: mlPrediction.peak_probability,
        contributing_factors: mlPrediction.contributing_factors,
        weather_summary: mlPrediction.weather_summary,
        risk_indicators: mlPrediction.risk_indicators,
        location: mlPrediction.location,
        timestamp: mlPrediction.timestamp,
        model_version: mlPrediction.model_version,
        data_sources: mlPrediction.data_sources
      };
      
      setPrediction(uiPrediction);
      
    } catch (error) {
      console.error(`❌ [${debugId}]: Epic 1 ML prediction failed (attempt ${currentRetry + 1}):`, error);
      console.error(`❌ [${debugId}]: Error stack:`, error.stack);
      
      // Auto-retry logic for first 2 failures, then fall back to mock data or show error
      if (currentRetry < 2 && !isManualRetry) {
        setTimeout(() => {
          loadPredictionWithRetry(false, currentRetry + 1);
        }, (currentRetry + 1) * 2000); // 2s, 4s delay
        return;
      }
      
      // After 3 attempts, don't fall back to mock data - show proper N/A state
      if (currentRetry >= 2) {
        console.log(`⚠️ [${debugId}]: Maximum retry attempts reached, showing N/A prediction`);
      }
      
      setError({
        message: error.message,
        timestamp: new Date().toISOString(),
        canRetry: true,
        retryCount: currentRetry
      });
      
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsRetrying(false);
    }
  };

  // Simple wrapper for initial load and backward compatibility
  const loadPrediction = async () => {
    await loadPredictionWithRetry(false, 0);
    // Load real-time weather data after getting location
    if (locationInfo) {
      await loadRealTimeWeather();
    }
  };

  const loadRealTimeWeather = async () => {
    setWeatherLoading(true);
    try {
      let weatherLocation = locationInfo;
      
      // If ML prediction failed and locationInfo is null, get location independently for weather
      if (!weatherLocation) {
        console.log('🌤️ ML prediction failed, getting location independently for weather...');
        try {
          const locationResult = await LocationService.getCurrentLocation(skipGPS);
          if (locationResult && locationResult.lat && locationResult.lon) {
            weatherLocation = {
              lat: locationResult.lat,
              lon: locationResult.lon,
              display_name: locationResult.display_name || 'Current Location'
            };
            console.log('✅ Independent location obtained for weather:', weatherLocation.display_name);
          }
        } catch (locationError) {
          console.error('❌ Failed to get location for weather:', locationError);
          // Use fallback coordinates for Malaysia (Kuala Lumpur city center)
          weatherLocation = {
            lat: 3.1390,
            lon: 101.6869,
            display_name: 'Malaysia (Fallback Location)',
            isFallback: true
          };
          console.log('⚠️ Using fallback location for weather data');
        }
      }
      
      if (weatherLocation) {
        console.log('🌤️ Loading real-time weather data for home page...');
        const weatherData = await realTimeWeatherService.getHomePageWeatherData(
          weatherLocation.lat, 
          weatherLocation.lon
        );
        setRealTimeWeather(weatherData);
        console.log('✅ Real-time weather data loaded successfully');
      } else {
        console.log('⚠️ No location available for weather data');
      }
    } catch (error) {
      console.error('❌ Error loading real-time weather:', error);
      // Weather API failure is now independent of ML prediction failure
      // Keep existing prediction data if weather fails
    } finally {
      setWeatherLoading(false);
    }
  };

  const updateCountdown = () => {
    if (prediction?.timeframe_hours) {
      const totalSeconds = prediction.timeframe_hours * 3600;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      setTimeRemaining({ hours, minutes, seconds });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPrediction();
  };




  const loadPredictionWithLocation = async (lat, lon) => {
    
    try {
      setLoading(true);
      setError(null);
      
      // Use FloodPredictionModel with custom coordinates
      const mlPrediction = await FloodPredictionModel.getPredictionWithML(lat, lon);
      
      
      // Convert ML prediction to UI format
      const uiPrediction = {
        risk_level: mlPrediction.risk_level,
        flood_probability: mlPrediction.flood_probability,
        confidence: mlPrediction.confidence,
        timeframe_hours: mlPrediction.timeframe_hours,
        expected_duration_hours: mlPrediction.expected_duration_hours,
        peak_probability: mlPrediction.peak_probability,
        contributing_factors: mlPrediction.contributing_factors,
        weather_summary: mlPrediction.weather_summary,
        risk_indicators: mlPrediction.risk_indicators,
        location: mlPrediction.location,
        timestamp: mlPrediction.timestamp,
        model_version: mlPrediction.model_version,
        data_sources: mlPrediction.data_sources
      };
      
      setPrediction(uiPrediction);
      
    } catch (error) {
      console.error('❌ Custom location ML prediction failed:', error);
      setError({
        message: error.message,
        timestamp: new Date().toISOString(),
        canRetry: true
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Handle null prediction data to prevent crashes
  if (!prediction) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: (insets?.bottom || 0) + 80 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>FloodAid</Text>
            {locationInfo && (
              <Text style={styles.locationText}>
                📍 {locationInfo.display_name} {locationInfo.isDev && '(Dev)'}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF9800" />
          <Text style={styles.errorTitle}>Prediction Unavailable</Text>
          <Text style={styles.errorMessage}>
            Unable to load flood prediction data. This may be due to network issues or service timeout.
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]} 
            onPress={() => !isRetrying && loadPredictionWithRetry(true)}
            disabled={isRetrying}
          >
            <Text style={styles.retryButtonText}>
              {isRetrying ? 'Retrying...' : `Try Again ${retryCount > 0 ? `(${retryCount + 1})` : ''}`}
            </Text>
          </TouchableOpacity>
          
          {/* Mock data toggle moved to developer controls only */}
        </View>
      </ScrollView>
    );
  }


  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: (insets?.bottom || 0) + 80 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>FloodAid</Text>
          {locationInfo && (
            <Text style={styles.locationText}>
              📍 {locationInfo.display_name} {locationInfo.isDev && '(Dev)'}
            </Text>
          )}
        </View>
      </View>



      {/* Main Risk Card */}
      <View style={styles.riskCard}>
        <View style={styles.riskHeader}>
          <View style={[styles.riskLevelIndicator, { 
            backgroundColor: prediction?.is_na ? '#9E9E9E' : getRiskColor(prediction.flood_probability) 
          }]}>
            <Text style={styles.riskLevelText}>
              {prediction?.is_na ? 'Weather Data Only' : `${getRiskLevel(prediction.flood_probability)} Risk`}
            </Text>
          </View>
        </View>
        
        <View style={styles.riskMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {prediction?.is_na ? 'N/A' : 
                (prediction.flood_probability !== null ? 
                  Math.round(prediction.flood_probability * 100) + '%' : 'N/A')}
            </Text>
            <Text style={styles.metricLabel}>Flood Risk</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {prediction.confidence !== null ? Math.round(prediction.confidence * 100) + '%' : 'N/A'}
            </Text>
            <Text style={styles.metricLabel}>Confidence</Text>
          </View>
        </View>
        
        <Text style={styles.riskDescription}>
          {getRiskDescription(prediction, locationInfo)}
        </Text>

        {/* Show status when ML fails */}
        {prediction?.is_na && (
          <View style={styles.partialDataWarning}>
            <Ionicons name="information-circle-outline" size={16} color="#FF9800" />
            <Text style={styles.partialDataText}>
              {realTimeWeather ? 
                'AI flood prediction unavailable. Showing current weather conditions only.' :
                'Both flood prediction and weather data unavailable. Please check your connection.'}
            </Text>
          </View>
        )}
        
        {/* Show countdown timer only for High risk when prediction is available */}
        {!prediction?.is_na && getRiskLevel(prediction.flood_probability) === 'High' && (
          <View style={styles.countdownSection}>
            <Text style={styles.countdownLabel}>Time Until Risk Peak:</Text>
            <Text style={styles.countdownValue}>
              {timeRemaining.hours}h {timeRemaining.minutes}m {timeRemaining.seconds}s
            </Text>
          </View>
        )}
      </View>


      {/* Risk Factors - Compact Display */}
      <View style={styles.factorsCard}>
        {prediction?.is_na ? (
          <View>
            <Text style={styles.cardTitle}>System Status</Text>
            <View style={styles.factorItem}>
              <Ionicons name="information-circle-outline" size={20} color="#666" />
              <Text style={styles.factorText}>AI flood prediction system currently unavailable</Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.compactFactorsHeader}>
              According to our prediction model, these are the key risk factors:
            </Text>
            
            {/* Check if we have structured factors with separated risk/protective factors */}
            {prediction.contributing_factors?.structured && (
              prediction.contributing_factors.riskFactors || prediction.contributing_factors.protectiveFactors
            ) ? (
              <View>
                {/* Risk Increasing Factors */}
                {prediction.contributing_factors.riskFactors?.length > 0 && (
                  <View style={styles.compactFactorSection}>
                    <Text style={styles.compactSectionTitle}>Risk Factors:</Text>
                    <View style={styles.compactFactorsRow}>
                      {prediction.contributing_factors.riskFactors.map((factor, index) => (
                        <CompactRiskFactorIndicator
                          key={factor.raw_feature || `risk-${index}`}
                          factor={factor}
                          onPress={handleFactorPress}
                        />
                      ))}
                    </View>
                  </View>
                )}
                
                {/* Protective Factors */}
                {prediction.contributing_factors.protectiveFactors?.length > 0 && (
                  <View style={styles.compactFactorSection}>
                    <Text style={styles.compactSectionTitle}>Protective:</Text>
                    <View style={styles.compactFactorsRow}>
                      {prediction.contributing_factors.protectiveFactors.map((factor, index) => (
                        <CompactRiskFactorIndicator
                          key={factor.raw_feature || `protective-${index}`}
                          factor={factor}
                          onPress={handleFactorPress}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Fallback to legacy text format */
              <View>
                {(prediction.contributing_factors?.legacy_text || 
                  (Array.isArray(prediction.contributing_factors) ? prediction.contributing_factors : [])
                ).slice(0, 4).map((factor, index) => (
                  <View key={index} style={styles.factorItem}>
                    <Ionicons name="alert-circle-outline" size={16} color="#ff9800" />
                    <Text style={styles.enhancedFactorText}>
                      {typeof factor === 'string' ? factor : factor?.feature?.title || 'Unknown factor'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Weather Card */}
      <View style={styles.weatherCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Current Weather</Text>
          {realTimeWeather && (
            <View style={styles.dataSourceIndicator}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>
        <View style={styles.weatherGrid}>
          <View style={styles.weatherItem}>
            <Ionicons name="thermometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>
              {realTimeWeather?.weather_summary?.current_temp || 
               prediction?.weather_summary?.current_temp || '--'}°C
            </Text>
            <Text style={styles.weatherLabel}>Temperature</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="water-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>
              {realTimeWeather?.humidity?.current || 
               prediction?.weather_summary?.humidity || '--'}%
            </Text>
            <Text style={styles.weatherLabel}>Humidity</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="rainy-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>
              {realTimeWeather?.weather_summary?.rainfall_24h_past || 
               prediction?.weather_summary?.rainfall_24h || 0}mm
            </Text>
            <Text style={styles.weatherLabel} numberOfLines={1}>Past 24h</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="rainy" size={24} color="#1976D2" />
            <Text style={styles.weatherValue}>
              {realTimeWeather?.weather_summary?.rainfall_24h_forecast || 0}mm
            </Text>
            <Text style={styles.weatherLabel} numberOfLines={1}>Next 24h</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="speedometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>
              {realTimeWeather?.weather_summary?.wind_speed || 
               prediction?.weather_summary?.wind_speed || '--'}km/h
            </Text>
            <Text style={styles.weatherLabel}>Wind Speed</Text>
          </View>
        </View>
      </View>

      {/* Rain Forecast Card */}
      {realTimeWeather?.rain_forecast && (
        <View style={styles.forecastCard}>
          <Text style={styles.cardTitle}>7-Day Rain Forecast</Text>
          
          {/* Rain Summary */}
          <View style={styles.forecastSummary}>
            <Ionicons name="rainy-outline" size={20} color="#2196F3" />
            <Text style={styles.forecastSummaryText}>
              {realTimeWeather?.rain_forecast?.rain_summary || 'No rain forecast available'}
            </Text>
          </View>

          {/* Upcoming Rain Days */}
          {realTimeWeather?.rain_forecast?.upcoming_rain_days?.length > 0 && (
            <View style={styles.rainDaysList}>
              {realTimeWeather.rain_forecast.upcoming_rain_days.slice(0, 3).map((rainDay, index) => (
                <View key={index} style={styles.rainDayItem}>
                  <Text style={styles.rainDayName}>{rainDay.day_name}</Text>
                  <View style={styles.rainDayDetails}>
                    <Text style={styles.rainDayAmount}>{rainDay.precipitation}mm</Text>
                    <Text style={styles.rainDayIntensity}>{rainDay.intensity}</Text>
                  </View>
                  <Text style={styles.rainDayProbability}>{rainDay.probability}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Next Rain Info */}
          {realTimeWeather?.rain_forecast?.next_rain_in_hours !== null && 
           realTimeWeather?.rain_forecast?.next_rain_in_hours !== undefined && (
            <View style={styles.nextRainInfo}>
              <Text style={styles.nextRainText}>
                Next rain in {Math.round(realTimeWeather.rain_forecast.next_rain_in_hours)} hours
              </Text>
            </View>
          )}
        </View>
      )}

      {/* REMOVED: Fallback Rain Forecast Card - redundant when prediction is N/A, weather data shown in main Weather Card */}

      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={() => setShowDetailsModal(true)}
      >
        <Text style={styles.primaryButtonText}>View Details</Text>
      </TouchableOpacity>

      {/* Developer Mode Button - Only visible in development */}
      <DeveloperModeButton onAlertGenerated={handleFloodAlert} />


      {/* Detailed Flood Prediction Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailsModal(false)}
        onDismiss={() => setShowDetailsModal(false)}
      >
        <FloodDetailsModal 
          prediction={prediction}
          locationInfo={locationInfo}
          realTimeWeather={realTimeWeather}
          onClose={() => setShowDetailsModal(false)}
        />
      </Modal>

      <FloodAlert
        alert={currentAlert}
        visible={showFloodAlert}
        onDismiss={handleDismissAlert}
        onPreparationGuide={handlePreparationGuide}
        onViewDetails={handleViewAlertDetails}
        autoHide={currentAlert?.severity === 'advisory'}
      />

      <FloodAlertDetails
        alert={currentAlert}
        visible={showAlertDetails}
        onClose={() => setShowAlertDetails(false)}
      />

      <FactorDetailModal
        visible={showFactorModal}
        factor={selectedFactor}
        onClose={handleCloseFactorModal}
      />
    </ScrollView>
  );
}

// Live Data Screen
function LiveDataScreen() {
  return (
    <View style={styles.centerContainer}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Data</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.upcomingFeaturesContainer}>
        <Ionicons name="analytics-outline" size={64} color="#2196F3" />
        <Text style={styles.upcomingFeaturesTitle}>Upcoming Features</Text>
        <Text style={styles.upcomingFeaturesDescription}>
          Real-time flood monitoring and live data visualization are currently being developed.
        </Text>
        <Text style={styles.upcomingFeaturesDescription}>
          Stay tuned for live rainfall tracking, river level monitoring, and interactive flood risk maps.
        </Text>
      </View>
    </View>
  );
}

// My Locations Screen - Now using the enhanced MyLocationsScreen component
function LocationsScreen({ navigation }) {
  return <MyLocationsScreen navigation={navigation} />;
}

// Emergency Screen
function EmergencyScreen() {
  const emergencyItems = [
    {
      title: 'What to do during flooding',
      description: 'Stay informed, evacuate if necessary, and avoid floodwaters.',
      icon: 'water',
      category: 'During Flooding'
    },
    {
      title: 'If power goes out',
      description: 'Use flashlights, conserve phone battery, and report outages.',
      icon: 'flash-off',
      category: 'Power Outage'
    },
    {
      title: 'When trapped indoors',
      description: 'Signal for help, move to the highest level, and stay calm.',
      icon: 'home',
      category: 'Trapped Indoors'
    },
    {
      title: 'Shut off utilities',
      description: 'Follow these steps to safely shut off electricity, gas, and water.',
      icon: 'settings',
      category: 'Utility Safety'
    },
    {
      title: 'Generate supplies list',
      description: 'Create a customized list based on your family size, medical needs, and duration.',
      icon: 'list',
      category: 'Emergency Supplies'
    }
  ];

  const makeEmergencyCall = () => {
    Alert.alert(
      'Emergency Call',
      'Choose emergency service to call:',
      [
        { text: '999 - Emergency', onPress: () => {} },
        { text: '994 - Fire & Rescue', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Response</Text>
        <TouchableOpacity onPress={makeEmergencyCall}>
          <Ionicons name="call" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Guidance</Text>

      {emergencyItems.map((item, index) => (
        <TouchableOpacity key={index} style={styles.emergencyCard}>
          <View style={styles.emergencyIcon}>
            <Ionicons name={item.icon} size={32} color="#2196F3" />
          </View>
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyCategory}>{item.category}</Text>
            <Text style={styles.emergencyTitle}>{item.title}</Text>
            <Text style={styles.emergencyDescription}>{item.description}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Emergency Navigation */}
      <View style={styles.navigationCard}>
        <View style={styles.navigationContent}>
          <Ionicons name="map" size={48} color="#2196F3" style={styles.navigationIcon} />
          <Text style={styles.navigationTitle}>Emergency Navigation</Text>
          <Text style={styles.navigationDescription}>Get directions to safe zones and evacuation routes</Text>
          <TouchableOpacity style={styles.navigationButton}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.navigationButtonText}>Find Nearest Shelter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Emergency Contacts */}
      <View style={styles.contactsCard}>
        <Text style={styles.cardTitle}>Emergency Contacts</Text>
        <TouchableOpacity style={styles.contactItem} onPress={makeEmergencyCall}>
          <Ionicons name="call" size={24} color="#F44336" />
          <Text style={styles.contactText}>999 - Emergency Services</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactItem}>
          <Ionicons name="call" size={24} color="#FF9800" />
          <Text style={styles.contactText}>994 - Fire & Rescue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Preparedness Screen
function PreparednessScreen() {
  return (
    <View style={styles.centerContainer}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flood Predictions</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.upcomingFeaturesContainer}>
        <Ionicons name="construct-outline" size={64} color="#2196F3" />
        <Text style={styles.upcomingFeaturesTitle}>Upcoming Features</Text>
        <Text style={styles.upcomingFeaturesDescription}>
          Advanced flood predictions and preparedness guides are currently being developed.
        </Text>
        <Text style={styles.upcomingFeaturesDescription}>
          Stay tuned for AI-powered flood forecasting, personalized safety recommendations, and emergency preparation checklists.
        </Text>
      </View>
    </View>
  );
}

// Main App Component
export default function App() {
  // Initialize notifications when app starts
  React.useEffect(() => {
    console.log('Initializing push notifications...');
    // NotificationService automatically sets up permissions and handlers
    // No need to explicitly call anything - it's initialized in the constructor
  }, []);

  return (
    <SafeAreaProvider>
      <UserProvider>
        <LocationProvider>
          <NavigationContainer>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <Tab.Navigator
              screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;
                if (route.name === 'Home') {
                  iconName = focused ? 'home' : 'home-outline';
                } else if (route.name === 'Predictions') {
                  iconName = focused ? 'trending-up' : 'trending-up-outline';
                } else if (route.name === 'Live Data') {
                  iconName = focused ? 'water' : 'water-outline';
                } else if (route.name === 'Hotspots') {
                  iconName = focused ? 'location' : 'location-outline';
                } else if (route.name === 'Locations') {
                  iconName = focused ? 'pin' : 'pin-outline';
                }
                return <Ionicons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#2196F3',
              tabBarInactiveTintColor: 'gray',
              tabBarStyle: styles.tabBar,
              headerShown: false,
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Predictions" component={PreparednessScreen} />
            <Tab.Screen name="Live Data" component={LiveDataScreen} />
            <Tab.Screen name="Hotspots" component={FloodHotspotsScreen} />
            <Tab.Screen name="Locations" component={LocationsScreen} />
          </Tab.Navigator>
          </NavigationContainer>
        </LocationProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  
  // Upcoming Features Styles
  upcomingFeaturesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  upcomingFeaturesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  upcomingFeaturesDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 22,
  },
  
  // Risk Card Styles
  riskCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    backgroundColor: '#fff',
    padding: 20,
  },
  riskHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  riskLevelIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  riskMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  countdownSection: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 5,
  },
  countdownValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
  },
  riskImage: {
    width: '100%',
    height: 200,
  },
  riskInfoBelow: {
    padding: 20,
    backgroundColor: '#fff',
    minHeight: 120, // Ensure enough space for text
    flexShrink: 1, // Allow shrinking if needed
  },
  mapLoadingContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    zIndex: 1,
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  mapRetryButton: {
    marginTop: 12,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapRetryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Fallback styles for when maps don't work
  mapFallbackContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  mapFallbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 12,
    textAlign: 'center',
  },
  mapFallbackText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
  mapFallbackCoords: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // DEBUG Styles
  debugSection: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginTop: 8,
    marginBottom: 5,
  },
  debugMap: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: '#ff0000', // Red border to see container
    overflow: 'visible', // Ensure map isn't clipped
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 16,
  },
  debugTestMap: {
    margin: 10,
    padding: 10,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    overflow: 'visible',
    position: 'relative',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    marginRight: 15,
  },
  riskOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  riskInfo: {
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  riskBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  riskTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  riskDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  
  // Partial data warning styles
  partialDataWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  partialDataText: {
    fontSize: 13,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },

  // Info card styles for N/A data status
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 13,
    color: '#757575',
    fontStyle: 'italic',
  },
  
  // Risk Percentage Card
  riskPercentageCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  circularProgress: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  riskPercentage: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  riskLabel: {
    fontSize: 12,
    color: '#666',
  },
  riskDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  confidenceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  timeRemaining: {
    marginTop: 5,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  
  // Factors Card
  factorsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  factorText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  enhancedFactorText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modelBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
    fontWeight: '500',
  },
  factorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  factorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  compactFactorsHeader: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  compactFactorSection: {
    marginBottom: 8,
  },
  compactSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  compactFactorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  
  // Weather Card
  weatherCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dataSourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 5,
  },
  liveText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  weatherGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weatherItem: {
    alignItems: 'center',
    flex: 1,
    maxWidth: '18%',
    paddingHorizontal: 2,
  },
  weatherValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  weatherLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  
  // Rain Forecast Styles
  forecastCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  forecastSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  forecastSummaryText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  rainDaysList: {
    marginBottom: 10,
  },
  rainDayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rainDayName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  rainDayDetails: {
    alignItems: 'center',
    flex: 1,
  },
  rainDayAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  rainDayIntensity: {
    fontSize: 11,
    color: '#666',
    textTransform: 'capitalize',
  },
  rainDayProbability: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    minWidth: 40,
  },
  nextRainInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  nextRainText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  
  // Button Styles
  primaryButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Live Data Styles
  dataCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  dataContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dataLeft: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  dataDescription: {
    fontSize: 14,
    color: '#666',
  },
  dataVisual: {
    justifyContent: 'center',
    paddingLeft: 20,
  },
  riverImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  
  // Map Styles
  mapCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  map: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#f0f0f0', // Fallback background
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  
  // Precipitation Chart
  precipitationChart: {
    marginTop: 10,
  },
  precipitationValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  precipitationChange: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 10,
  },
  chartPlaceholder: {
    height: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
  },
  
  // New components styles
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  locationIcon: {
    marginRight: 15,
  },
  locationDetails: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 14,
    color: '#666',
  },
  
  districtList: {
    marginTop: 10,
  },
  districtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 10,
  },
  districtInfo: {
    flex: 1,
  },
  districtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  districtRisk: {
    fontSize: 14,
    color: '#666',
  },
  districtState: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
  },
  riskIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 50,
    alignItems: 'center',
  },
  riskPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  navigationContent: {
    alignItems: 'center',
    padding: 20,
  },
  navigationIcon: {
    marginBottom: 10,
  },
  navigationDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  
  // Locations Screen
  locationsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 3,
  },
  locationImage: {
    width: '100%',
    height: 120,
  },
  locationInfo: {
    padding: 15,
  },
  locationLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Emergency Screen
  emergencyCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  emergencyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  emergencyDescription: {
    fontSize: 14,
    color: '#666',
  },
  
  // Navigation Card
  navigationCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
  },
  navigationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  navigationButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Contacts Card
  contactsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  
  // Preparedness Screen
  progressCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  
  // Checklist Card
  checklistCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
  },
  checklistImage: {
    width: 100,
    height: '100%',
  },
  checklistContent: {
    flex: 1,
    padding: 15,
  },
  checklistTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  checklistDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  completedText: {
    color: '#4CAF50',
    marginLeft: 5,
    fontWeight: '600',
  },
  
  // Resources Card
  resourcesCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  resourceText: {
    marginLeft: 15,
    fontSize: 14,
    color: '#2196F3',
  },
  
  // Tab Bar (Bottom Navigation)
  tabBar: {
    height: 60,
    paddingBottom: 5,
    paddingTop: 5,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
  },
  modalTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#e3f2fd',
  },
  tabButtonText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#2196F3',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  detailSection: {
    marginVertical: 15,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  riskMeter: {
    height: 30,
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  riskMeterFill: {
    height: '100%',
    borderRadius: 15,
  },
  riskMeterText: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  riskStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  factorDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  factorDetailText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  indicatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingVertical: 10,
  },
  indicatorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  weatherDetailGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weatherDetailItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  weatherDetailLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  weatherDetailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trendLabel: {
    fontSize: 14,
    color: '#333',
  },
  trendValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  locationDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationDetailText: {
    marginLeft: 12,
    flex: 1,
  },
  locationDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  locationDetailValue: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  modelInfoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modelInfoLabel: {
    fontSize: 12,
    color: '#666',
  },
  modelInfoValue: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },

  // Development Modal Styles
  devModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  devModalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '90%',
    maxHeight: '85%',
  },
  devModalBody: {
    maxHeight: 500,
  },
  devModalContent2: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  devModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  devModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  devLocationList: {
    maxHeight: 200,
  },
  devLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  devLocationInfo: {
    flex: 1,
  },
  devLocationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  devLocationCoords: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  devControlSection: {
    marginBottom: 20,
  },
  devControlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  devSubLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  thresholdOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thresholdOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  selectedThresholdOption: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  thresholdOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  selectedThresholdText: {
    color: '#FFF',
  },
  testMLAlertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginVertical: 12,
    elevation: 3,
  },
  testMLAlertButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  disabledButtonText: {
    color: '#999',
  },

  // Development Toggle Styles
  devToggleSection: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  devToggleButton: {
    padding: 10,
  },
  devToggleButtonDisabled: {
    opacity: 0.5,
  },
  devToggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devToggleText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  devToggleSwitch: {
    width: 50,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  devToggleSwitchActive: {
    backgroundColor: '#2196F3',
  },
  devToggleThumb: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  devToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  devSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    padding: 15,
    paddingBottom: 5,
  },
  
  // Error handling styles
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
  },
  retryButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // REMOVED: mockDataToggle and mockDataLabel - moved to developer controls only
  
  // New probability-based testing styles
  devControlSection: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  devControlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  probabilityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  probabilityOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 50,
    alignItems: 'center',
  },
  selectedOption: {
    borderWidth: 3,
    borderColor: '#333',
  },
  probabilityOptionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  timeframeOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  timeframeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedTimeframeOption: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  timeframeOptionText: {
    fontSize: 12,
    color: '#666',
  },
  selectedTimeframeText: {
    color: '#FFF',
    fontWeight: '600',
  },
  locationOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  locationOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedLocationOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  locationOptionText: {
    fontSize: 12,
    color: '#666',
  },
  selectedLocationText: {
    color: '#FFF',
    fontWeight: '600',
  },
  generateAlertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    margin: 15,
    marginTop: 20,
    elevation: 3,
  },
  generateAlertButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
