import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import floodAlertService from '../utils/FloodAlertService';
import devAlertTrigger from '../utils/DevAlertTrigger';
import { COLORS, ML_ALERT_THRESHOLDS } from '../utils/constants';

const { width, height } = Dimensions.get('window');

const DeveloperMode = ({ visible, onClose, onAlertGenerated }) => {
  // Main controls state
  const [selectedProbability, setSelectedProbability] = useState(70);
  const [selectedTimeframe, setSelectedTimeframe] = useState(6);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
  // ML Configuration
  const [mlAlertsEnabled, setMlAlertsEnabled] = useState(true);
  const [mlAlertThreshold, setMlAlertThreshold] = useState(60);
  
  // UI State
  const [activeTab, setActiveTab] = useState('probability'); // 'probability', 'scenarios', 'settings'
  const [isGeneratingAlert, setIsGeneratingAlert] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  
  // Available locations and scenarios
  const [testLocations] = useState(devAlertTrigger.getTestLocations());
  const [testScenarios] = useState(devAlertTrigger.getAvailableScenarios());
  const timeframeOptions = devAlertTrigger.getTimeframeOptions();

  useEffect(() => {
    if (visible) {
      // Set default location
      if (!selectedLocation && testLocations.length > 0) {
        setSelectedLocation(testLocations[0]);
      }
      
      // Load current ML alert settings
      const mlSettings = floodAlertService.getMLAlertSettings();
      setMlAlertsEnabled(mlSettings.enabled);
      setMlAlertThreshold(mlSettings.thresholdPercent);
    }
  }, [visible]);

  const handleGenerateProbabilityAlert = async () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location first');
      return;
    }

    setIsGeneratingAlert(true);
    try {
      const alert = await devAlertTrigger.generateProbabilityBasedAlert(
        selectedProbability,
        selectedTimeframe,
        selectedLocation,
        onAlertGenerated
      );

      if (alert) {
        // Add to alert history
        setAlertHistory(prev => [{
          id: alert.id,
          probability: selectedProbability,
          timeframe: selectedTimeframe,
          location: selectedLocation.name,
          severity: alert.severity,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 9)]); // Keep last 10 alerts

        Alert.alert(
          '✅ Alert Generated',
          `${selectedProbability}% flood probability alert created for ${selectedLocation.name}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating probability alert:', error);
      Alert.alert('Error', `Failed to generate alert: ${error.message}`);
    } finally {
      setIsGeneratingAlert(false);
    }
  };

  const handleGenerateScenarioAlert = async (scenarioKey) => {
    setIsGeneratingAlert(true);
    try {
      const alert = await devAlertTrigger.triggerTestAlert(scenarioKey, onAlertGenerated);
      
      if (alert) {
        const scenario = testScenarios.find(s => s.key === scenarioKey);
        setAlertHistory(prev => [{
          id: alert.id,
          scenario: scenario?.name || scenarioKey,
          location: scenario?.location || 'Unknown',
          severity: alert.severity,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 9)]);

        Alert.alert(
          '✅ Scenario Alert Generated',
          `Scenario "${scenario?.name}" executed successfully`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating scenario alert:', error);
      Alert.alert('Error', `Failed to generate scenario alert: ${error.message}`);
    } finally {
      setIsGeneratingAlert(false);
    }
  };

  const handleMLSettingsChange = (enabled, threshold) => {
    setMlAlertsEnabled(enabled);
    setMlAlertThreshold(threshold);
    
    floodAlertService.setMLAlertsEnabled(enabled);
    floodAlertService.setMLAlertThreshold(threshold / 100);
  };

  const clearAlertHistory = () => {
    setAlertHistory([]);
    devAlertTrigger.clearTestAlerts();
    Alert.alert('✅ Cleared', 'Alert history cleared and all test alerts stopped');
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 90) return '#F44336';
    if (probability >= 75) return '#FF5722';
    if (probability >= 60) return '#FF9800';
    if (probability >= 40) return '#FFC107';
    if (probability >= 25) return '#8BC34A';
    return '#4CAF50';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'immediate': return '#F44336';
      case 'urgent': return '#FF9800';
      case 'warning': return '#FFC107';
      case 'advisory': return '#2196F3';
      default: return '#666666';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={[COLORS.PRIMARY, COLORS.PRIMARY_DARK]} style={styles.header}>
          <Text style={styles.headerTitle}>🛠️ Developer Mode</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {[
            { key: 'probability', title: 'Probability', icon: 'analytics' },
            { key: 'scenarios', title: 'Scenarios', icon: 'list' },
            { key: 'settings', title: 'Settings', icon: 'settings' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons 
                name={tab.icon} 
                size={20} 
                color={activeTab === tab.key ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content}>
          {/* Probability Testing Tab */}
          {activeTab === 'probability' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>🎯 Probability-Based Alert Testing</Text>
              
              {/* Location Selector */}
              <View style={styles.section}>
                <Text style={styles.label}>📍 Test Location</Text>
                <TouchableOpacity 
                  style={styles.locationSelector}
                  onPress={() => setShowLocationPicker(true)}
                >
                  <Text style={styles.locationSelectorText}>
                    {selectedLocation?.name || 'Select a location'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Probability Selector */}
              <View style={styles.section}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.label}>🌊 Flood Probability</Text>
                  <View style={[styles.probabilityBadge, { backgroundColor: getProbabilityColor(selectedProbability) }]}>
                    <Text style={styles.probabilityText}>{selectedProbability}%</Text>
                  </View>
                </View>
                
                <View style={styles.probabilityGrid}>
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 95].map((prob) => (
                    <TouchableOpacity
                      key={prob}
                      style={[
                        styles.probabilityButton,
                        selectedProbability === prob && styles.selectedProbabilityButton,
                        { borderColor: getProbabilityColor(prob) }
                      ]}
                      onPress={() => setSelectedProbability(prob)}
                    >
                      <Text style={[
                        styles.probabilityButtonText,
                        selectedProbability === prob && { color: 'white' }
                      ]}>
                        {prob}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={styles.probabilityScale}>
                  <Text style={styles.scaleText}>Low Risk</Text>
                  <Text style={styles.scaleText}>Moderate</Text>
                  <Text style={styles.scaleText}>Extreme</Text>
                </View>
              </View>

              {/* Timeframe Selector */}
              <View style={styles.section}>
                <Text style={styles.label}>⏰ Timeframe Until Flooding</Text>
                <View style={styles.timeframeContainer}>
                  {timeframeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.timeframeButton,
                        selectedTimeframe === option.value && styles.selectedTimeframe
                      ]}
                      onPress={() => setSelectedTimeframe(option.value)}
                    >
                      <Text style={[
                        styles.timeframeButtonText,
                        selectedTimeframe === option.value && styles.selectedTimeframeText
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                style={[styles.generateButton, isGeneratingAlert && styles.buttonDisabled]}
                onPress={handleGenerateProbabilityAlert}
                disabled={isGeneratingAlert}
              >
                <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.generateButtonGradient}>
                  <Ionicons name="flash" size={20} color="white" />
                  <Text style={styles.generateButtonText}>
                    {isGeneratingAlert ? 'Generating...' : 'Generate Flood Alert'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Scenario Testing Tab */}
          {activeTab === 'scenarios' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>📋 Predefined Test Scenarios</Text>
              
              {testScenarios.map((scenario) => (
                <TouchableOpacity
                  key={scenario.key}
                  style={styles.scenarioCard}
                  onPress={() => handleGenerateScenarioAlert(scenario.key)}
                  disabled={isGeneratingAlert}
                >
                  <View style={styles.scenarioHeader}>
                    <Text style={styles.scenarioName}>{scenario.name}</Text>
                    <Text style={styles.scenarioLocation}>📍 {scenario.location}</Text>
                  </View>
                  <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>⚙️ Alert System Configuration</Text>

              {/* ML Alerts Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>🤖 ML-Based Alerts</Text>
                  <Text style={styles.settingDescription}>
                    Enable machine learning flood probability alerts
                  </Text>
                </View>
                <Switch
                  value={mlAlertsEnabled}
                  onValueChange={(enabled) => handleMLSettingsChange(enabled, mlAlertThreshold)}
                  trackColor={{ false: '#E0E0E0', true: COLORS.PRIMARY }}
                />
              </View>

              {/* ML Threshold Selector */}
              <View style={[styles.section, !mlAlertsEnabled && styles.disabledSection]}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.label}>🎯 ML Alert Threshold</Text>
                  <View style={styles.thresholdBadge}>
                    <Text style={styles.thresholdText}>{mlAlertThreshold}%</Text>
                  </View>
                </View>
                
                <View style={styles.thresholdOptions}>
                  {[50, 60, 70, 80, 90, 95].map((threshold) => (
                    <TouchableOpacity
                      key={threshold}
                      style={[
                        styles.thresholdOption,
                        mlAlertThreshold === threshold && styles.selectedThresholdOption,
                        !mlAlertsEnabled && styles.disabledButton
                      ]}
                      onPress={() => handleMLSettingsChange(mlAlertsEnabled, threshold)}
                      disabled={!mlAlertsEnabled}
                    >
                      <Text style={[
                        styles.thresholdOptionText,
                        mlAlertThreshold === threshold && styles.selectedThresholdText
                      ]}>
                        {threshold}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={styles.thresholdDescription}>
                  Alerts will trigger when ML model predicts {mlAlertThreshold}% or higher flood probability
                </Text>
              </View>

              {/* Alert History */}
              <View style={styles.section}>
                <View style={styles.historyHeader}>
                  <Text style={styles.label}>📊 Recent Test Alerts ({alertHistory.length})</Text>
                  <TouchableOpacity onPress={clearAlertHistory} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                
                {alertHistory.length === 0 ? (
                  <Text style={styles.noHistoryText}>No test alerts generated yet</Text>
                ) : (
                  alertHistory.map((alert, index) => (
                    <View key={index} style={styles.historyItem}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTitle}>
                          {alert.probability ? `${alert.probability}% Alert` : alert.scenario}
                        </Text>
                        <Text style={styles.historyLocation}>📍 {alert.location}</Text>
                        <Text style={styles.historyTime}>{alert.timestamp}</Text>
                      </View>
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                        <Text style={styles.severityText}>{alert.severity}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Location Picker Modal */}
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLocationPicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Location</Text>
                <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerContent}>
                {testLocations.map((location) => (
                  <TouchableOpacity
                    key={location.name}
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedLocation(location);
                      setShowLocationPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{location.name}</Text>
                    {selectedLocation?.name === location.name && (
                      <Ionicons name="checkmark" size={20} color={COLORS.PRIMARY} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY,
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  activeTabText: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  locationSelectorText: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  probabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  probabilityText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  probabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  probabilityButton: {
    width: '18%',
    aspectRatio: 1.5,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  selectedProbabilityButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  probabilityButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  probabilityScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  timeframeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  selectedTimeframe: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  timeframeButtonText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  selectedTimeframeText: {
    color: 'white',
    fontWeight: '600',
  },
  generateButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  scenarioCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  scenarioLocation: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  scenarioDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  disabledSection: {
    opacity: 0.5,
  },
  thresholdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  thresholdText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  thresholdOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  thresholdOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  selectedThresholdOption: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  thresholdOptionText: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
  },
  selectedThresholdText: {
    color: 'white',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  thresholdDescription: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.ERROR,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  noHistoryText: {
    textAlign: 'center',
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  historyLocation: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginVertical: 2,
  },
  historyTime: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  
  // Location Picker Modal Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  pickerContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerItemText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
});

export default DeveloperMode;