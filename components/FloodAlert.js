import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Alert as RNAlert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RISK_LEVELS } from '../utils/constants';

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
  const [countdown, setCountdown] = useState(alert?.countdownTime || 0);
  const [countdownDisplay, setCountdownDisplay] = useState(alert?.countdownDisplay || '');
  
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    if (visible && alert) {
      startCountdown();
      
      if (autoHide && alert.severity !== 'immediate') {
        setTimeout(() => {
          onDismiss?.();
        }, autoHideDelay);
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [visible, alert]);


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
          urgencyText: 'IMMEDIATE ACTION REQUIRED',
          primaryButtonBg: 'rgba(255, 255, 255, 0.95)',
          primaryButtonText: '#FF4444',
          secondaryButtonBorder: '#FFFFFF',
          secondaryButtonText: '#FFFFFF',
          closeButtonColor: '#FFFFFF'
        };
      case 'urgent':
        return {
          colors: ['#FF8800', '#FFAA44'],
          icon: 'alert-circle',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          urgencyText: 'URGENT - PREPARE NOW',
          primaryButtonBg: 'rgba(255, 255, 255, 0.95)',
          primaryButtonText: '#FF8800',
          secondaryButtonBorder: '#FFFFFF',
          secondaryButtonText: '#FFFFFF',
          closeButtonColor: '#FFFFFF'
        };
      case 'warning':
        return {
          colors: ['#FFBB00', '#FFD54F'],
          icon: 'alert',
          iconColor: '#333333',
          textColor: '#333333',
          urgencyText: 'WARNING - BE PREPARED',
          primaryButtonBg: 'rgba(51, 51, 51, 0.9)',
          primaryButtonText: '#FFFFFF',
          secondaryButtonBorder: '#333333',
          secondaryButtonText: '#333333',
          closeButtonColor: '#333333'
        };
      default:
        return {
          colors: ['#2196F3', '#64B5F6'],
          icon: 'information-circle',
          iconColor: '#FFFFFF',
          textColor: '#FFFFFF',
          urgencyText: 'FLOOD ADVISORY',
          primaryButtonBg: 'rgba(255, 255, 255, 0.95)',
          primaryButtonText: '#2196F3',
          secondaryButtonBorder: '#FFFFFF',
          secondaryButtonText: '#FFFFFF',
          closeButtonColor: '#FFFFFF'
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
            onDismiss?.();
          }}
        ]
      );
    } else {
      onDismiss?.();
    }
  };

  const handlePreparationGuide = () => {
    onPreparationGuide?.(alert);
  };

  if (!alert || !visible) {
    return null;
  }

  const config = getSeverityConfig(alert.severity);

  return (
    <View style={[styles.overlay, visible && styles.overlayVisible]}>
      <View style={styles.alertContainer}>
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
              
              <TouchableOpacity 
                onPress={handleDismiss}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color={config.closeButtonColor} />
              </TouchableOpacity>
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
                style={[
                  styles.actionButton, 
                  { backgroundColor: config.primaryButtonBg }
                ]}
                onPress={handlePreparationGuide}
              >
                <Ionicons name="list" size={20} color={config.primaryButtonText} />
                <Text style={[styles.buttonText, { color: config.primaryButtonText }]}>
                  View Preparation Guide
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  styles.detailsButton,
                  { 
                    borderColor: config.secondaryButtonBorder,
                    borderWidth: 2
                  }
                ]}
                onPress={() => onViewDetails?.(alert)}
              >
                <Ionicons name="information-circle" size={20} color={config.secondaryButtonText} />
                <Text style={[styles.buttonText, { color: config.secondaryButtonText }]}>
                  View Details
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    pointerEvents: 'none', // Allow touch events to pass through when not visible
  },
  overlayVisible: {
    zIndex: 9999,
    pointerEvents: 'auto', // Enable touch events when visible
  },
  alertContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    pointerEvents: 'auto', // Ensure alert itself can receive touch events
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
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
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
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    flex: 1,
    minHeight: 48,
  },
  detailsButton: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.TEXT_ON_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FloodAlert;