import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
  Alert as RNAlert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RISK_LEVELS, ANIMATION_DURATION } from '../utils/constants';

const { width } = Dimensions.get('window');

const FloodAlert = ({ 
  alert, 
  visible, 
  onDismiss, 
  onPreparationGuide,
  onViewDetails, 
  autoHide = false,
  autoHideDelay = 10000 
}) => {
  const [isVisible, setIsVisible] = useState(visible);
  const [countdown, setCountdown] = useState(alert?.countdownTime || 0);
  const [countdownDisplay, setCountdownDisplay] = useState(alert?.countdownDisplay || '');
  
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    setIsVisible(visible);
    if (visible && alert) {
      showAlert();
      startCountdown();
      
      if (autoHide && alert.severity !== 'immediate') {
        setTimeout(() => {
          hideAlert();
        }, autoHideDelay);
      }
    } else {
      hideAlert();
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [visible, alert]);

  const showAlert = () => {
    // Slide in animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: ANIMATION_DURATION.MEDIUM,
      useNativeDriver: true,
    }).start();

    // Pulse animation for urgent alerts
    if (alert?.severity === 'immediate' || alert?.severity === 'urgent') {
      startPulseAnimation();
    }
  };

  const hideAlert = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: ANIMATION_DURATION.MEDIUM,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    });
  };

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (alert?.severity === 'immediate' || alert?.severity === 'urgent') {
          pulse();
        }
      });
    };
    pulse();
  };

  const startCountdown = () => {
    if (!alert?.countdownTime) return;

    let timeRemaining = alert.countdownTime;
    
    countdownIntervalRef.current = setInterval(() => {
      timeRemaining -= 1000;
      
      if (timeRemaining <= 0) {
        setCountdown(0);
        setCountdownDisplay('Flood conditions now');
        clearInterval(countdownIntervalRef.current);
        return;
      }

      setCountdown(timeRemaining);
      setCountdownDisplay(formatCountdown(timeRemaining));
    }, 1000);
  };

  const formatCountdown = (milliseconds) => {
    const totalHours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const remainingHours = totalHours % 24;
      return `${days}d ${remainingHours}h remaining`;
    } else if (totalHours > 0) {
      return `${totalHours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  };

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'immediate':
        return {
          colors: ['#FF4444', '#FF6B6B'],
          icon: 'warning',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          urgencyText: 'IMMEDIATE ACTION REQUIRED'
        };
      case 'urgent':
        return {
          colors: ['#FF8800', '#FFAA44'],
          icon: 'alert-circle',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          urgencyText: 'URGENT - PREPARE NOW'
        };
      case 'warning':
        return {
          colors: ['#FFBB00', '#FFD54F'],
          icon: 'alert',
          iconColor: '#333333',
          textColor: '#333333',
          urgencyText: 'WARNING - BE PREPARED'
        };
      default:
        return {
          colors: ['#2196F3', '#64B5F6'],
          icon: 'information-circle',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          urgencyText: 'FLOOD ADVISORY'
        };
    }
  };

  const handleDismiss = () => {
    if (alert?.severity === 'immediate') {
      RNAlert.alert(
        'Dismiss Flood Alert',
        'This is an immediate flood alert. Are you sure you want to dismiss it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Dismiss', style: 'destructive', onPress: () => {
            hideAlert();
            onDismiss?.();
          }}
        ]
      );
    } else {
      hideAlert();
      onDismiss?.();
    }
  };

  const handlePreparationGuide = () => {
    onPreparationGuide?.(alert);
  };

  if (!alert || !isVisible) {
    return null;
  }

  const config = getSeverityConfig(alert.severity);

  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.alertContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: pulseAnim }
              ]
            }
          ]}
        >
          <LinearGradient colors={config.colors} style={styles.alertContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons 
                  name={config.icon} 
                  size={24} 
                  color={config.iconColor} 
                  style={styles.alertIcon}
                />
                <Text style={[styles.urgencyText, { color: config.textColor }]}>
                  {config.urgencyText}
                </Text>
              </View>
              
              {alert.severity !== 'immediate' && (
                <TouchableOpacity 
                  onPress={handleDismiss}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={20} color={config.textColor} />
                </TouchableOpacity>
              )}
            </View>

            {/* Location */}
            <Text style={[styles.locationText, { color: config.textColor }]}>
              📍 {alert.location.name}
            </Text>

            {/* Flood Timeframe */}
            <View style={styles.timeframeContainer}>
              <Text style={[styles.timeframeLabel, { color: config.textColor }]}>
                Expected Flood Period:
              </Text>
              <Text style={[styles.timeframeText, { color: config.textColor }]}>
                {alert.floodTimeframe.description}
              </Text>
            </View>

            {/* Countdown Timer */}
            <View style={styles.countdownContainer}>
              <Ionicons 
                name="time" 
                size={20} 
                color={config.textColor} 
                style={styles.countdownIcon}
              />
              <Text style={[styles.countdownText, { color: config.textColor }]}>
                {countdownDisplay}
              </Text>
            </View>

            {/* Risk Level and Rainfall */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: config.textColor }]}>
                  Risk Level:
                </Text>
                <Text style={[styles.detailValue, { color: config.textColor }]}>
                  {alert.riskLevel}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: config.textColor }]}>
                  Expected Rainfall:
                </Text>
                <Text style={[styles.detailValue, { color: config.textColor }]}>
                  {alert.expectedRainfall.toFixed(1)} mm/hr
                </Text>
              </View>
            </View>

            {/* Preparation Guidance Preview */}
            <View style={styles.guidancePreview}>
              <Text style={[styles.guidanceLabel, { color: config.textColor }]}>
                Preparation Priority:
              </Text>
              <Text style={[styles.guidanceText, { color: config.textColor }]}>
                {alert.preparationGuidance.message}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.preparationButton]}
                onPress={handlePreparationGuide}
              >
                <Ionicons name="list" size={20} color={COLORS.TEXT_ON_PRIMARY} />
                <Text style={styles.buttonText}>
                  View Preparation Guide
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.detailsButton]}
                onPress={() => onViewDetails?.(alert)}
              >
                <Ionicons name="information-circle" size={20} color={COLORS.PRIMARY} />
                <Text style={[styles.buttonText, { color: COLORS.PRIMARY }]}>
                  View Details
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    paddingTop: 50,
  },
  alertContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  alertContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertIcon: {
    marginRight: 8,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  timeframeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  timeframeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.9,
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  countdownIcon: {
    marginRight: 8,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    opacity: 0.9,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  guidancePreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  guidanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.9,
  },
  guidanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    flex: 1,
  },
  preparationButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  detailsButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    elevation: 0,
  },
  buttonText: {
    color: COLORS.TEXT_ON_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FloodAlert;