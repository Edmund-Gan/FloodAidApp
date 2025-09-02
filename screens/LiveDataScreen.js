import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { FloodContext } from '../context/FloodContext';
import { UserContext } from '../context/UserContext';
import { COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

export default function LiveDataScreen({ navigation }) {
  const { logFeatureUsage } = useContext(UserContext);

  useEffect(() => {
    logFeatureUsage('live_data');
  }, []);

  return (
    <View style={styles.centerContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>FloodAid</Text>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={24} color={COLORS.TEXT_SECONDARY} />
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 50,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  upcomingFeaturesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  upcomingFeaturesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 20,
    textAlign: 'center',
  },
  upcomingFeaturesDescription: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 22,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 15,
    color: COLORS.TEXT_PRIMARY,
  },
  dataCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 15,
  },
  rainfallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rainfallData: {
    marginLeft: 15,
    flex: 1,
  },
  rainfallValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  rainfallSubtext: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  rainfallBar: {
    width: 60,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  riverLevelContainer: {
    marginBottom: 10,
  },
  riverLevelValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  riverLevelSubtext: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  riverLevelBar: {
    width: 80,
    borderRadius: 4,
  },
  mapCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 15,
  },
  mapContainer: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  forecastCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 15,
  },
  precipitationContainer: {
    marginBottom: 15,
  },
  precipitationTitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 5,
  },
  precipitationValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  precipitationChange: {
    fontSize: 12,
    color: COLORS.SUCCESS,
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  chartItem: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: 20,
    height: 60,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 2,
  },
  chartLabel: {
    fontSize: 10,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 100,
  },
});