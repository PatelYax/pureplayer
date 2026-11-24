const { withGradleProperties } = require('expo/config-plugins');

const property = 'android.cmakeVersion';

module.exports = function withCmakeVersion(config, { version }) {
  return withGradleProperties(config, (config) => {
    const entry = config.modResults.find(
      (item) => item.type === 'property' && item.key === property,
    );
    if (!entry) {
      config.modResults.push({ type: 'property', key: property, value: version });
    }
    return config;
  });
};
