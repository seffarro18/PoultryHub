import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.poultry.app',
  appName: 'PoultryHub',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      // No custom smallIcon — Android notification icons must be a flat
      // white/transparent silhouette (the OS tints them), not the full-color
      // app icon, and generating one needs real image tooling this
      // environment doesn't have. The plugin falls back to a sensible
      // default; swap in a proper monochrome icon asset later if wanted.
      iconColor: '#2E7D32',
    },
  },
};

export default config;
