/**
 * Flat, geometric hero illustration — a coop, a hen, and a couple of eggs.
 * Deliberately simple (same level of detail as the app's own logomark, just
 * scaled up) rather than a detailed cartoon scene, and built entirely from
 * theme tokens so it adapts automatically between light/dark mode.
 */
export default function PoultryIllustration() {
  return (
    <svg viewBox="0 0 240 180" className="h-full w-full" role="img" aria-label="A hen beside a poultry coop, with eggs in the foreground">
      {/* Ground */}
      <ellipse cx="120" cy="158" rx="100" ry="10" fill="var(--color-primary)" opacity="0.1" />

      {/* Coop — strokes use the primary green (not the hairline UI border token) so the shapes stay
          clearly defined against the background in both light and dark mode. */}
      <rect x="34" y="86" width="72" height="56" rx="6" fill="var(--color-card)" stroke="var(--color-primary)" strokeOpacity="0.45" strokeWidth="2.5" />
      <path d="M26 90 L70 54 L114 90 Z" fill="var(--color-primary)" />
      <rect x="58" y="108" width="24" height="34" rx="3" fill="var(--color-primary)" opacity="0.18" />
      <circle cx="94" cy="102" r="4" fill="var(--color-primary)" opacity="0.4" />

      {/* Sun/monitoring accent */}
      <circle cx="196" cy="46" r="16" fill="var(--color-accent)" opacity="0.85" />
      <path
        d="M150 70 L166 58 L180 66 L198 50"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />

      {/* Hen */}
      <g>
        <ellipse cx="160" cy="122" rx="30" ry="24" fill="var(--color-card)" stroke="var(--color-primary)" strokeOpacity="0.45" strokeWidth="2.5" />
        <circle cx="188" cy="104" r="13" fill="var(--color-card)" stroke="var(--color-primary)" strokeOpacity="0.45" strokeWidth="2.5" />
        <path d="M188 92 C191 86, 198 87, 196 93 C193 91, 190 92, 188 92Z" fill="var(--color-accent)" />
        <path d="M198 104 L206 107 L198 109Z" fill="var(--color-accent)" />
        <circle cx="192" cy="102" r="1.6" fill="var(--color-foreground)" />
        <path d="M132 128 L118 122 L132 134Z" fill="var(--color-primary)" opacity="0.7" />
      </g>

      {/* Eggs */}
      <ellipse cx="60" cy="154" rx="9" ry="11" fill="var(--color-card)" stroke="var(--color-primary)" strokeOpacity="0.45" strokeWidth="2.5" />
      <ellipse cx="80" cy="158" rx="8" ry="10" fill="var(--color-card)" stroke="var(--color-primary)" strokeOpacity="0.45" strokeWidth="2.5" />
    </svg>
  );
}
