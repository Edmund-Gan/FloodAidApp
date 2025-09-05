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
          'Monitor local weather alerts closely',
          'Prepare emergency supplies and evacuation plan',
          'Avoid low-lying areas and flood-prone roads',
          'Keep sandbags or flood barriers ready if available'
        ],
        Medium: [
          'Stay updated on weather conditions',
          'Check drainage around your property',
          'Keep emergency contacts readily available'
        ],
        Low: [
          'Continue normal activities but stay weather-aware',
          'Monitor conditions if forecast changes'
        ]
      },
      wind_speed_max: {
        High: [
          'Secure outdoor furniture and objects',
          'Avoid coastal areas due to storm surge risk',
          'Stay indoors during peak wind periods'
        ],
        Medium: [
          'Be cautious of falling branches or debris',
          'Monitor wind conditions if traveling'
        ],
        Low: [
          'Normal precautions for windy weather'
        ]
      },
      river_discharge: {
        High: [
          'Avoid areas near rivers and streams',
          'Do not attempt to cross flooded roads',
          'Monitor local evacuation notices'
        ],
        Medium: [
          'Stay away from riverbanks and bridges',
          'Monitor water levels in your area'
        ],
        Low: [
          'Normal river conditions - stay alert'
        ]
      },
      monsoon_intensity: {
        High: [
          'This is peak monsoon season - highest flood risk period',
          'Prepare for extended periods of heavy rainfall',
          'Stock up on essential supplies for 3-7 days'
        ],
        Medium: [
          'Monsoon season is active - elevated flood risk',
          'Monitor daily weather forecasts closely'
        ],
        Low: [
          'Lower monsoon activity - maintain awareness'
        ]
      },
      elevation: {
        High: [
          'Your location has natural flood protection',
          'Still monitor conditions for flash flooding'
        ],
        Medium: [
          'Moderate flood protection from elevation',
          'Be aware of drainage and low-lying nearby areas'
        ],
        Low: [
          'Low elevation increases flood vulnerability',
          'Have evacuation plan for higher ground',
          'Prepare flood barriers or sandbags'
        ]
      }
    };

    return advice[featureName]?.[impactLevel] || [
      'Monitor weather conditions regularly',
      'Stay informed through official channels',
      'Prepare basic emergency supplies'
    ];
  };

  const renderProgressBar = (thresholdInfo) => {
    if (!thresholdInfo) return null;

    const { value, low, high, color, unit } = thresholdInfo;
    const maxValue = high * 1.5; // Show scale beyond high threshold
    const percentage = Math.min((value / maxValue) * 100, 100);
    const lowPercentage = (low / maxValue) * 100;
    const highPercentage = (high / maxValue) * 100;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
          <View style={[styles.threshold, { left: `${lowPercentage}%` }]}>
            <Text style={styles.thresholdText}>Low</Text>
          </View>
          <View style={[styles.threshold, { left: `${highPercentage}%` }]}>
            <Text style={styles.thresholdText}>High</Text>
          </View>
        </View>
        <Text style={styles.progressValue}>
          Current: {value.toFixed(1)}{unit}
        </Text>
      </View>
    );
  };

  const thresholdInfo = getThresholdInfo(factor);
  const advice = getActionableAdvice(factor);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Risk Factor Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Factor Title and Impact */}
          <View style={styles.factorHeader}>
            <View style={styles.factorTitleRow}>
              <Text style={styles.factorTitle}>
                {factor.feature?.title || factor.technical_name}
              </Text>
              <View style={[styles.impactBadge, { 
                backgroundColor: factor.impact_level === 'High' ? '#ffebee' : 
                                factor.impact_level === 'Medium' ? '#fff8e1' : '#e8f5e8'
              }]}>
                <Text style={[styles.impactText, {
                  color: factor.impact_level === 'High' ? '#d32f2f' : 
                         factor.impact_level === 'Medium' ? '#f57c00' : '#388e3c'
                }]}>
                  {factor.impact_level} Impact
                </Text>
              </View>
            </View>
            <Text style={styles.factorDescription}>
              {factor.feature?.description || 'Contributing to current flood risk assessment'}
            </Text>
          </View>

          {/* Current Status and Threshold */}
          {thresholdInfo && (
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Current Status</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Level:</Text>
                <Text style={[styles.statusValue, { color: thresholdInfo.color }]}>
                  {thresholdInfo.status}
                </Text>
              </View>
              {renderProgressBar(thresholdInfo)}
            </View>
          )}

          {/* Contribution Details */}
          <View style={styles.contributionSection}>
            <Text style={styles.sectionTitle}>Contribution Analysis</Text>
            <View style={styles.contributionRow}>
              <Text style={styles.contributionLabel}>Risk Direction:</Text>
              <Text style={[styles.contributionValue, {
                color: factor.risk_direction === 'Increases' ? '#f44336' : '#4caf50'
              }]}>
                {factor.risk_direction} Risk
              </Text>
            </View>
            <View style={styles.contributionRow}>
              <Text style={styles.contributionLabel}>Contribution Score:</Text>
              <Text style={styles.contributionValue}>
                {(factor.contribution_score * 100).toFixed(2)}%
              </Text>
            </View>
            <View style={styles.contributionRow}>
              <Text style={styles.contributionLabel}>Model Importance:</Text>
              <Text style={styles.contributionValue}>
                {(factor.importance * 100).toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* Actionable Advice */}
          <View style={styles.adviceSection}>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            {advice.map((item, index) => (
              <View key={index} style={styles.adviceItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                <Text style={styles.adviceText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Technical Details */}
          <View style={styles.technicalSection}>
            <Text style={styles.sectionTitle}>Technical Information</Text>
            <View style={styles.technicalRow}>
              <Text style={styles.technicalLabel}>Feature Name:</Text>
              <Text style={styles.technicalValue}>{factor.raw_feature}</Text>
            </View>
            <View style={styles.technicalRow}>
              <Text style={styles.technicalLabel}>Current Value:</Text>
              <Text style={styles.technicalValue}>{factor.feature_value?.toFixed(3)}</Text>
            </View>
            <View style={styles.technicalRow}>
              <Text style={styles.technicalLabel}>Ranking:</Text>
              <Text style={styles.technicalValue}>#{factor.rank} most important</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  factorHeader: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  factorTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  factorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  factorDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  statusSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    position: 'relative',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  threshold: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
  },
  thresholdText: {
    fontSize: 10,
    color: '#666',
  },
  progressValue: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  contributionSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contributionLabel: {
    fontSize: 14,
    color: '#666',
  },
  contributionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  adviceSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adviceText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  technicalSection: {
    paddingVertical: 16,
    marginBottom: 32,
  },
  technicalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  technicalLabel: {
    fontSize: 14,
    color: '#666',
  },
  technicalValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
};

export default FactorDetailModal;