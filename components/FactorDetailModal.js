import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RiskFactorIcon from './RiskFactorIcon';

const { width } = Dimensions.get('window');

const FactorDetailModal = ({ visible, factor, onClose }) => {
  if (!factor) return null;

  const getThresholdInfo = (factor) => {
    const featureName = factor.raw_feature;
    const value = factor.feature_value;
    
    // Define thresholds for different factors
    const thresholds = {
      rain_sum: { low: 10, high: 30, unit: 'mm' },
      precipitation_sum: { low: 15, high: 50, unit: 'mm' },
      wind_speed_max: { low: 20, high: 40, unit: 'km/h' },
      wind_gusts_max: { low: 30, high: 60, unit: 'km/h' },
      river_discharge: { low: 2, high: 5, unit: 'm³/s' },
      temp_max: { low: 30, high: 35, unit: '°C' },
      elevation: { low: 10, high: 100, unit: 'm' },
      monsoon_intensity: { low: 0.2, high: 0.4, unit: '' },
      precipitation_hours: { low: 4, high: 12, unit: 'hours' }
    };

    const threshold = thresholds[featureName];
    if (!threshold) return null;

    const absValue = Math.abs(value);
    let status = 'Normal';
    let color = '#4caf50';
    
    if (absValue > threshold.high) {
      status = 'High';
      color = '#f44336';
    } else if (absValue > threshold.low) {
      status = 'Moderate';
      color = '#ff9800';
    }

    return {
      value: absValue,
      unit: threshold.unit,
      status,
      color,
      low: threshold.low,
      high: threshold.high
    };
  };

  const getActionableAdvice = (factor) => {
    const featureName = factor.raw_feature;
    const impactLevel = factor.impact_level;

    const advice = {
      rain_sum: {
        High: [
          { text: 'Monitor local weather alerts closely', icon: 'search' },
          { text: 'Review emergency preparation guidelines', icon: 'document-text' },
          { text: 'Check your emergency kit is ready', icon: 'checkbox' }
        ],
        Medium: [
          { text: 'Stay updated on weather conditions', icon: 'search' },
          { text: 'Review preparation guidelines', icon: 'document-text' },
          { text: 'Check drainage around property', icon: 'checkbox' }
        ],
        Low: [
          { text: 'Monitor conditions if forecast changes', icon: 'search' },
          { text: 'Review emergency contacts', icon: 'document-text' },
          { text: 'Stay weather-aware', icon: 'checkbox' }
        ]
      },
      precipitation_sum: {
        High: [
          { text: 'Check rainfall alerts in your area', icon: 'search' },
          { text: 'Review flood preparation guide', icon: 'document-text' },
          { text: 'Prepare evacuation plan', icon: 'checkbox' }
        ],
        Medium: [
          { text: 'Monitor precipitation forecasts', icon: 'search' },
          { text: 'Review safety guidelines', icon: 'document-text' },
          { text: 'Check property drainage', icon: 'checkbox' }
        ],
        Low: [
          { text: 'Stay informed on weather updates', icon: 'search' },
          { text: 'Review emergency procedures', icon: 'document-text' },
          { text: 'Maintain awareness', icon: 'checkbox' }
        ]
      },
      wind_speed_max: {
        High: [
          { text: 'Monitor wind speed warnings', icon: 'search' },
          { text: 'Review storm safety procedures', icon: 'document-text' },
          { text: 'Secure outdoor objects', icon: 'checkbox' }
        ],
        Medium: [
          { text: 'Check wind forecasts', icon: 'search' },
          { text: 'Review safety guidelines', icon: 'document-text' },
          { text: 'Be cautious of debris', icon: 'checkbox' }
        ],
        Low: [
          { text: 'Monitor wind conditions', icon: 'search' },
          { text: 'Review basic precautions', icon: 'document-text' },
          { text: 'Stay alert', icon: 'checkbox' }
        ]
      },
      river_discharge: {
        High: [
          { text: 'Check river level alerts', icon: 'search' },
          { text: 'Review evacuation procedures', icon: 'document-text' },
          { text: 'Avoid flood-prone areas', icon: 'checkbox' }
        ],
        Medium: [
          { text: 'Monitor water levels', icon: 'search' },
          { text: 'Review safety guidelines', icon: 'document-text' },
          { text: 'Stay away from riverbanks', icon: 'checkbox' }
        ],
        Low: [
          { text: 'Check river conditions', icon: 'search' },
          { text: 'Review emergency contacts', icon: 'document-text' },
          { text: 'Maintain awareness', icon: 'checkbox' }
        ]
      },
      monsoon_intensity: {
        High: [
          { text: 'Monitor monsoon weather alerts', icon: 'search' },
          { text: 'Review extended preparation guide', icon: 'document-text' },
          { text: 'Stock 3-7 days of supplies', icon: 'checkbox' }
        ],
        Medium: [
          { text: 'Check daily weather forecasts', icon: 'search' },
          { text: 'Review monsoon safety guide', icon: 'document-text' },
          { text: 'Prepare for heavy rainfall', icon: 'checkbox' }
        ],
        Low: [
          { text: 'Monitor monsoon activity', icon: 'search' },
          { text: 'Review basic guidelines', icon: 'document-text' },
          { text: 'Stay informed', icon: 'checkbox' }
        ]
      },
      elevation: {
        High: [
          { text: 'Monitor flash flood warnings', icon: 'search' },
          { text: 'Review drainage guidelines', icon: 'document-text' },
          { text: 'Check surrounding low areas', icon: 'checkbox' }
        ],
        Medium: [
          { text: 'Check local flood conditions', icon: 'search' },
          { text: 'Review safety procedures', icon: 'document-text' },
          { text: 'Monitor nearby drainage', icon: 'checkbox' }
        ],
        Low: [
          { text: 'Monitor elevation-based risks', icon: 'search' },
          { text: 'Review evacuation plan', icon: 'document-text' },
          { text: 'Prepare flood barriers', icon: 'checkbox' }
        ]
      }
    };

    return advice[featureName]?.[impactLevel] || [
      { text: 'Monitor weather conditions regularly', icon: 'search' },
      { text: 'Review emergency guidelines', icon: 'document-text' },
      { text: 'Prepare basic supplies', icon: 'checkbox' }
    ];
  };

  const getWhyItMatters = (factor) => {
    // Use backend-provided explanation with fallback chain
    // Backend now provides comprehensive, context-aware "Why it Matters" explanations
    // that differentiate between protective and threatening factors
    return factor.why_it_matters ||
           factor.feature?.description ||
           'This factor influences your flood risk by contributing to the overall environmental conditions in your area. Monitor this factor as part of your flood preparedness.';
  };

  const thresholdInfo = getThresholdInfo(factor);
  const advice = getActionableAdvice(factor);
  const whyItMatters = getWhyItMatters(factor);

  const getImpactBadgeColor = (impactLevel) => {
    switch (impactLevel) {
      case 'High':
        return { backgroundColor: '#FFE0B2', color: '#E65100' };
      case 'Medium':
        return { backgroundColor: '#FFF9C4', color: '#F57C00' };
      case 'Low':
        return { backgroundColor: '#C8E6C9', color: '#2E7D32' };
      default:
        return { backgroundColor: '#E0E0E0', color: '#616161' };
    }
  };

  const badgeColors = getImpactBadgeColor(factor.impact_level);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Risk Factor Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Factor Card with Icon and Impact Badge */}
          <View style={styles.factorCard}>
            <RiskFactorIcon factorType={factor.raw_feature} size={80} />
            <View style={styles.factorInfo}>
              <Text style={styles.factorName}>
                {factor.feature?.title || factor.technical_name}
              </Text>
              <View style={[styles.impactBadge, { backgroundColor: badgeColors.backgroundColor }]}>
                <Text style={[styles.impactText, { color: badgeColors.color }]}>
                  {factor.impact_level} Impact
                </Text>
              </View>
            </View>
          </View>

          {/* Why it Matters Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why it Matters</Text>
            <Text style={styles.sectionDescription}>{whyItMatters}</Text>
          </View>

          {/* Risk Contribution Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Risk Contribution</Text>
            <View style={styles.riskContributionBar}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(factor.contribution_score * 100, 100)}%` }
                  ]}
                >
                  <Text style={styles.progressBarText}>
                    {Math.min(factor.contribution_score * 100, 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>
            {thresholdInfo && (
              <Text style={styles.currentValueText}>
                Current Value: {thresholdInfo.value.toFixed(1)}{thresholdInfo.unit}
              </Text>
            )}
          </View>

          {/* How to Prepare Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Prepare</Text>
            {advice.map((item, index) => (
              <View key={index} style={styles.prepareItem}>
                <Text style={styles.prepareItemText}>{item.text}</Text>
                <Ionicons name={item.icon} size={24} color="#666" />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  factorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  factorInfo: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  impactBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  impactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  riskContributionBar: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 40,
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFB74D',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  progressBarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentValueText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  prepareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  prepareItemText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    marginRight: 12,
    lineHeight: 20,
  },
};

export default FactorDetailModal;