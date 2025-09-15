const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Watchman configuration for better performance
config.watchFolders = [];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Ignore unnecessary files to reduce file watching
config.resolver.blacklistRE = /(.*\/__tests__\/.*|.*\/node_modules\/.*\/Pods\/.*|.*\/node_modules\/.*/;

// Configure assets and source extensions
config.resolver.sourceExts.push('cjs');

// Watch mode configuration
config.watchman = {
  defer_states: ['hg.update'],
};

// Metro transformer configuration
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;