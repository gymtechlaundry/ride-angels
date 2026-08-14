import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.rideangels.app',
  appName: 'Ride Angels',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // Match ColorPing: let Ionic/CSS handle safe areas via viewport-fit=cover.
    // 'automatic' insets the WKWebView AND Ionic pads again → tab bar floats too high.
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#F5F6FA',
  },
  android: {
    backgroundColor: '#F5F6FA',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: '#F5F6FA',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F5F6FA',
    },
    Keyboard: {
      // Ionic mode resizes ion-app so ion-content can scroll focused fields
      // above the native keyboard on fullscreen auth screens.
      resize: 'ionic',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
