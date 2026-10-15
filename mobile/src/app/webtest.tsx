import { WebView } from 'react-native-webview';

// TEMP perf probe — delete after measuring.
export default function WebTest() {
  return <WebView source={{ uri: 'https://shunyascape.shipsar.in/robots.txt?probe' }} style={{ flex: 1 }} webviewDebuggingEnabled />;
}
