import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const RiskSummaryCard = ({ prediction }) => {
  if (!prediction) return null;

  const probability = prediction.is_na ? 0 : prediction.flood_probability;
  const probabilityPercent = Math.round(probability * 100);
  const riskLevel = prediction.is_na ? 'N/A' : prediction.risk_level;
  const peakRiskHours = prediction.is_na ? 'N/A' : `${Math.round(prediction.timeframe_hours)}h`;

  // Get risk level color
  const getRiskLevelColor = () => {
    if (prediction.is_na) return '#999';
    if (probabilityPercent < 30) return '#4CAF50'; // Low - Green
    if (probabilityPercent < 60) return '#FF9800'; // Medium - Orange
    return '#F44336'; // High - Red
  };

  // Get gradient colors for progress bar
  const getGradientColors = () => {
    if (prediction.is_na) return ['#E0E0E0', '#E0E0E0'];
    return ['#4CAF50', '#FFC107', '#FF9800', '#F44336'];
  };

  const riskColor = getRiskLevelColor();

  return (
    <View style={styles.container}>
      {/* Large Probability Display */}
      <View style={styles.probabilitySection}>
        <Text style={styles.probabilityNumber}>{probabilityPercent}%</Text>
        <Text style={styles.probabilityLabel}>Flood Probability</Text>
        <Text style={[styles.riskLevelBadge, { color: riskColor }]}>
          {riskLevel}
        </Text>
      </View>

      {/* Gradient Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <LinearGradient
            colors={getGradientColors()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${probabilityPercent}%` }]}
          />
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Risk Level</Text>
          <Text style={[styles.metricValue, { color: riskColor }]}>
            {riskLevel}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Peak Risk</Text>
          <Text style={styles.metricValue}>{peakRiskHours}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  probabilitySection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  probabilityNumber: {
    fontSize: 72,
    fontWeight: '700',
    color: '#333',
    lineHeight: 80,
  },
  probabilityLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
    marginBottom: 8,
  },
  riskLevelBadge: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
});

export default RiskSummaryCard;
