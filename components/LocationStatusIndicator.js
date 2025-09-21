/**
 * LocationStatusIndicator - Clear UI feedback for GPS location acquisition
 *
 * This component provides real-time feedback during location requests,
 * showing users exactly what's happening and offering clear next steps.
 *
 * Features:
 * - Progress indicators for each GPS attempt
 * - User-friendly error messages
 * - Retry and manual location options
 * - Time estimates and current status
 * - Integration with ReliableLocationService
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const LocationStatusIndicator = ({
  status = 'idle', // 'idle', 'requesting', 'success', 'error', 'manual_required'
  progress = null, // Progress object from ReliableLocationService
  error = null, // Error object with user-friendly message
  location = null, // Successful location result
  onRetry = null,
  onManualInput = null,
  onDismiss = null,
  style = {}
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (status !== 'idle') {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Pulse animation for active states
      if (status === 'requesting') {
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.8,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        );
        pulse.start();

        return () => pulse.stop();
      }
    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status, fadeAnim, pulseAnim]);

  const getStatusConfig = () => {
    switch (status) {
      case 'requesting':
        return {
          color: '#2196F3',
          backgroundColor: '#E3F2FD',
          icon: 'location',
          showProgress: true,
          title: progress?.message || 'Getting your location...',
          subtitle: getProgressSubtitle(),
        };

      case 'success':
        return {
          color: '#4CAF50',
          backgroundColor: '#E8F5E8',
          icon: 'checkmark-circle',
          showProgress: false,
          title: 'Location found!',
          subtitle: `Accurate to ${location?.accuracy ? Math.round(location.accuracy) + 'm' : 'unknown precision'}`,
        };

      case 'error':
        return {
          color: '#F44336',
          backgroundColor: '#FFEBEE',
          icon: 'alert-circle',
          showProgress: false,
          title: error?.userFriendlyMessage?.title || 'Location unavailable',
          subtitle: error?.userFriendlyMessage?.message || 'Unable to get your location',
        };

      case 'manual_required':
        return {
          color: '#FF9800',
          backgroundColor: '#FFF3E0',
          icon: 'hand-left',
          showProgress: false,
          title: 'Manual location needed',
          subtitle: 'Please provide your location manually for accurate results',
        };

      default:
        return null;
    }
  };

  const getProgressSubtitle = () => {
    if (!progress) return 'Searching for GPS signal...';

    switch (progress.phase) {
      case 'attempt_1':
        return 'Quick GPS attempt (10 seconds)...';
      case 'attempt_2':
        return 'Standard GPS attempt (20 seconds)...';
      case 'attempt_3':
        return 'High-accuracy GPS attempt (40 seconds)...';
      case 'retry':
        return `GPS attempt ${progress.attemptNumber} failed, trying ${progress.attemptNumber + 1}...`;
      case 'success':
        return 'Location acquired successfully!';
      case 'failed':
        return 'GPS acquisition failed';
      default:
        return 'Getting GPS location...';
    }
  };

  const getProgressPercentage = () => {
    if (!progress || !progress.attemptNumber || !progress.totalAttempts) {
      return 0;
    }

    const baseProgress = ((progress.attemptNumber - 1) / progress.totalAttempts) * 100;

    // Add some progress within the current attempt
    const attemptProgress = progress.phase === 'retry' ? 20 : 50;
    const currentAttemptProgress = (attemptProgress / progress.totalAttempts);

    return Math.min(100, baseProgress + currentAttemptProgress);
  };

  const statusConfig = getStatusConfig();

  if (!statusConfig || status === 'idle') {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
        style
      ]}
    >
      <View style={[styles.content, { backgroundColor: statusConfig.backgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                backgroundColor: statusConfig.color + '20',
                transform: [{ scale: pulseAnim }]
              }
            ]}
          >
            {statusConfig.showProgress ? (
              <ActivityIndicator size="small" color={statusConfig.color} />
            ) : (
              <Ionicons
                name={statusConfig.icon}
                size={20}
                color={statusConfig.color}
              />
            )}
          </Animated.View>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: statusConfig.color }]}>
              {statusConfig.title}
            </Text>
            <Text style={styles.subtitle}>
              {statusConfig.subtitle}
            </Text>
          </View>

          {onDismiss && status !== 'requesting' && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar */}
        {statusConfig.showProgress && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: statusConfig.color,
                    width: `${getProgressPercentage()}%`
                  }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress?.attemptNumber && progress?.totalAttempts
                ? `Attempt ${progress.attemptNumber} of ${progress.totalAttempts}`
                : 'Searching...'
              }
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {(status === 'error' || status === 'manual_required') && (
          <View style={styles.actionButtons}>
            {onRetry && error?.userFriendlyMessage?.canRetry && (
              <TouchableOpacity
                style={[styles.actionButton, styles.retryButton]}
                onPress={onRetry}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color="#2196F3" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}

            {onManualInput && error?.userFriendlyMessage?.showManualOption && (
              <TouchableOpacity
                style={[styles.actionButton, styles.manualButton]}
                onPress={onManualInput}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={16} color="#FF9800" />
                <Text style={styles.manualButtonText}>Manual Location</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Suggestion Text */}
        {error?.userFriendlyMessage?.suggestion && status === 'error' && (
          <View style={styles.suggestionSection}>
            <Text style={styles.suggestionText}>
              💡 {error.userFriendlyMessage.suggestion}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

/**
 * LocationModal - Full-screen modal for location operations
 * Used for longer GPS operations or when user needs to provide manual input
 */
export const LocationModal = ({
  visible = false,
  status = 'idle',
  progress = null,
  error = null,
  onRetry = null,
  onManualInput = null,
  onDismiss = null,
  children = null,
}) => {
  if (!visible) return null;

  const getModalConfig = () => {
    switch (status) {
      case 'requesting':
        return {
          gradient: ['#E3F2FD', '#BBDEFB'],
          icon: 'location',
          iconColor: '#2196F3',
          title: 'Finding your location',
          description: 'Please wait while we get your GPS coordinates for accurate flood predictions.',
        };

      case 'error':
        return {
          gradient: ['#FFEBEE', '#FFCDD2'],
          icon: 'alert-circle',
          iconColor: '#F44336',
          title: 'Location unavailable',
          description: error?.userFriendlyMessage?.message || 'Unable to get your GPS location.',
        };

      case 'manual_required':
        return {
          gradient: ['#FFF3E0', '#FFE0B2'],
          icon: 'hand-left',
          iconColor: '#FF9800',
          title: 'Manual location needed',
          description: 'Please select your location manually for accurate flood predictions.',
        };

      default:
        return {
          gradient: ['#F5F5F5', '#EEEEEE'],
          icon: 'location',
          iconColor: '#666',
          title: 'Location services',
          description: 'Working with your location...',
        };
    }
  };

  const modalConfig = getModalConfig();

  return (
    <View style={styles.modalOverlay}>
      <LinearGradient
        colors={modalConfig.gradient}
        style={styles.modalGradient}
      >
        <View style={styles.modalContent}>
          {/* Icon */}
          <View style={[styles.modalIcon, { backgroundColor: modalConfig.iconColor + '20' }]}>
            {status === 'requesting' ? (
              <ActivityIndicator size="large" color={modalConfig.iconColor} />
            ) : (
              <Ionicons name={modalConfig.icon} size={48} color={modalConfig.iconColor} />
            )}
          </View>

          {/* Title and Description */}
          <Text style={styles.modalTitle}>{modalConfig.title}</Text>
          <Text style={styles.modalDescription}>{modalConfig.description}</Text>

          {/* Progress Indicator */}
          {status === 'requesting' && progress && (
            <View style={styles.modalProgress}>
              <Text style={styles.modalProgressText}>
                {progress.message || 'Getting location...'}
              </Text>

              {progress.attemptNumber && progress.totalAttempts && (
                <View style={styles.modalProgressBar}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      { width: `${(progress.attemptNumber / progress.totalAttempts) * 100}%` }
                    ]}
                  />
                </View>
              )}
            </View>
          )}

          {/* Custom Content */}
          {children}

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            {onRetry && status === 'error' && error?.userFriendlyMessage?.canRetry && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalRetryButton]}
                onPress={onRetry}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.modalRetryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}

            {onManualInput && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalManualButton]}
                onPress={onManualInput}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={20} color="#fff" />
                <Text style={styles.modalManualButtonText}>Manual Location</Text>
              </TouchableOpacity>
            )}

            {onDismiss && status !== 'requesting' && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDismissButton]}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDismissButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  // Status Indicator Styles
  container: {
    marginHorizontal: 20,
    marginVertical: 8,
  },
  content: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  dismissButton: {
    padding: 4,
  },
  progressSection: {
    marginTop: 12,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#E3F2FD',
  },
  retryButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  manualButton: {
    backgroundColor: '#FFF3E0',
  },
  manualButtonText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  suggestionSection: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
  },
  suggestionText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalGradient: {
    width: width * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalProgress: {
    width: '100%',
    marginBottom: 20,
  },
  modalProgressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalProgressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  modalProgressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  modalActions: {
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalRetryButton: {
    backgroundColor: '#2196F3',
  },
  modalRetryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalManualButton: {
    backgroundColor: '#FF9800',
  },
  modalManualButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalDismissButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  modalDismissButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LocationStatusIndicator;