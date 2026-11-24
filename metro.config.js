const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const projectEntry = path.join(__dirname, 'index.ts');
const resolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // The TV list package's peer can install a second React Native runtime.
  const resolutionContext =
    moduleName === 'react-native' || moduleName.startsWith('react-native/')
      ? { ...context, originModulePath: projectEntry }
      : context;
  return (resolveRequest ?? context.resolveRequest)(resolutionContext, moduleName, platform);
};

module.exports = config;
