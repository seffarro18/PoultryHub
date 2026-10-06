export interface ParsedUserAgent {
  device: string;
  browser: string;
  operatingSystem: string;
}

/**
 * Best-effort, zero-dependency regex parsing of navigator.userAgent — covers
 * major browsers/platforms only, not authoritative. There's no backend here
 * to do this more precisely server-side.
 */
export function parseUserAgent(userAgent: string = navigator.userAgent): ParsedUserAgent {
  const device = /Tablet|iPad/i.test(userAgent) ? "Tablet" : /Mobi|Android/i.test(userAgent) ? "Mobile" : "Desktop";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent) && !/Chrome/.test(userAgent)
            ? "Safari"
            : "Unknown";

  const operatingSystem = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent) && !/iPhone|iPad/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad|iOS/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown";

  return { device, browser, operatingSystem };
}
