import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState({
    name: 'Alice Chen',
    age: 34,
    occupation: 'Administrative Coordinator',
    location: 'Puchong, Selangor',
    familySize: 4,
    hasChildren: true,
    childrenAges: [8, 12],
    healthConditions: [],
    riskTolerance: 'moderate', // low, moderate, high
    language: 'en', // en, ms
    setupComplete: true
  });

  const [notificationSettings, setNotificationSettings] = useState({
    floodAlerts: true,
    locationAlerts: true,
    weatherUpdates: true,
    emergencyAlerts: true,
    dailyForecast: false,
    sound: true,
    vibration: true,
    frequency: 'important', // all, important, emergency
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00'
    }
  });

  const [preferences, setPreferences] = useState({
    units: 'metric', // metric, imperial
    theme: 'auto', // light, dark, auto
    mapStyle: 'standard', // standard, satellite, hybrid
    showTutorial: true,
    dataUsage: 'wifi', // wifi, always, never
    locationSharing: false,
    analytics: true
  });

  const [emergencyContacts, setEmergencyContacts] = useState([
    {
      id: 1,
      name: 'Emergency Services',
      phone: '999',
      type: 'emergency',
      priority: 1
    },
    {
      id: 2,
      name: 'Husband - David Chen',
      phone: '+60123456789',
      type: 'family',
      priority: 2
    },
    {
      id: 3,
      name: 'Children\'s School',
      phone: '+60387654321',
      type: 'institution',
      priority: 3
    },
    {
      id: 4,
      name: 'Parents',
      phone: '+60198765432',
      type: 'family',
      priority: 4
    }
  ]);

  const [appUsage, setAppUsage] = useState({
    firstLaunch: new Date().toISOString(),
    lastLaunch: new Date().toISOString(),
    totalLaunches: 1,
    totalTimeSpent: 0, // in minutes
    featuresUsed: ['forecast', 'locations'],
    lastDataRefresh: new Date().toISOString()
  });

  // Load user data from AsyncStorage on component mount
  useEffect(() => {
    loadUserProfile();
    loadNotificationSettings();
    loadPreferences();
    loadEmergencyContacts();
    loadAppUsage();
  }, []);

  // Save user data to AsyncStorage whenever they change
  useEffect(() => {
    saveUserProfile();
  }, [userProfile]);

  useEffect(() => {
    saveNotificationSettings();
  }, [notificationSettings]);

  useEffect(() => {
    savePreferences();
  }, [preferences]);

  useEffect(() => {
    saveEmergencyContacts();
  }, [emergencyContacts]);

  useEffect(() => {
    saveAppUsage();
  }, [appUsage]);

  const loadUserProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile));
      }
    } catch (error) {
      console.log('Error loading user profile:', error);
    }
  };

  const saveUserProfile = async () => {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
    } catch (error) {
      console.log('Error saving user profile:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('notificationSettings');
      if (storedSettings) {
        setNotificationSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.log('Error loading notification settings:', error);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
    } catch (error) {
      console.log('Error saving notification settings:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const storedPreferences = await AsyncStorage.getItem('preferences');
      if (storedPreferences) {
        setPreferences(JSON.parse(storedPreferences));
      }
    } catch (error) {
      console.log('Error loading preferences:', error);
    }
  };

  const savePreferences = async () => {
    try {
      await AsyncStorage.setItem('preferences', JSON.stringify(preferences));
    } catch (error) {
      console.log('Error saving preferences:', error);
    }
  };

  const loadEmergencyContacts = async () => {
    try {
      const storedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (storedContacts) {
        setEmergencyContacts(JSON.parse(storedContacts));
      }
    } catch (error) {
      console.log('Error loading emergency contacts:', error);
    }
  };

  const saveEmergencyContacts = async () => {
    try {
      await AsyncStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
    } catch (error) {
      console.log('Error saving emergency contacts:', error);
    }
  };

  const loadAppUsage = async () => {
    try {
      const storedUsage = await AsyncStorage.getItem('appUsage');
      if (storedUsage) {
        const usage = JSON.parse(storedUsage);
        setAppUsage({
          ...usage,
          lastLaunch: new Date().toISOString(),
          totalLaunches: usage.totalLaunches + 1
        });
      }
    } catch (error) {
      console.log('Error loading app usage:', error);
    }
  };

  const saveAppUsage = async () => {
    try {
      await AsyncStorage.setItem('appUsage', JSON.stringify(appUsage));
    } catch (error) {
      console.log('Error saving app usage:', error);
    }
  };

  const updateUserProfile = (updates) => {
    setUserProfile(prev => ({ ...prev, ...updates }));
  };

  const updateNotificationSettings = (updates) => {
    setNotificationSettings(prev => ({ ...prev, ...updates }));
  };

  const updatePreferences = (updates) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const addEmergencyContact = (contact) => {
    const newContact = {
      id: Date.now(),
      ...contact,
      priority: emergencyContacts.length + 1
    };
    setEmergencyContacts(prev => [...prev, newContact]);
  };

  const updateEmergencyContact = (contactId, updates) => {
    setEmergencyContacts(prev =>
      prev.map(contact =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      )
    );
  };

  const removeEmergencyContact = (contactId) => {
    setEmergencyContacts(prev =>
      prev.filter(contact => contact.id !== contactId)
    );
  };

  const logFeatureUsage = (featureName) => {
    setAppUsage(prev => ({
      ...prev,
      featuresUsed: [...new Set([...prev.featuresUsed, featureName])]
    }));
  };

  const updateDataRefresh = () => {
    setAppUsage(prev => ({
      ...prev,
      lastDataRefresh: new Date().toISOString()
    }));
  };

  const resetUserData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userProfile',
        'notificationSettings', 
        'preferences',
        'emergencyContacts',
        'appUsage'
      ]);
      
      // Reset to default values
      setUserProfile({
        name: '',
        age: null,
        occupation: '',
        location: '',
        familySize: 1,
        hasChildren: false,
        childrenAges: [],
        healthConditions: [],
        riskTolerance: 'moderate',
        language: 'en',
        setupComplete: false
      });
    } catch (error) {
      console.log('Error resetting user data:', error);
    }
  };

  const value = {
    userProfile,
    notificationSettings,
    preferences,
    emergencyContacts,
    appUsage,
    updateUserProfile,
    updateNotificationSettings,
    updatePreferences,
    addEmergencyContact,
    updateEmergencyContact,
    removeEmergencyContact,
    logFeatureUsage,
    updateDataRefresh,
    resetUserData
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};