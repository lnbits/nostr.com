import type { CapacitorConfig } from '@capacitor/cli';

// Public Google OAuth client ID used by auth.njump.me for Pomegranate login.
const pomegranateGoogleClientId = '300561989816-7nv10jo4vdn0d6p9knf12g7rq4fcusnc.apps.googleusercontent.com';

const config: CapacitorConfig = {
  appId: 'com.nostr.social',
  appName: 'Nostr',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      androidClientId: pomegranateGoogleClientId,
      forceCodeForRefreshToken: false
    }
  }
};

export default config;
