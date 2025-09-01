/**
 * Ultra-Simple FloodHotspotsScreen for Testing Google Maps
 * Stripped down to absolute basics to identify map rendering issues
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';

export default function FloodHotspotsScreenSimple() {
  
  const handleMapError = (error) => {
    console.error('❌ Map error:', error);
    Alert.alert(
      'Map Error', 
      'Google Maps failed to load. Check:\n• Internet connection\n• Google Cloud Console\n• Billing enabled',
      [{ text: 'OK' }]
    );
  };

  const handleMapReady = () => {
    console.log('✅ Google Maps loaded successfully!');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Simple Map Test - Selangor</Text>
      </View>
      
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: 3.1073,     // Petaling Jaya, Selangor
            longitude: 101.5951,
            latitudeDelta: 0.8,    // Zoom to show Selangor area
            longitudeDelta: 0.8,
          }}
          onMapReady={handleMapReady}
          onError={handleMapError}
        >
          {/* Single test marker in Puchong (Alice's location) */}
          <Marker
            coordinate={{
              latitude: 3.0738,
              longitude: 101.5183,
            }}
            title="Puchong, Selangor"
            description="Alice Chen's neighborhood - Test marker"
            pinColor="red"
          />
          
          {/* Additional marker in KL for reference */}
          <Marker
            coordinate={{
              latitude: 3.1390,
              longitude: 101.6869,
            }}
            title="Kuala Lumpur"
            description="Capital city - Reference point"
            pinColor="blue"
          />
        </MapView>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          If you can see this map with 2 markers, Google Maps is working!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ddd',
  },
  map: {
    width: '100%',
    height: '100%',
    minHeight: 300,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});