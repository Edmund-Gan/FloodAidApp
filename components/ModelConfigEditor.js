import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import { COLORS } from '../utils/constants';
import modelOverrideService from '../utils/ModelOverrideService';

const ModelConfigEditor = ({
  currentModelType,
  onModelTypeChange,
  onConfigLoad,
  overrideStatus
}) => {
  const [selectedModelType, setSelectedModelType] = useState(currentModelType || 'embedded');
  const [customConfigText, setCustomConfigText] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [configPreview, setConfigPreview] = useState(null);

  const modelTypes = [
    { value: 'embedded', label: 'Embedded ML Model', icon: 'hardware-chip' },
    { value: 'statistical', label: 'Statistical Model', icon: 'calculator' },
    { value: 'custom', label: 'Custom Model Config', icon: 'construct' }
  ];

  const handleModelTypeChange = (modelType) => {
    setSelectedModelType(modelType);
    onModelTypeChange(modelType);
  };

  const handleLoadCustomConfig = async () => {
    if (!customConfigText.trim()) {
      Alert.alert('Error', 'Please enter a valid JSON configuration');
      return;
    }

    setIsLoadingConfig(true);
    try {
      const config = JSON.parse(customConfigText);

      // Validate basic structure
      if (!config.model_version || !config.features_count) {
        throw new Error('Invalid config: missing model_version or features_count');
      }

      const success = modelOverrideService.setCustomModelConfig(config);
      if (success) {
        setConfigPreview(config);
        onConfigLoad(config);
        Alert.alert(
          'Success',
          `Custom model config loaded successfully!\nVersion: ${config.model_version}\nFeatures: ${config.features_count}`
        );
      } else {
        throw new Error('Failed to load custom config');
      }

    } catch (error) {
      Alert.alert('Invalid JSON', `Failed to parse configuration: ${error.message}`);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const loadSampleConfig = () => {
    const sampleConfig = {
      "model_version": "3.1-custom",
      "features_count": 31,
      "f1_score": 0.85,
      "performance_improvement": "42.0%",
      "feature_order": [
        "latitude", "longitude", "temp_max", "temp_min", "temp_mean",
        "precipitation_sum", "rain_sum", "precipitation_hours",
        "wind_speed_max", "wind_gusts_max", "wind_direction",
        "river_discharge", "river_discharge_mean", "river_discharge_median",
        "elevation",
        "monsoon_season_encoded", "monsoon_phase_encoded",
        "days_since_monsoon_start", "monsoon_intensity",
        "is_january", "is_february", "is_march", "is_april", "is_may", "is_june",
        "is_july", "is_august", "is_september", "is_october", "is_november", "is_december"
      ],
      "state_risk_multipliers": {
        "SELANGOR": 1.4,
        "WILAYAH PERSEKUTUAN": 1.5,
        "JOHOR": 1.2,
        "KEDAH": 1.3,
        "KELANTAN": 1.4,
        "TERENGGANU": 1.4,
        "PAHANG": 1.2,
        "PERAK": 1.1,
        "PULAU PINANG": 1.1,
        "MELAKA": 1.1,
        "NEGERI SEMBILAN": 1.1,
        "PERLIS": 1.0,
        "SABAH": 1.0,
        "SARAWAK": 0.95
      }
    };

    setCustomConfigText(JSON.stringify(sampleConfig, null, 2));
  };

  const clearConfig = () => {
    setCustomConfigText('');
    setConfigPreview(null);
  };

  const resetToDefault = () => {
    Alert.alert(
      'Reset Configuration',
      'This will reset to the default embedded model. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            setSelectedModelType('embedded');
            onModelTypeChange('embedded');
            setCustomConfigText('');
            setConfigPreview(null);
            Alert.alert('Success', 'Configuration reset to default');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Override Status Banner */}
      {overrideStatus.active && (
        <View style={styles.statusBanner}>
          <Ionicons name="warning" size={20} color="#FF9800" />
          <Text style={styles.statusText}>
            Model Override Active ({overrideStatus.totalCount} overrides)
          </Text>
        </View>
      )}

      {/* Model Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Model Type Selection</Text>

        <View style={styles.modelTypeContainer}>
          {modelTypes.map((model) => (
            <TouchableOpacity
              key={model.value}
              style={[
                styles.modelTypeCard,
                selectedModelType === model.value && styles.selectedModelType
              ]}
              onPress={() => handleModelTypeChange(model.value)}
            >
              <Ionicons
                name={model.icon}
                size={24}
                color={selectedModelType === model.value ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
              />
              <Text style={[
                styles.modelTypeLabel,
                selectedModelType === model.value && styles.selectedModelTypeLabel
              ]}>
                {model.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom Config Section */}
      {selectedModelType === 'custom' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Model Configuration</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={loadSampleConfig}>
              <Ionicons name="document-text" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.secondaryButtonText}>Load Sample</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={clearConfig}>
              <Ionicons name="trash" size={16} color="#F44336" />
              <Text style={[styles.secondaryButtonText, { color: '#F44336' }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* JSON Input */}
          <View style={styles.configInputContainer}>
            <Text style={styles.inputLabel}>Model Configuration (JSON)</Text>
            <TextInput
              style={styles.configInput}
              value={customConfigText}
              onChangeText={setCustomConfigText}
              placeholder="Enter custom model configuration as JSON..."
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              multiline={true}
              numberOfLines={10}
              textAlignVertical="top"
            />
          </View>

          {/* Load Config Button */}
          <TouchableOpacity
            style={[styles.primaryButton, isLoadingConfig && styles.disabledButton]}
            onPress={handleLoadCustomConfig}
            disabled={isLoadingConfig}
          >
            {isLoadingConfig ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="cloud-upload" size={20} color="#ffffff" />
            )}
            <Text style={styles.primaryButtonText}>
              {isLoadingConfig ? 'Loading...' : 'Load Configuration'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Config Preview */}
      {configPreview && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Preview</Text>

          <View style={styles.previewContainer}>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Model Version:</Text>
              <Text style={styles.previewValue}>{configPreview.model_version}</Text>
            </View>

            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Features Count:</Text>
              <Text style={styles.previewValue}>{configPreview.features_count}</Text>
            </View>

            {configPreview.f1_score && (
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>F1 Score:</Text>
                <Text style={styles.previewValue}>{(configPreview.f1_score * 100).toFixed(1)}%</Text>
              </View>
            )}

            {configPreview.performance_improvement && (
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>Improvement:</Text>
                <Text style={styles.previewValue}>{configPreview.performance_improvement}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Model Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Model Information</Text>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={18} color={COLORS.PRIMARY} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Active Model:</Text>
              <Text style={styles.infoValue}>
                {modelTypes.find(m => m.value === selectedModelType)?.label || 'Unknown'}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="stats-chart" size={18} color={COLORS.PRIMARY} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Override Status:</Text>
              <Text style={styles.infoValue}>
                {overrideStatus.active ? 'Active' : 'Disabled'}
              </Text>
            </View>
          </View>

          {overrideStatus.active && overrideStatus.overrides.length > 0 && (
            <View style={styles.infoItem}>
              <Ionicons name="list" size={18} color="#FF9800" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Active Overrides:</Text>
                {overrideStatus.overrides.map((override, index) => (
                  <Text key={index} style={styles.overrideItem}>
                    • {override.type}: {override.value}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Reset Section */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.resetButton} onPress={resetToDefault}>
          <Ionicons name="refresh" size={20} color="#F44336" />
          <Text style={styles.resetButtonText}>Reset to Default</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },

  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '600',
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 12,
  },

  modelTypeContainer: {
    gap: 12,
  },

  modelTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#ffffff',
  },

  selectedModelType: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: '#F3E5F5',
  },

  modelTypeLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },

  selectedModelTypeLabel: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    backgroundColor: '#ffffff',
    flex: 1,
  },

  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },

  configInputContainer: {
    marginBottom: 16,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },

  configInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    fontFamily: 'monospace',
    minHeight: 200,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },

  disabledButton: {
    backgroundColor: '#BDBDBD',
  },

  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  previewContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  previewLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },

  previewValue: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '600',
  },

  infoContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  infoText: {
    marginLeft: 12,
    flex: 1,
  },

  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 2,
  },

  infoValue: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },

  overrideItem: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },

  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F44336',
    gap: 8,
  },

  resetButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ModelConfigEditor;