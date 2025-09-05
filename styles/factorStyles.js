import { StyleSheet } from 'react-native';

export const factorStyles = StyleSheet.create({
  // Container styles
  factorsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  factorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  factorsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  viewAllText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Factor display styles
  factorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  factorWrapper: {
    width: '50%',
    paddingHorizontal: 4,
  },
  
  // Impact level colors
  highImpactContainer: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 2,
    shadowColor: '#f44336',
  },
  mediumImpactContainer: {
    backgroundColor: '#fff8e1',
    borderColor: '#ff9800',
    borderWidth: 2,
    shadowColor: '#ff9800',
  },
  lowImpactContainer: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
    borderWidth: 2,
    shadowColor: '#4caf50',
  },
  
  highImpactText: {
    color: '#d32f2f',
  },
  mediumImpactText: {
    color: '#f57c00',
  },
  lowImpactText: {
    color: '#388e3c',
  },

  // Legacy text display (fallback)
  legacyFactorsList: {
    marginTop: 8,
  },
  legacyFactorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  legacyFactorIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  legacyFactorText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },

  // Modal and detail styles
  expandedFactorsList: {
    marginTop: 16,
  },
  expandedFactorItem: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expandedFactorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expandedFactorTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  expandedFactorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expandedFactorDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  expandedFactorStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedFactorStat: {
    fontSize: 12,
    color: '#999',
  },

  // Animation and interaction styles
  factorPressable: {
    transform: [{ scale: 1 }],
  },
  factorPressed: {
    transform: [{ scale: 0.95 }],
  },

  // Loading and error states
  factorsLoading: {
    padding: 32,
    alignItems: 'center',
  },
  factorsLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  factorsError: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginTop: 8,
  },
  factorsErrorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f44336',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Accessibility styles
  factorAccessibilityHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Responsive styles for different screen sizes
  compactFactorItem: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  compactFactorText: {
    fontSize: 12,
  },
  compactFactorTitle: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Special state indicators
  newFactorIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff5722',
  },
  updatedFactorIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196f3',
  },

  // Grouping styles
  factorGroup: {
    marginBottom: 16,
  },
  factorGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  factorGroupContainer: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 8,
  },

  // Progress and threshold styles
  thresholdIndicator: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  thresholdProgress: {
    height: '100%',
    borderRadius: 2,
  },
  thresholdLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  thresholdLabel: {
    fontSize: 10,
    color: '#999',
  },
});

// Color constants for consistent theming
export const FACTOR_COLORS = {
  HIGH_IMPACT: {
    background: '#ffebee',
    border: '#f44336',
    text: '#d32f2f',
    shadow: '#f44336',
  },
  MEDIUM_IMPACT: {
    background: '#fff8e1',
    border: '#ff9800',
    text: '#f57c00',
    shadow: '#ff9800',
  },
  LOW_IMPACT: {
    background: '#e8f5e8',
    border: '#4caf50',
    text: '#388e3c',
    shadow: '#4caf50',
  },
  NEUTRAL: {
    background: '#f5f5f5',
    border: '#ddd',
    text: '#666',
    shadow: '#999',
  },
};

// Helper function to get colors based on impact level
export const getFactorColors = (impactLevel) => {
  switch (impactLevel) {
    case 'High':
      return FACTOR_COLORS.HIGH_IMPACT;
    case 'Medium':
      return FACTOR_COLORS.MEDIUM_IMPACT;
    case 'Low':
      return FACTOR_COLORS.LOW_IMPACT;
    default:
      return FACTOR_COLORS.NEUTRAL;
  }
};

// Helper function to get appropriate icon based on impact and direction
export const getFactorIcon = (impactLevel, riskDirection) => {
  const isIncreasing = riskDirection && riskDirection.toLowerCase().includes('increase');
  
  switch (impactLevel) {
    case 'High':
      return isIncreasing ? 'warning' : 'shield-checkmark';
    case 'Medium':
      return isIncreasing ? 'alert-circle' : 'information-circle';
    case 'Low':
      return isIncreasing ? 'chevron-up' : 'chevron-down';
    default:
      return 'ellipse';
  }
};

export default factorStyles;