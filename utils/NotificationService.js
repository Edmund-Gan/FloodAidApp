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