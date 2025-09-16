import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Dimensions
} from 'react-native';
import CustomSlider from './CustomSlider';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

const DeveloperModeSliders = ({
  floodRisk,
  onFloodRiskChange,
  rainfallMultiplier,
  onRainfallMultiplierChange,
  stateRiskMultiplier,
  onStateRiskMultiplierChange,
  monsoonIntensityMultiplier,
  onMonsoonIntensityMultiplierChange,
  riverDischargeThreshold,
  onRiverDischargeThresholdChange,
  manualOverrideEnabled,
  onManualOverrideToggle
}) => {

  const getRiskColor = (risk) => {
    if (risk >= 90) return '#F44336';
    if (risk >= 75) return '#FF5722';
    if (risk >= 60) return '#FF9800';
    if (risk >= 40) return '#FFC107';
    if (risk >= 25) return '#8BC34A';
    return '#4CAF50';
  };

  const getMultiplierColor = (multiplier) => {
    if (multiplier > 2.0) return '#F44336';
    if (multiplier > 1.5) return '#FF9800';
    if (multiplier > 1.0) return '#FFC107';
    if (multiplier < 0.5) return '#2196F3';
    return '#4CAF50';
  };

  const formatMultiplier = (value) => {
    return value.toFixed(1) + 'x';
  };

  return (
    <View style={styles.container}>
      {/* Manual Override Toggle */}
      <View style={styles.overrideToggleContainer}>
        <View style={styles.overrideToggleHeader}>
          <Ionicons name="construct" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.overrideToggleTitle}>Manual Override Mode</Text>
        </View>
        <Switch
          value={manualOverrideEnabled}
          onValueChange={onManualOverrideToggle}
          trackColor={{ false: '#767577', true: COLORS.PRIMARY }}
          thumbColor={manualOverrideEnabled ? '#ffffff' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
        />
      </View>

      {/* Manual Flood Risk Slider */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <View style={styles.sliderTitleContainer}>
            <Ionicons name="water" size={18} color={getRiskColor(floodRisk)} />
            <Text style={styles.sliderTitle}>Manual Flood Risk</Text>
          </View>
          <View style={[styles.valueBox, { backgroundColor: getRiskColor(floodRisk) }]}>
            <Text style={styles.valueText}>{floodRisk.toFixed(0)}%</Text>
          </View>
        </View>

        <View style={styles.sliderContainer}>
          <CustomSlider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={floodRisk}
            onValueChange={onFloodRiskChange}
            minimumTrackTintColor={getRiskColor(floodRisk)}
            maximumTrackTintColor="#d3d3d3"
            thumbStyle={{ backgroundColor: getRiskColor(floodRisk) }}
            step={1}
            disabled={!manualOverrideEnabled}
          />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleText}>No Risk</Text>
            <Text style={styles.scaleText}>Moderate</Text>
            <Text style={styles.scaleText}>Extreme</Text>
          </View>
        </View>
      </View>

      {/* Risk Factor Multipliers */}
      <Text style={styles.sectionTitle}>Risk Factor Multipliers</Text>

      {/* Rainfall Multiplier */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <View style={styles.sliderTitleContainer}>
            <Ionicons name="rainy" size={18} color={getMultiplierColor(rainfallMultiplier)} />
            <Text style={styles.sliderTitle}>Rainfall Intensity</Text>
          </View>
          <View style={[styles.valueBox, { backgroundColor: getMultiplierColor(rainfallMultiplier) }]}>
            <Text style={styles.valueText}>{formatMultiplier(rainfallMultiplier)}</Text>
          </View>
        </View>

        <CustomSlider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={5.0}
          value={rainfallMultiplier}
          onValueChange={onRainfallMultiplierChange}
          minimumTrackTintColor={getMultiplierColor(rainfallMultiplier)}
          maximumTrackTintColor="#d3d3d3"
          thumbStyle={{ backgroundColor: getMultiplierColor(rainfallMultiplier) }}
          step={0.1}
          disabled={!manualOverrideEnabled}
        />
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleText}>0.1x</Text>
          <Text style={styles.scaleText}>1.0x</Text>
          <Text style={styles.scaleText}>5.0x</Text>
        </View>
      </View>

      {/* State Risk Multiplier */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <View style={styles.sliderTitleContainer}>
            <Ionicons name="location" size={18} color={getMultiplierColor(stateRiskMultiplier || 1.0)} />
            <Text style={styles.sliderTitle}>State Risk Override</Text>
          </View>
          <View style={[styles.valueBox, { backgroundColor: getMultiplierColor(stateRiskMultiplier || 1.0) }]}>
            <Text style={styles.valueText}>
              {stateRiskMultiplier ? formatMultiplier(stateRiskMultiplier) : 'Default'}
            </Text>
          </View>
        </View>

        <CustomSlider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={3.0}
          value={stateRiskMultiplier || 1.0}
          onValueChange={onStateRiskMultiplierChange}
          minimumTrackTintColor={getMultiplierColor(stateRiskMultiplier || 1.0)}
          maximumTrackTintColor="#d3d3d3"
          thumbStyle={{ backgroundColor: getMultiplierColor(stateRiskMultiplier || 1.0) }}
          step={0.1}
          disabled={!manualOverrideEnabled}
        />
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleText}>0.1x</Text>
          <Text style={styles.scaleText}>1.0x</Text>
          <Text style={styles.scaleText}>3.0x</Text>
        </View>
      </View>

      {/* Monsoon Intensity Multiplier */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <View style={styles.sliderTitleContainer}>
            <Ionicons name="thunderstorm" size={18} color={getMultiplierColor(monsoonIntensityMultiplier)} />
            <Text style={styles.sliderTitle}>Monsoon Intensity</Text>
          </View>
          <View style={[styles.valueBox, { backgroundColor: getMultiplierColor(monsoonIntensityMultiplier) }]}>
            <Text style={styles.valueText}>{formatMultiplier(monsoonIntensityMultiplier)}</Text>
          </View>
        </View>

        <CustomSlider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={3.0}
          value={monsoonIntensityMultiplier}
          onValueChange={onMonsoonIntensityMultiplierChange}
          minimumTrackTintColor={getMultiplierColor(monsoonIntensityMultiplier)}
          maximumTrackTintColor="#d3d3d3"
          thumbStyle={{ backgroundColor: getMultiplierColor(monsoonIntensityMultiplier) }}
          step={0.1}
          disabled={!manualOverrideEnabled}
        />
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleText}>0.1x</Text>
          <Text style={styles.scaleText}>1.0x</Text>
          <Text style={styles.scaleText}>3.0x</Text>
        </View>
      </View>

      {/* River Discharge Threshold */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <View style={styles.sliderTitleContainer}>
            <Ionicons name="boat" size={18} color={getMultiplierColor(riverDischargeThreshold)} />
            <Text style={styles.sliderTitle}>River Discharge Threshold</Text>
          </View>
          <View style={[styles.valueBox, { backgroundColor: getMultiplierColor(riverDischargeThreshold) }]}>
            <Text style={styles.valueText}>{formatMultiplier(riverDischargeThreshold)}</Text>
          </View>
        </View>

        <CustomSlider
          style={styles.slider}
          minimumValue={0.1}
          maximumValue={3.0}
          value={riverDischargeThreshold}
          onValueChange={onRiverDischargeThresholdChange}
          minimumTrackTintColor={getMultiplierColor(riverDischargeThreshold)}
          maximumTrackTintColor="#d3d3d3"
          thumbStyle={{ backgroundColor: getMultiplierColor(riverDischargeThreshold) }}
          step={0.1}
          disabled={!manualOverrideEnabled}
        />
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleText}>0.1x</Text>
          <Text style={styles.scaleText}>1.0x</Text>
          <Text style={styles.scaleText}>3.0x</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },

  overrideToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  overrideToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  overrideToggleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginLeft: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginVertical: 16,
    textAlign: 'center',
  },

  sliderSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sliderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  sliderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginLeft: 8,
  },

  valueBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },

  valueText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  sliderContainer: {
    marginVertical: 8,
  },

  slider: {
    width: '100%',
    height: 40,
  },

  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 4,
  },

  scaleText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
});

export default DeveloperModeSliders;