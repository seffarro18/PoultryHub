const ONBOARDING_KEY = "poultryhub_onboarding_completed";

/** Plain localStorage — same persistence approach ThemeContext already uses successfully inside the Capacitor WebView, so no new native plugin is needed just for a one-time flag. */
export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingCompleted(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}
