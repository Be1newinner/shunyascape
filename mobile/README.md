# ShunyaScape mobile app

The ShunyaScape battleground in a full-screen WebView (Expo SDK 57). The game itself is the website: on-screen controls and the phone graphics preset come from the site, so browser and app always match.

## Setup

1. `npm install`
2. `mobile/.env` sets the site address: `EXPO_PUBLIC_GAME_URL=https://shunyascape.shipsar.in`
3. `npx expo start`, then open it in Expo Go on a phone (WebView, orientation and keep-awake are all in Expo Go).

For store builds use EAS: `npx eas-cli@latest build --platform android` (or `ios`).

## How it fits together

- The app opens `<EXPO_PUBLIC_GAME_URL>/battleground` and adds `ShunyaScapeApp` to the user agent.
- Seeing that, the site sends signed-out players straight to sign-in and hides the Google button (Google blocks its sign-in inside web views). Email sign-in works.
- Landscape is locked, the screen stays on, the status bar is hidden, and Android's back button goes back inside the game.

## Not done yet

- Google sign-in in the app needs native Google sign-in (a development build plus Android/iOS OAuth clients in Google Cloud) passing the ID token to the site.
