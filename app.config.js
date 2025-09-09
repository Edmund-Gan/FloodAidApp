import 'dotenv/config';

export default {
  expo: {
    name: "FloodAid",
    slug: "floodaid",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#2196F3"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.floodaid.malaysia",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "FloodAid needs your location to provide accurate flood predictions for your area.",
        NSLocationAlwaysUsageDescription: "FloodAid needs your location to monitor flood risks and send you timely alerts."
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#2196F3"
      },
      package: "com.floodaid.malaysia",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED",
        "SCHEDULE_EXACT_ALARM"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow FloodAid to use your location for flood predictions and alerts."
        }
      ],
      [
        "expo-notifications",
        {
          color: "#2196F3"
        }
      ]
    ],
    extra: {
      openMeteoApiUrl: process.env.OPEN_METEO_API_URL || "https://api.open-meteo.com/v1",
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    }
  }
};