import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Adds native Google sign-in on top of app.json once its iOS client ID is set
 * (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in mobile/.env). Android needs no plugin
 * options: it's matched by package name + signing SHA-1 in Google Cloud.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  // "1234-abcd.apps.googleusercontent.com" -> "com.googleusercontent.apps.1234-abcd"
  const iosUrlScheme = iosClientId ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}` : undefined;
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      iosUrlScheme ? ['@react-native-google-signin/google-signin', { iosUrlScheme }] : '@react-native-google-signin/google-signin',
    ],
  };
};
