const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds (APK/AAB) with the Play upload key when its details are in
 * ~/.gradle/gradle.properties (SHUNYASCAPE_UPLOAD_*); falls back to the debug key otherwise.
 * Keeps the keystore and its passwords out of the repo and survives `expo prebuild`.
 */
const SIGNING = `
        release {
            if (project.hasProperty('SHUNYASCAPE_UPLOAD_STORE_FILE')) {
                storeFile file(SHUNYASCAPE_UPLOAD_STORE_FILE)
                storePassword SHUNYASCAPE_UPLOAD_STORE_PASSWORD
                keyAlias SHUNYASCAPE_UPLOAD_KEY_ALIAS
                keyPassword SHUNYASCAPE_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('SHUNYASCAPE_UPLOAD_STORE_FILE')) {
      src = src.replace(/signingConfigs \{/, `signingConfigs {${SIGNING}`);
      // Point the release build type at the release signing config (the template uses debug)
      src = src.replace(
        /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('SHUNYASCAPE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
