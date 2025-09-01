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
  const { 
    hotspots, 
    weatherSummary, 
    precipitationForecast,
    getRiskColor,
    refreshFloodData 
  } = useContext(FloodContext);
  
  const { logFeatureUsage } = useContext(UserContext);

  const [mapRegion, setMapRegion] = useState({
    latitude: 4.2105, // Center of Malaysia
    longitude: 101.9758,
    latitudeDelta: 6,
    longitudeDelta: 6,
  });

  useEffect(() => {
    logFeatureUsage('live_data');
  }, []);

  const getMaxPrecipitation = () => {
    return Math.max(...precipitationForecast.map(item => item.value));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FloodAid</Text>
        <TouchableOpacity onPress={refreshFloodData}>
          <Ionicons name="settings-outline" size={24} color={COLORS.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Real-Time Rainfall</Text>

      {/* Current Rainfall Card */}
      <View style={styles.dataCard}>
        <View style={styles.rainfallHeader}>
          <Ionicons name="rainy" size={24} color={COLORS.PRIMARY} />
          <View style={styles.rainfallData}>
            <Text style={styles.rainfallValue}>
              {weatherSummary.currentPrecipitation.toFixed(1)} mm/hr
            </Text>
            <Text style={styles.rainfallSubtext}>Normal for this season</Text>
          </View>
        </View>
        <LinearGradient
          colors={[COLORS.PRIMARY, COLORS.PRIMARY_DARK]}
          style={[styles.rainfallBar, { height: 40 }]}
        />
      </View>

      {/* River Level Card */}
      <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>River Level</Text>
        <View style={styles.riverLevelContainer}>
          <Text style={styles.riverLevelValue}>
            {weatherSummary.riverLevel.toFixed(1)} ft
          </Text>
          <Text style={styles.riverLevelSubtext}>
            Normal range: {weatherSummary.normalRiverRange} ft
          </Text>
        </View>
        <LinearGradient
          colors={[COLORS.SUCCESS, '#2E7D32']}
          style={[styles.riverLevelBar, { height: 30 }]}
        />
      </View>

      {/* Regional Flood Risk Map */}
      <View style={styles.mapCard}>
        <Text style={styles.cardTitle}>Regional Flood Risk</Text>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChange={setMapRegion}
          >
            {hotspots.map((hotspot) => (
              <Marker
                key={hotspot.id}
                coordinate={{
                  latitude: hotspot.latitude,
                  longitude: hotspot.longitude,
                }}
              >
                <View style={[
                  styles.markerContainer, 
                  { borderColor: getRiskColor(hotspot.riskLevel) }
                ]}>
                  <View style={[
                    styles.markerDot, 
                    { backgroundColor: getRiskColor(hotspot.riskLevel) }
                  ]} />
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
        
        {/* Map Legend */}
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.RISK_VERY_HIGH }]} />
            <Text style={styles.legendText}>High Risk</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.RISK_MEDIUM }]} />
            <Text style={styles.legendText}>Medium Risk</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: COLORS.RISK_LOW }]} />
            <Text style={styles.legendText}>Low Risk</Text>
          </View>
        </View>
      </View>

      {/* 24-Hour Precipitation Forecast */}
      <View style={styles.forecastCard}>
        <Text style={styles.cardTitle}>24-Hour Precipitation Forecast</Text>
        <View style={styles.precipitationContainer}>
          <Text style={styles.precipitationTitle}>Precipitation</Text>
          <Text style={styles.precipitationValue}>0.5 in</Text>
          <Text style={styles.precipitationChange}>2.4h +10%</Text>
        </View>
        
        {/* Precipitation Chart */}
        <View style={styles.chartContainer}>
          {precipitationForecast.map((item, index) => (
            <View key={index} style={styles.chartItem}>
              <View style={styles.chartBar}>
                <View 
                  style={[
                    styles.chartBarFill,
                    { 
                      height: `${(item.value / getMaxPrecipitation()) * 100}%`,
                      backgroundColor: item.value > 0.5 ? COLORS.WARNING : COLORS.PRIMARY
                    }
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{item.time}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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