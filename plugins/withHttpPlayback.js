const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withHttpPlayback(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw new Error('HTTP playback requires an Android application manifest entry.');
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
