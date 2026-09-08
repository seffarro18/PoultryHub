import { LocalNotifications } from "@capacitor/local-notifications";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { NativeSettings, AndroidSettings } from "capacitor-native-settings";

export type PermissionStatus = "granted" | "denied" | "prompt";

function normalize(state: string): PermissionStatus {
  if (state === "granted") return "granted";
  if (state === "prompt" || state === "prompt-with-rationale") return "prompt";
  return "denied";
}

/**
 * Status-only — never shows an OS dialog. Safe to call on every render (e.g.
 * the App Permissions settings page) without ever prompting the user.
 */
export async function getNotificationStatus(): Promise<PermissionStatus> {
  const result = await LocalNotifications.checkPermissions();
  return normalize(result.display);
}

export async function getCameraStatus(): Promise<PermissionStatus> {
  const result = await Camera.checkPermissions();
  return normalize(result.camera);
}

export async function getLocationStatus(): Promise<PermissionStatus> {
  const result = await Geolocation.checkPermissions();
  return normalize(result.location);
}

/**
 * Shows the real OS permission dialog — only ever call these from an
 * explicit, deliberate user action (a button tap), never automatically on
 * mount or on a timer. That's what keeps this from "repeatedly asking":
 * the app only ever prompts when the person just told it to. If the result
 * comes back "denied", the caller's job is to show the explanation + an
 * "Open Settings" button, not to call this again on its own.
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const result = await LocalNotifications.requestPermissions();
  return normalize(result.display);
}

export async function requestCameraPermission(): Promise<PermissionStatus> {
  const result = await Camera.requestPermissions({ permissions: ["camera"] });
  return normalize(result.camera);
}

export async function requestLocationPermission(): Promise<PermissionStatus> {
  const result = await Geolocation.requestPermissions();
  return normalize(result.location);
}

/**
 * Deep-links to this app's own entry in Android Settings — the recovery
 * path whenever a permission comes back "denied". Uses the Android-specific
 * openAndroid() rather than the cross-platform open() — this project has no
 * iOS build target, so there's no meaningful value to supply for open()'s
 * required optionIOS parameter.
 */
export async function openAppSettings(): Promise<void> {
  await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails });
}

/** Same idea as openAppSettings(), but jumps straight to this app's notification-specific settings screen instead of the general App Info page. */
export async function openNotificationSettings(): Promise<void> {
  await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
}
