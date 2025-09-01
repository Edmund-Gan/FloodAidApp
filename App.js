import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  RefreshControl
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

// Import FloodHotspotsScreen for Epic 3 - Using CSV data version
import FloodHotspotsScreen from './screens/FloodHotspotsCSV';

const { width, height } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// Google Maps API Key Configuration
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || 
                            Constants.manifest?.extra?.googleMapsApiKey ||
                            'AIzaSyC-0v96Q4G43rh8tuLfzTaACTfVA-oSwGM';



// Color theme based on risk levels
const RISK_COLORS = {
  Low: '#4CAF50',
  Moderate: '#FFC107',
  High: '#FF9800',
  'Very High': '#F44336'
};

// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://192.168.1.100:8000/api'  // Local development
  : 'https://floodaid-api.malaysia.gov.my/api';  // Production

// Utility functions
const getRiskColor = (probability) => {
  if (probability < 0.3) return RISK_COLORS.Low;
  if (probability < 0.6) return RISK_COLORS.Moderate;
  if (probability < 0.8) return RISK_COLORS.High;
  return RISK_COLORS['Very High'];
};

// Epic 1: Risk Level Classification (High: 80-100%, Medium: 60-79%, Low: <60%)
const getRiskLevel = (probability) => {
  if (probability >= 0.8) return 'High';        // 80-100%
  if (probability >= 0.6) return 'Medium';      // 60-79%
  return 'Low';                                 // <60%
};

// Generate dynamic risk descriptions based on prediction data
const getRiskDescription = (prediction, locationInfo) => {
  
  // Safety check for null prediction
  if (!prediction || prediction.flood_probability === undefined) {
    return 'Prediction data unavailable. Please try again.';
  }
  
  const riskLevel = getRiskLevel(prediction.flood_probability);
  const probability = Math.round(prediction.flood_probability * 100);
  
  // Handle both number (0.756) and string ("76%") confidence formats
  const confidence = prediction.confidence ? 
    (typeof prediction.confidence === 'string' ? 
      Math.round(parseFloat(prediction.confidence.replace('%', '')) || 0) : 
      Math.round(prediction.confidence * 100)) : 0;
      
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
  
  // Add confidence level if available
  const confidenceText = confidence > 0 ? ` (${confidence}% confidence)` : '';
  const finalDescription = randomDescription + confidenceText;
  
  return finalDescription;
};

// API Service
class FloodPredictionService {
  static async getPrediction(lat, lon) {
    
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000); // 5 second timeout

      
      const response = await fetch(`${API_BASE_URL}/predict/${lat}/${lon}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error('❌ Error fetching prediction:', error);
      
      // Return mock data for development
      return {
        risk_level: 'High',
        flood_probability: 0.75,
        confidence: 0.80,
        timeframe_hours: 12.5,
        contributing_factors: ['Heavy rainfall expected', 'River levels rising'],
        weather_summary: {
          current_temp: 28,
          rainfall_24h: 45,
          wind_speed: 15
        }
      };
    }
  }

  static async getMultipleLocationPredictions(locations) {
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/predict/multiple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error('❌ Error fetching multiple predictions:', error);
      
      // Return mock data
      return {
        predictions: locations.map(loc => ({
          label: loc.label,
          risk_level: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
          probability: Math.random() * 0.8 + 0.1
        }))
      };
    }
  }
}

// Detailed Flood Prediction Modal Component
function FloodDetailsModal({ prediction, locationInfo, onClose }) {
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
        <Text style={styles.detailSectionTitle}>Risk Breakdown</Text>
        <View style={styles.riskMeter}>
          <View style={[styles.riskMeterFill, { 
            width: `${prediction.flood_probability * 100}%`,
            backgroundColor: getRiskColor(prediction.flood_probability)
          }]} />
          <Text style={styles.riskMeterText}>
            {Math.round(prediction.flood_probability * 100)}% Flood Probability
          </Text>
        </View>
        
        <View style={styles.riskStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Risk Level</Text>
            <Text style={[styles.statValue, { color: getRiskColor(prediction.flood_probability) }]}>
              {(() => {
                return prediction.risk_level;
              })()}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Confidence</Text>
            <Text style={styles.statValue}>{Math.round(prediction.confidence * 100)}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Peak Risk</Text>
            <Text style={styles.statValue}>{Math.round(prediction.timeframe_hours)}h</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Contributing Factors</Text>
        {prediction.contributing_factors.map((factor, index) => (
          <View key={index} style={styles.factorDetailItem}>
            <Ionicons name="warning-outline" size={20} color="#FF9800" />
            <Text style={styles.factorDetailText}>{factor}</Text>
          </View>
        ))}
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
            <Text style={styles.weatherDetailValue}>{prediction.weather_summary.current_temp}°C</Text>
          </View>
          <View style={styles.weatherDetailItem}>
            <Ionicons name="rainy-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherDetailLabel}>24h Rainfall</Text>
            <Text style={styles.weatherDetailValue}>{prediction.weather_summary.rainfall_24h}mm</Text>
          </View>
          <View style={styles.weatherDetailItem}>
            <Ionicons name="speedometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherDetailLabel}>Wind Speed</Text>
            <Text style={styles.weatherDetailValue}>{prediction.weather_summary.wind_speed}km/h</Text>
          </View>
        </View>
      </View>

      {prediction.risk_indicators && (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Weather Trends</Text>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Consecutive Rain Days</Text>
            <Text style={styles.trendValue}>
              {prediction.risk_indicators.consecutive_rain_days || 0} days
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Total Forecast Rain</Text>
            <Text style={styles.trendValue}>
              {Math.round(prediction.risk_indicators.total_forecast_rain || 0)}mm
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

// Mock data for development bypass
const getMockMLPrediction = () => ({
  flood_probability: 0.35,
  risk_level: 'Low',
  confidence: 0.78,
  timeframe_hours: 0,
  expected_duration_hours: 0,
  peak_probability: 0.40,
  contributing_factors: [
    'Current rainfall levels are normal',
    'No significant weather warnings',
    'River levels within normal range'
  ],
  weather_summary: {
    current_temp: 28,
    rainfall_24h: 2.1,
    wind_speed: 8.5
  },
  risk_indicators: {
    heavy_rain_warning: false,
    extreme_rain_warning: false,
    high_humidity_warning: false,
    consecutive_rain_days: 0,
    total_forecast_rain: 15.2,
    current_risk_score: 0.35
  },
  location: {
    lat: 3.0738,
    lon: 101.5183,
    display_name: 'Puchong, Selangor (Mock Data)',
    state: 'Selangor'
  },
  timestamp: new Date().toISOString(),
  model_version: 'mock-v1.0',
  data_sources: ['Mock GPS', 'Mock Weather API']
});

// Home/Current Risk Screen (Epic 1: AI-Based Prediction)
function HomeScreen() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [locationInfo, setLocationInfo] = useState(null);
  const [error, setError] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devLocation, setDevLocation] = useState(null);
  const [useMockData, setUseMockData] = useState(false);
  const [skipGPS, setSkipGPS] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);


  useEffect(() => {
    loadPrediction();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

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
      
      // Increase timeout based on retry count (30s, 45s, 60s)
      const timeoutDuration = 30000 + (currentRetry * 15000);
      
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
        // Epic 1: Use real GPS location, Google reverse geocoding, Open Meteo weather, and ML model
        mlPrediction = await Promise.race([
          FloodPredictionModel.getPredictionWithML(null, null, skipGPS),
          timeoutPromise
        ]);
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
      
      // After 3 attempts or manual retry fails, fall back to mock data if available
      if (currentRetry >= 2) {
        try {
          const mockPrediction = getMockMLPrediction();
          setPrediction(mockPrediction);
          setLocationInfo({
            lat: 3.0738,
            lon: 101.5183,
            display_name: 'Puchong, Selangor (Mock Data)',
            isDev: true,
            isMock: true
          });
          return;
        } catch (mockError) {
          console.error(`❌ [${debugId}]: Even mock data failed:`, mockError);
        }
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
  const loadPrediction = () => loadPredictionWithRetry(false, 0);

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



  const handleDevLocationSelect = (location) => {
    try {
      // Cancel all active GPS requests to prevent persistent progress messages
      LocationService.cancelAllRequests();
      
      setDevLocation(location);
      setLocationInfo({
        lat: location.lat,
        lon: location.lon,
        display_name: location.name,
        state: location.state,
        isDev: true
      });
      setShowDevModal(false);
      // Reload prediction with new location
      loadPredictionWithLocation(location.lat, location.lon);
    } catch (error) {
      console.error('Error selecting development location:', error);
      setShowDevModal(false);
    }
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
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>FloodAid</Text>
            {locationInfo && (
              <Text style={styles.locationText}>
                📍 {locationInfo.display_name} {locationInfo.isDev && '(Dev)'}
              </Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.devButton} 
              onPress={() => setShowDevModal(true)}
            >
              <Ionicons name="location" size={20} color="#666" />
            </TouchableOpacity>
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
          
          {/* Show development mock data toggle */}
          <View style={styles.devToggleSection}>
            <TouchableOpacity 
              style={styles.mockDataToggle} 
              onPress={() => setUseMockData(!useMockData)}
            >
              <Ionicons 
                name={useMockData ? "toggle" : "toggle-outline"} 
                size={32} 
                color={useMockData ? "#4CAF50" : "#666"} 
              />
              <Text style={styles.mockDataLabel}>Use Mock Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }


  return (
    <ScrollView 
      style={styles.container}
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
        <View style={styles.headerButtons}>
          {/* Development: Manual Location Selection */}
          <TouchableOpacity 
            style={styles.devButton} 
            onPress={() => setShowDevModal(true)}
          >
            <Ionicons name="location-outline" size={20} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>



      {/* Main Risk Card */}
      <View style={styles.riskCard}>
        <View style={styles.riskHeader}>
          <View style={[styles.riskLevelIndicator, { backgroundColor: getRiskColor(prediction.flood_probability) }]}>
            <Text style={styles.riskLevelText}>
              {getRiskLevel(prediction.flood_probability)} Risk
            </Text>
          </View>
        </View>
        
        <View style={styles.riskMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{Math.round(prediction.flood_probability * 100)}%</Text>
            <Text style={styles.metricLabel}>Flood Risk</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{Math.round(prediction.confidence * 100)}%</Text>
            <Text style={styles.metricLabel}>Confidence</Text>
          </View>
        </View>
        
        <Text style={styles.riskDescription}>
          {getRiskDescription(prediction, locationInfo)}
        </Text>
        
        {/* Show countdown timer only for High risk */}
        {getRiskLevel(prediction.flood_probability) === 'High' && (
          <View style={styles.countdownSection}>
            <Text style={styles.countdownLabel}>Time Until Risk Peak:</Text>
            <Text style={styles.countdownValue}>
              {timeRemaining.hours}h {timeRemaining.minutes}m {timeRemaining.seconds}s
            </Text>
          </View>
        )}
      </View>


      {/* Contributing Factors */}
      <View style={styles.factorsCard}>
        <Text style={styles.cardTitle}>Risk Factors</Text>
        {prediction.contributing_factors.map((factor, index) => (
          <View key={index} style={styles.factorItem}>
            <Ionicons name="warning-outline" size={20} color="#FF9800" />
            <Text style={styles.factorText}>{factor}</Text>
          </View>
        ))}
      </View>

      {/* Weather Card */}
      <View style={styles.weatherCard}>
        <Text style={styles.cardTitle}>Current Weather</Text>
        <View style={styles.weatherGrid}>
          <View style={styles.weatherItem}>
            <Ionicons name="thermometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>{prediction.weather_summary.current_temp}°C</Text>
            <Text style={styles.weatherLabel}>Temperature</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="water-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>{prediction.weather_summary.humidity}%</Text>
            <Text style={styles.weatherLabel}>Humidity</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="rainy-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>{prediction.weather_summary.rainfall_24h}mm</Text>
            <Text style={styles.weatherLabel}>24h Rainfall</Text>
          </View>
          <View style={styles.weatherItem}>
            <Ionicons name="speedometer-outline" size={24} color="#2196F3" />
            <Text style={styles.weatherValue}>{prediction.weather_summary.wind_speed}km/h</Text>
            <Text style={styles.weatherLabel}>Wind Speed</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={() => setShowDetailsModal(true)}
      >
        <Text style={styles.primaryButtonText}>View Details</Text>
      </TouchableOpacity>

      {/* Development: Manual Location Selection Modal */}
      <Modal
        visible={showDevModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.devModalOverlay}>
          <View style={styles.devModalContent}>
            <View style={styles.devModalHeader}>
              <Text style={styles.devModalTitle}>Location Selection</Text>
              <TouchableOpacity onPress={() => setShowDevModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Mock Data Toggle */}
            <View style={styles.devToggleSection}>
              <TouchableOpacity 
                style={styles.devToggleButton}
                onPress={() => setUseMockData(!useMockData)}
              >
                <View style={styles.devToggleContent}>
                  <Text style={styles.devToggleText}>Use Mock Data (Bypass API calls)</Text>
                  <View style={[styles.devToggleSwitch, useMockData && styles.devToggleSwitchActive]}>
                    <View style={[styles.devToggleThumb, useMockData && styles.devToggleThumbActive]} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Skip GPS Toggle */}
            <View style={styles.devToggleSection}>
              <TouchableOpacity 
                style={styles.devToggleButton}
                onPress={() => setSkipGPS(!skipGPS)}
              >
                <View style={styles.devToggleContent}>
                  <Text style={styles.devToggleText}>Skip GPS (Use cached/default location)</Text>
                  <View style={[styles.devToggleSwitch, skipGPS && styles.devToggleSwitchActive]}>
                    <View style={[styles.devToggleThumb, skipGPS && styles.devToggleThumbActive]} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.devSectionTitle}>Test Locations</Text>
            <ScrollView style={styles.devLocationList}>
              {malaysianLocations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.devLocationItem}
                  onPress={() => handleDevLocationSelect(location)}
                >
                  <View style={styles.devLocationInfo}>
                    <Text style={styles.devLocationName}>{location.name}</Text>
                    <Text style={styles.devLocationCoords}>
                      {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detailed Flood Prediction Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <FloodDetailsModal 
          prediction={prediction}
          locationInfo={locationInfo}
          onClose={() => setShowDetailsModal(false)}
        />
      </Modal>
    </ScrollView>
  );
}

// Live Data Screen
function LiveDataScreen() {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDistrictData();
  }, []);

  const loadDistrictData = async () => {
    try {
      setLoading(true);
      
      const malaysianDistricts = await GeoJSONService.loadMalaysianDistricts();
      const districtsWithRisk = GeoJSONService.generateDistrictRisks(malaysianDistricts);
      
      setDistricts(districtsWithRisk);
    } catch (error) {
      console.error('❌ Error loading district data:', error);
      setDistricts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Data</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Rainfall Intensity */}
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>Rainfall Intensity</Text>
        <View style={styles.dataContent}>
          <View style={styles.dataLeft}>
            <Text style={styles.dataLabel}>Current</Text>
            <Text style={styles.dataValue}>0.75 in/hr</Text>
            <Text style={styles.dataDescription}>Heavy Rain</Text>
          </View>
          <View style={styles.dataVisual}>
            <Ionicons name="rainy" size={48} color="#2196F3" />
          </View>
        </View>
      </View>

      {/* River Levels */}
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>River Levels</Text>
        <View style={styles.dataContent}>
          <View style={styles.dataLeft}>
            <Text style={styles.dataLabel}>River A</Text>
            <Text style={styles.dataValue}>12.5 ft</Text>
            <Text style={styles.dataDescription}>Normal Range: 10-15 ft</Text>
          </View>
          <View style={styles.dataVisual}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5' }}
              style={styles.riverImage}
            />
          </View>
        </View>
      </View>

      {/* Regional Flood Risk Districts */}
      <View style={styles.mapCard}>
        <Text style={styles.cardTitle}>Regional Flood Risk</Text>
        
        {/* District Risk List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading district data...</Text>
          </View>
        ) : (
          <View style={styles.districtList}>
            {districts.map((district, index) => (
              <TouchableOpacity
                key={district.id || index}
                style={styles.districtItem}
                onPress={() => {
                  Alert.alert(
                    `${district.name} District`,
                    `State: ${district.state}\nRisk Level: ${GeoJSONService.getRiskLevel(district.risk)}\nFlood Probability: ${Math.round(district.risk * 100)}%\nLocation: ${district.center.lat.toFixed(4)}, ${district.center.lon.toFixed(4)}`
                  );
                }}
              >
                <View style={styles.districtInfo}>
                  <Text style={styles.districtName}>{district.name}</Text>
                  <Text style={styles.districtState}>{district.state} State</Text>
                  <Text style={styles.districtRisk}>{GeoJSONService.getRiskLevel(district.risk)} Risk</Text>
                </View>
                <View style={[
                  styles.riskIndicator,
                  { backgroundColor: GeoJSONService.getRiskColor(district.risk) }
                ]}>
                  <Text style={styles.riskPercentage}>{Math.round(district.risk * 100)}%</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {districts.length === 0 && (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No district data available</Text>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: RISK_COLORS.Low }]} />
            <Text style={styles.legendText}>Low</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: RISK_COLORS.Moderate }]} />
            <Text style={styles.legendText}>Moderate</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: RISK_COLORS.High }]} />
            <Text style={styles.legendText}>High</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: RISK_COLORS['Very High'] }]} />
            <Text style={styles.legendText}>Very High</Text>
          </View>
        </View>
      </View>

      {/* 24-Hour Precipitation Timeline */}
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>24-Hour Precipitation Timeline</Text>
        <View style={styles.precipitationChart}>
          <Text style={styles.precipitationValue}>0.75 in/hr</Text>
          <Text style={styles.precipitationChange}>24h +15%</Text>
          {/* Simplified chart representation */}
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>📊 Precipitation chart visualization</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// My Locations Screen
function LocationsScreen() {
  const [locations, setLocations] = useState([
    { id: 1, label: 'Home', address: '123 Elm Street, Puchong', risk: 'Moderate', lat: 3.0738, lon: 101.5183 },
    { id: 2, label: 'Work', address: '456 Oak Avenue, KL', risk: 'Low', lat: 3.1390, lon: 101.6869 },
    { id: 3, label: 'School', address: '789 Pine Road, Subang', risk: 'High', lat: 3.0567, lon: 101.5851 },
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocation, setNewLocation] = useState({ label: '', address: '' });

  const addLocation = async () => {
    if (newLocation.label && newLocation.address) {
      const newLoc = {
        id: Date.now(),
        label: newLocation.label,
        address: newLocation.address,
        risk: 'Calculating...',
        lat: 3.1 + Math.random() * 0.1,
        lon: 101.6 + Math.random() * 0.1
      };
      setLocations([...locations, newLoc]);
      setNewLocation({ label: '', address: '' });
      setShowAddModal(false);
      
      // Get risk assessment for new location
      const prediction = await FloodPredictionService.getPrediction(newLoc.lat, newLoc.lon);
      setLocations(prev => prev.map(loc => 
        loc.id === newLoc.id ? { ...loc, risk: prediction.risk_level } : loc
      ));
    }
  };

  const deleteLocation = (id) => {
    Alert.alert(
      'Remove Location',
      'Are you sure you want to remove this location?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', onPress: () => setLocations(locations.filter(loc => loc.id !== id)) }
      ]
    );
  };

  const LocationCard = ({ location }) => (
    <TouchableOpacity style={styles.locationCard} onLongPress={() => deleteLocation(location.id)}>
      <Image 
        source={{ 
          uri: location.label === 'Home' 
            ? 'https://images.unsplash.com/photo-1568605114967-8130f3a36994'
            : location.label === 'Work'
            ? 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab'
            : 'https://images.unsplash.com/photo-1580582932707-520aed937b7b'
        }}
        style={styles.locationImage}
      />
      <View style={styles.locationInfo}>
        <Text style={styles.locationLabel}>{location.label}</Text>
        <Text style={styles.locationAddress}>{location.address}</Text>
        <View style={[styles.riskBadge, { 
          backgroundColor: location.risk === 'Low' ? RISK_COLORS.Low 
            : location.risk === 'Moderate' ? RISK_COLORS.Moderate 
            : location.risk === 'High' ? RISK_COLORS.High 
            : '#ccc' 
        }]}>
          <Text style={styles.riskBadgeText}>{location.risk} Risk</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Locations</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle-outline" size={28} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={locations}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => <LocationCard location={item} />}
        contentContainerStyle={styles.locationsList}
      />

      {/* Add Location Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Location</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Location Name (e.g., Home, Office)"
              value={newLocation.label}
              onChangeText={(text) => setNewLocation({ ...newLocation, label: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Address"
              value={newLocation.address}
              onChangeText={(text) => setNewLocation({ ...newLocation, address: text })}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={addLocation}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
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
  const [checklistProgress, setChecklistProgress] = useState(6);
  const totalTasks = 10;

  const preparednessItems = [
    {
      title: 'Secure Your Home',
      description: 'Reinforce windows, doors, and seal any potential entry points for water. Move valuables to higher floors.',
      time: '30 mins',
      completed: true
    },
    {
      title: 'Gather Emergency Supplies',
      description: 'Pack a kit with water, non-perishable food, medications, first-aid, and essential documents.',
      time: '15 mins',
      completed: true
    },
    {
      title: 'Plan Your Evacuation',
      description: 'Identify evacuation routes and safe zones. Ensure all family members know the plan.',
      time: '20 mins',
      completed: true
    },
    {
      title: 'Stay Informed',
      description: 'Monitor local news, weather updates, and official alerts for flood warnings and instructions.',
      time: '10 mins',
      completed: false
    },
    {
      title: 'Charge Devices',
      description: 'Ensure all phones, tablets, and power banks are fully charged for emergency communication.',
      time: '5 mins',
      completed: false
    }
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preparedness Guides</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Pre-Flood Checklist</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${(checklistProgress/totalTasks) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{checklistProgress}/{totalTasks} tasks completed</Text>
      </View>

      <Text style={styles.sectionTitle}>Pre-Flood Checklist</Text>

      {preparednessItems.map((item, index) => (
        <TouchableOpacity key={index} style={styles.checklistCard}>
          <Image 
            source={{ 
              uri: index === 0 ? 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
                : index === 1 ? 'https://images.unsplash.com/photo-1601123258130-8581e8d8dbfc'
                : index === 2 ? 'https://images.unsplash.com/photo-1578662996442-48f60103fc27'
                : index === 3 ? 'https://images.unsplash.com/photo-1504711434969-e33886168f5c'
                : 'https://images.unsplash.com/photo-1609096018330-70c3a4ea9fac'
            }}
            style={styles.checklistImage}
          />
          <View style={styles.checklistContent}>
            <Text style={styles.checklistTime}>Estimated Time: {item.time}</Text>
            <Text style={styles.checklistTitle}>{item.title}</Text>
            <Text style={styles.checklistDescription}>{item.description}</Text>
            {item.completed && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.completedText}>Completed</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* Additional Resources */}
      <View style={styles.resourcesCard}>
        <Text style={styles.cardTitle}>Additional Resources</Text>
        <TouchableOpacity style={styles.resourceItem}>
          <Ionicons name="document-text" size={24} color="#2196F3" />
          <Text style={styles.resourceText}>Download Emergency Plan Template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resourceItem}>
          <Ionicons name="people" size={24} color="#2196F3" />
          <Text style={styles.resourceText}>Family Communication Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resourceItem}>
          <Ionicons name="medical" size={24} color="#2196F3" />
          <Text style={styles.resourceText}>First Aid Guidelines</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Main App Component
export default function App() {
  return (
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
  
  // Weather Card
  weatherCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
  },
  weatherGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weatherItem: {
    alignItems: 'center',
  },
  weatherValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  weatherLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    width: '85%',
    maxHeight: '70%',
    overflow: 'hidden',
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
    maxHeight: 300,
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

  // Development Toggle Styles
  devToggleSection: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  devToggleButton: {
    padding: 10,
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
  mockDataToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  mockDataLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
});