// utils/NotificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

class NotificationService {
  constructor() {
    this.setupNotifications();
  }

  async setupNotifications() {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  }

  async scheduleFloodAlert(location, riskLevel, timeframe) {
    const trigger = new Date(Date.now() + timeframe * 60 * 60 * 1000);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Flood Alert - ${location}`,
        body: `${riskLevel} flood risk detected. Take necessary precautions.`,
        data: { location, riskLevel },
        sound: 'default',
      },
      trigger,
    });
  }

  async scheduleAdvancedFloodAlert(alert) {
    const { severity, location, countdownTime, riskLevel } = alert;
    
    let scheduleTimes = [];
    let notifications = [];

    // Calculate when to send notifications based on severity and countdown
    switch (severity) {
      case 'immediate':
        // Send immediately
        notifications.push({
          trigger: null,
          content: {
            title: '🚨 FLOOD ALERT - IMMEDIATE ACTION REQUIRED',
            body: `Flooding detected at ${location.name}. Move to safety immediately!`,
            sound: 'default',
            priority: 'max'
          }
        });
        break;

      case 'urgent':
        // Send immediately and remind 30 minutes later
        notifications.push(
          {
            trigger: null,
            content: {
              title: '⚠️ URGENT Flood Warning',
              body: `${location.name}: ${riskLevel} flood risk. Prepare now!`,
              sound: 'default',
              priority: 'high'
            }
          },
          {
            trigger: new Date(Date.now() + 30 * 60 * 1000),
            content: {
              title: '⚠️ Flood Warning Reminder',
              body: `${location.name}: Have you started preparations? Time is running out.`,
              sound: 'default',
              priority: 'high'
            }
          }
        );
        break;

      case 'warning':
        // Send immediately and 2 hours before expected flood
        const twoHoursBefore = Math.max(0, countdownTime - 2 * 60 * 60 * 1000);
        notifications.push(
          {
            trigger: null,
            content: {
              title: '🌧️ Flood Watch',
              body: `${location.name}: Be prepared. ${alert.countdownDisplay}`,
              sound: 'default',
              priority: 'normal'
            }
          }
        );
        
        if (twoHoursBefore > 0) {
          notifications.push({
            trigger: new Date(Date.now() + twoHoursBefore),
            content: {
              title: '⚠️ Flood Alert Update',
              body: `${location.name}: Flooding expected in 2 hours. Final preparations.`,
              sound: 'default',
              priority: 'high'
            }
          });
        }
        break;

      case 'advisory':
        // Send now and 6 hours before
        const sixHoursBefore = Math.max(0, countdownTime - 6 * 60 * 60 * 1000);
        notifications.push({
          trigger: null,
          content: {
            title: '📱 Flood Advisory',
            body: `${location.name}: Monitor conditions. ${alert.countdownDisplay}`,
            sound: 'default',
            priority: 'low'
          }
        });

        if (sixHoursBefore > 0) {
          notifications.push({
            trigger: new Date(Date.now() + sixHoursBefore),
            content: {
              title: '🌧️ Flood Watch Update',
              body: `${location.name}: Flooding possible in 6 hours. Stay alert.`,
              sound: 'default',
              priority: 'normal'
            }
          });
        }
        break;
    }

    // Schedule all notifications
    const notificationIds = [];
    for (const notification of notifications) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            ...notification.content,
            data: {
              type: 'flood_alert',
              alertId: alert.id,
              severity: severity,
              location: location.name,
              timestamp: new Date().toISOString()
            }
          },
          trigger: notification.trigger
        });
        notificationIds.push(id);
      } catch (error) {
        console.error('Error scheduling flood notification:', error);
      }
    }

    return notificationIds;
  }

  async sendFloodAlertUpdate(alert, updateType = 'condition_change') {
    const { location, severity, riskLevel, countdownDisplay } = alert;
    
    let title, body;
    
    switch (updateType) {
      case 'condition_worsened':
        title = '🚨 Flood Alert - Conditions Worsened';
        body = `${location.name}: Risk increased to ${riskLevel}. ${countdownDisplay}`;
        break;
      case 'condition_improved':
        title = '✅ Flood Alert - Conditions Improved';
        body = `${location.name}: Risk reduced to ${riskLevel}. Continue monitoring.`;
        break;
      case 'time_update':
        title = '⏰ Flood Alert - Time Update';
        body = `${location.name}: Updated timing. ${countdownDisplay}`;
        break;
      default:
        title = '📊 Flood Alert Update';
        body = `${location.name}: ${riskLevel} risk. ${countdownDisplay}`;
    }

    await this.sendImmediateAlert(title, body, {
      type: 'flood_alert_update',
      updateType,
      alertId: alert.id,
      severity: severity,
      location: location.name,
      timestamp: new Date().toISOString()
    });
  }

  async sendFloodAllClear(location) {
    await this.sendImmediateAlert(
      '✅ Flood All Clear',
      `${location.name}: Flood risk has passed. Conditions are returning to normal.`,
      {
        type: 'flood_all_clear',
        location: location.name,
        timestamp: new Date().toISOString()
      }
    );
  }

  async sendPreparationReminder(alert, reminderType = 'general') {
    const { location, preparationGuidance } = alert;
    
    let title, body;
    
    switch (reminderType) {
      case 'urgent_preparation':
        title = '⚡ Urgent: Complete Flood Preparations';
        body = `${location.name}: ${preparationGuidance.message}`;
        break;
      case 'evacuation_ready':
        title = '🚗 Flood Alert: Be Ready to Evacuate';
        body = `${location.name}: Have evacuation plan ready. Monitor conditions closely.`;
        break;
      case 'emergency_kit':
        title = '🎒 Flood Prep: Check Emergency Kit';
        body = `${location.name}: Ensure emergency supplies are ready and accessible.`;
        break;
      default:
        title = '📋 Flood Preparation Reminder';
        body = `${location.name}: ${preparationGuidance.message}`;
    }

    await this.sendImmediateAlert(title, body, {
      type: 'preparation_reminder',
      reminderType,
      location: location.name,
      priority: preparationGuidance.priority,
      timestamp: new Date().toISOString()
    });
  }

  async cancelFloodAlerts(alertId) {
    try {
      // In a real implementation, we'd track notification IDs per alert
      // For now, we'll cancel all scheduled notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log(`Cancelled notifications for alert: ${alertId}`);
    } catch (error) {
      console.error('Error cancelling flood alerts:', error);
    }
  }

  async getNotificationHistory() {
    try {
      const delivered = await Notifications.getPresentedNotificationsAsync();
      return delivered.filter(notification => 
        notification.request?.content?.data?.type?.includes('flood')
      );
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  async sendImmediateAlert(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null,
    });
  }

  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService = new NotificationService();