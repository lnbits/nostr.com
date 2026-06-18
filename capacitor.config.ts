/// <reference types="@capacitor/local-notifications" />

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
    CapacitorHttp: {
      enabled: true
    },
    StatusBar: {
      overlaysWebView: false
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      androidClientId: pomegranateGoogleClientId,
      forceCodeForRefreshToken: false
    },
    LocalNotifications: {
      iconColor: '#29a3e8'
    }
  }
};

export default config;
