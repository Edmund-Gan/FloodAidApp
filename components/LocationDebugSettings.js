import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationService from '../services/LocationService';
import { Ionicons } from '@expo/vector-icons';

export default function LocationDebugSettings({ onClose }) {
  const [settings, setSettings] = useState({
    skipGPS: false,
    forceEmulatorMode: null,
    customTimeout: '',
    enableRetry: true,
    maxRetries: '3',
    backgroundWatcher: false
  });
  
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('locationDebugSettings');
      if (saved) {
        setSettings({ ...settings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Failed to load debug settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('locationDebugSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save debug settings:', error);
    }
  };

  const loadStats = () => {
    const performanceStats = LocationService.getPerformanceStats();
    setStats(performanceStats);
  };

  const testLocationServices = async () => {
    setIsLoading(true);
    try {
      console.log('Testing location services...');
      
      const result = settings.enableRetry ? 
        await LocationService.getCurrentLocationWithRetry(
          settings.skipGPS, 
          parseInt(settings.maxRetries) || 3
        ) :
        await LocationService.getCurrentLocation(settings.skipGPS);
      
      Alert.alert(
        'Location Test Result',
        `SUCCESS\nLatitude: ${result.lat}\nLongitude: ${result.lon}\nAccuracy: ${result.accuracy}m\nSource: ${result.isCached ? 'Cached' : result.isDefault ? 'Default' : 'GPS'}\nDebug ID: ${result.debugId}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      const errorInfo = LocationService.getLocationErrorMessage(error);
      Alert.alert(
        'Location Test Failed',
        `ERROR: ${errorInfo.title}\n\n${errorInfo.message}\n\nSuggestion: ${errorInfo.suggestion}`,
        [{ text: 'OK' }]
      );
    }
    setIsLoading(false);
    loadStats();
  };

  const clearCache = async () => {
    try {
      await LocationService.getCachedLocation();
      LocationService.optimizePerformance();
      Alert.alert('Cache Cleared', 'Location cache has been cleared successfully.');
      loadStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear cache: ' + error.message);
    }
  };

  const toggleBackgroundWatcher = async () => {
    try {
      if (settings.backgroundWatcher) {
        await LocationService.stopBackgroundLocationWatcher();
        Alert.alert('Background Watcher', 'Background location watcher stopped.');
      } else {
        await LocationService.startBackgroundLocationWatcher({ interval: 60000 });
        Alert.alert('Background Watcher', 'Background location watcher started.');
      }
      
      const newSettings = { ...settings, backgroundWatcher: !settings.backgroundWatcher };
      saveSettings(newSettings);
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle background watcher: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Location Debug Settings</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GPS Settings</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Skip GPS (use cached/default)</Text>
            <Switch
              value={settings.skipGPS}
              onValueChange={(value) => saveSettings({ ...settings, skipGPS: value })}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={settings.skipGPS ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Enable Progressive Retry</Text>
            <Switch
              value={settings.enableRetry}
              onValueChange={(value) => saveSettings({ ...settings, enableRetry: value })}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={settings.enableRetry ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Max Retries</Text>
            <TextInput
              style={styles.textInput}
              value={settings.maxRetries}
              onChangeText={(value) => saveSettings({ ...settings, maxRetries: value })}
              placeholder="3"
              keyboardType="numeric"
              maxLength={1}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background Monitoring</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Background Location Watcher</Text>
            <Switch
              value={settings.backgroundWatcher}
              onValueChange={toggleBackgroundWatcher}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={settings.backgroundWatcher ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Statistics</Text>
          {stats && (
            <View style={styles.stats}>
              <Text style={styles.statText}>Total Requests: {stats.totalRequests}</Text>
              <Text style={styles.statText}>Cache Hits: {stats.cacheHits}</Text>
              <Text style={styles.statText}>GPS Acquisitions: {stats.gpsAcquisitions}</Text>
              <Text style={styles.statText}>Cache Hit Rate: {(stats.cacheHitRate * 100).toFixed(1)}%</Text>
              <Text style={styles.statText}>Failure Rate: {(stats.failureRate * 100).toFixed(1)}%</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing & Maintenance</Text>
          
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={testLocationServices}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Testing Location...' : 'Test Location Services'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={clearCache}>
            <Text style={styles.buttonText}>Clear Location Cache</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={loadStats}>
            <Text style={styles.buttonText}>Refresh Statistics</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 14,
  },
  stats: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  statText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});