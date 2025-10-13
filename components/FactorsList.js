import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FactorsList = ({
  title,
  factors,
  type = 'increasing', // 'increasing' or 'reducing'
  onFactorPress
}) => {
  if (!factors || factors.length === 0) return null;

  // Get theme colors based on type
  const getTheme = () => {
    if (type === 'reducing') {
      return {
        backgroundColor: '#E8F5E9',
        borderColor: '#81C784',
        textColor: '#2E7D32',
        iconColor: '#4CAF50',
        iconName: 'checkmark-circle'
      };
    }
    // 'increasing' type
    return {
      backgroundColor: '#FFE8CC',
      borderColor: '#FFB74D',
      textColor: '#E65100',
      iconColor: '#F57C00',
      iconName: 'warning'
    };
  };

  const theme = getTheme();

  // Format factor text to be more readable
  const formatFactorText = (factor) => {
    if (typeof factor === 'string') {
      return factor;
    }

    // For structured factor objects
    const title = factor.feature?.title || factor.technical_name || 'Unknown Factor';
    const value = factor.feature_value;

    // Add contextual information if available
    if (value !== undefined && value !== null) {
      const absValue = Math.abs(value);

      // Format based on factor type
      if (factor.raw_feature?.includes('rain') || factor.raw_feature?.includes('precipitation')) {
        return `${title} (${absValue.toFixed(1)}mm expected)`;
      } else if (factor.raw_feature?.includes('wind')) {
        return `${title} (${absValue.toFixed(1)}km/h)`;
      } else if (factor.raw_feature?.includes('river')) {
        return `${title} (${absValue.toFixed(2)}m³/s flow)`;
      } else if (factor.raw_feature?.includes('elevation')) {
        return `${title} (${absValue.toFixed(0)}m elevation)`;
      } else if (factor.raw_feature?.includes('temp')) {
        return `${title} (${absValue.toFixed(1)}°C)`;
      }
    }

    // Use description if available
    if (factor.feature?.description) {
      return `${title} - ${factor.feature.description}`;
    }

    return title;
  };

  return (
    <View style={[styles.container, {
      backgroundColor: theme.backgroundColor,
      borderColor: theme.borderColor
    }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name={theme.iconName} size={24} color={theme.iconColor} />
        <Text style={[styles.title, { color: theme.textColor }]}>
          {title}
        </Text>
      </View>

      {/* Factors List */}
      <View style={styles.factorsList}>
        {factors.map((factor, index) => (
          <TouchableOpacity
            key={index}
            style={styles.factorItem}
            onPress={() => onFactorPress && onFactorPress(factor)}
            activeOpacity={0.7}
          >
            <View style={styles.factorContent}>
              <Ionicons
                name={theme.iconName}
                size={20}
                color={theme.iconColor}
                style={styles.factorIcon}
              />
              <Text style={[styles.factorText, { color: theme.textColor }]}>
                {formatFactorText(factor)}
              </Text>
            </View>
            {onFactorPress && (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textColor}
                style={styles.chevronIcon}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 2,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  factorsList: {
    gap: 8,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  factorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  factorIcon: {
    marginRight: 8,
  },
  factorText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  chevronIcon: {
    marginLeft: 8,
    opacity: 0.6,
  },
});

export default FactorsList;
