import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RISK_COLORS } from '../utils/RiskCalculations';

const MapLegend = ({ lastUpdated, onRefresh, isLoading, stateCount }) => {
  const legendItems = [
    { level: 'Low', color: RISK_COLORS.Low, description: 'Low Risk (<60%)' },
    { level: 'Moderate', color: RISK_COLORS.Moderate, description: 'Moderate Risk (60-79%)' },
    { level: 'High', color: RISK_COLORS.High, description: 'High Risk (≥80%)' },
  ];

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never updated';

    const now = new Date();
    const updated = new Date(timestamp);
    const diffMinutes = Math.floor((now - updated) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Malaysia Flood Risk Map</Text>
        <TouchableOpacity
          style={[styles.refreshButton, isLoading && styles.refreshButtonDisabled]}
          onPress={onRefresh}
          disabled={isLoading}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={isLoading ? '#999' : '#2196F3'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>Risk Levels</Text>
        <View style={styles.legendItems}>
          {legendItems.map((item) => (
            <View key={item.level} style={styles.legendItem}>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.description}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.statusText}>
          {stateCount ? `${stateCount} states loaded` : 'Loading states...'}
        </Text>
        <Text style={styles.updateText}>
          Updated: {formatLastUpdated(lastUpdated)}
        </Text>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingIndicator}>
            <Ionicons name="refresh" size={16} color="#2196F3" />
            <Text style={styles.loadingText}>Updating risks...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  legendContainer: {
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  legendItems: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statusText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  updateText: {
    fontSize: 11,
    color: '#888',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
});

export default MapLegend;