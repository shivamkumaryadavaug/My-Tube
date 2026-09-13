import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mytube.study',
  appName: 'MYTUBE',
  webDir: 'www',

  android: {
    allowMixedContent: false
  },

  server: {
    androidScheme: 'https'
  }
};

export default config;
