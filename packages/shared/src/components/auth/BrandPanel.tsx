import { motion } from "framer-motion";
import {
  BarChart2,
  Package,
  Wheat,
  HeartPulse,
  FileBarChart,
  Bell,
} from "lucide-react";
import { useSystemSettings } from "../../context/SystemSettingsContext";

const features = [
  { icon: BarChart2, label: "Daily Egg Production Monitoring" },
  { icon: Package, label: "Poultry Inventory Tracking" },
  { icon: Wheat, label: "Feed & Vitamin Management" },
  { icon: HeartPulse, label: "Health Monitoring" },
  { icon: FileBarChart, label: "Reports & Analytics" },
  { icon: Bell, label: "Smart Notifications" },
] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

/** SVG poultry farm illustration — stylised, minimal */
function FarmIllustration() {
  return (
    <svg
      viewBox="0 0 360 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full max-w-sm"
    >
      {/* Sky background */}
      <rect width="360" height="220" rx="16" fill="rgba(255,255,255,0.06)" />

      {/* Sun */}
      <circle cx="300" cy="42" r="22" fill="rgba(255,193,7,0.25)" />
      <circle cx="300" cy="42" r="14" fill="rgba(255,193,7,0.5)" />

      {/* Far hills */}
      <ellipse cx="80" cy="175" rx="100" ry="45" fill="rgba(255,255,255,0.06)" />
      <ellipse cx="280" cy="180" rx="120" ry="40" fill="rgba(255,255,255,0.05)" />

      {/* Ground */}
      <rect x="0" y="170" width="360" height="50" rx="0" fill="rgba(255,255,255,0.07)" />

      {/* Barn */}
      <rect x="40" y="100" width="80" height="70" rx="2" fill="rgba(255,255,255,0.1)" />
      <polygon points="40,100 80,65 120,100" fill="rgba(255,255,255,0.14)" />
      {/* Barn door */}
      <rect x="68" y="130" width="24" height="40" rx="2" fill="rgba(255,255,255,0.08)" />
      {/* Barn window */}
      <rect x="50" y="110" width="16" height="12" rx="2" fill="rgba(255,193,7,0.3)" />
      <rect x="94" y="110" width="16" height="12" rx="2" fill="rgba(255,193,7,0.3)" />

      {/* Silo */}
      <rect x="130" y="115" width="28" height="55" rx="4" fill="rgba(255,255,255,0.09)" />
      <ellipse cx="144" cy="115" rx="14" ry="7" fill="rgba(255,255,255,0.12)" />

      {/* Chicken coop */}
      <rect x="175" y="130" width="60" height="40" rx="3" fill="rgba(255,255,255,0.1)" />
      <polygon points="175,130 205,110 235,130" fill="rgba(255,255,255,0.13)" />
      {/* Coop wire */}
      <line x1="175" y1="140" x2="235" y2="140" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1="175" y1="150" x2="235" y2="150" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1="175" y1="160" x2="235" y2="160" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1="195" y1="130" x2="195" y2="170" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1="215" y1="130" x2="215" y2="170" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

      {/* Chickens */}
      {/* Chicken 1 */}
      <circle cx="258" cy="162" r="8" fill="rgba(255,255,255,0.18)" />
      <circle cx="264" cy="156" r="5" fill="rgba(255,255,255,0.2)" />
      <polygon points="267,155 271,154 269,157" fill="rgba(255,193,7,0.7)" />
      <circle cx="266" cy="155" r="1" fill="rgba(46,125,50,0.8)" />
      {/* Chicken 2 */}
      <circle cx="280" cy="165" r="7" fill="rgba(255,255,255,0.15)" />
      <circle cx="286" cy="159" r="4.5" fill="rgba(255,255,255,0.18)" />
      <polygon points="289,158 293,157 291,160" fill="rgba(255,193,7,0.7)" />
      {/* Chicken 3 */}
      <circle cx="305" cy="162" r="8" fill="rgba(255,255,255,0.18)" />
      <circle cx="311" cy="156" r="5" fill="rgba(255,255,255,0.2)" />
      <polygon points="314,155 318,154 316,157" fill="rgba(255,193,7,0.7)" />

      {/* Eggs */}
      <ellipse cx="260" cy="172" rx="4" ry="5" fill="rgba(255,193,7,0.5)" />
      <ellipse cx="290" cy="173" rx="4" ry="5" fill="rgba(255,193,7,0.4)" />

      {/* Fence */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <rect
          key={i}
          x={20 + i * 32}
          y="162"
          width="6"
          height="18"
          rx="2"
          fill="rgba(255,255,255,0.15)"
        />
      ))}
      <line x1="20" y1="168" x2="355" y2="168" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      <line x1="20" y1="174" x2="355" y2="174" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

      {/* Data chart overlay (top-right) */}
      <rect x="248" y="58" width="96" height="58" rx="8" fill="rgba(255,255,255,0.08)" />
      <text x="262" y="74" fontFamily="Inter,sans-serif" fontSize="9" fill="rgba(255,255,255,0.7)" fontWeight="600">
        Today
      </text>
      <text x="310" y="74" fontFamily="Inter,sans-serif" fontSize="9" fill="rgba(255,193,7,0.9)" fontWeight="700">
        +12%
      </text>
      {/* Mini bar chart */}
      {[24, 32, 20, 38, 30, 42].map((h, i) => (
        <rect
          key={i}
          x={264 + i * 12}
          y={104 - h * 0.7}
          width="8"
          height={h * 0.7}
          rx="2"
          fill={i === 5 ? "rgba(255,193,7,0.8)" : "rgba(102,187,106,0.5)"}
        />
      ))}
    </svg>
  );
}

export default function BrandPanel() {
  const { settings } = useSystemSettings();
  const systemName = settings?.systemName || "PoultryHub";
  const logoUrl = settings?.logoUrl ?? null;

  return (
    <div
      className="relative flex flex-col justify-between h-full p-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #1B5E20 0%, #2E7D32 45%, #388E3C 100%)",
      }}
    >
      {/* Subtle dot grid texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 70% 20%, rgba(102,187,106,0.2) 0%, transparent 60%)",
        }}
      />

      {/* Logo mark */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex items-center gap-3"
      >
        {logoUrl ? (
          <img src={logoUrl} alt={systemName} className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            {/* Egg + leaf logomark */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <ellipse cx="12" cy="14" rx="7" ry="8.5" fill="rgba(255,255,255,0.9)" />
              <path
                d="M12 6 C14 3, 19 4, 17 8 C15 6, 13 7, 12 6Z"
                fill="#FFC107"
              />
            </svg>
          </div>
        )}
        <div>
          <span
            className="font-bold text-xl tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {systemName}
          </span>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            Farm Intelligence Platform
          </p>
        </div>
      </motion.div>

      {/* Illustration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative flex justify-center my-6"
      >
        <FarmIllustration />
      </motion.div>

      {/* Headline + description */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="relative"
      >
        <h1
          className="font-bold text-2xl leading-snug text-white mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Smart Poultry Farm Management Starts Here
        </h1>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          Monitor egg production, poultry inventory, feed consumption, flock
          health, expenses, reports, and analytics—all from one intelligent
          platform.
        </p>
      </motion.div>

      {/* Feature list */}
      <motion.ul
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative mt-6 flex flex-col gap-2.5"
        aria-label="Platform features"
      >
        {features.map(({ icon: Icon, label }) => (
          <motion.li
            key={label}
            variants={itemVariants}
            className="flex items-center gap-3"
          >
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <Icon size={13} color="rgba(255,255,255,0.9)" />
            </span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              {label}
            </span>
            <span
              className="ml-auto text-xs font-semibold"
              style={{ color: "#FFC107" }}
              aria-hidden="true"
            >
              ✔
            </span>
          </motion.li>
        ))}
      </motion.ul>

      {/* Footer note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="relative text-xs mt-6"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        © {new Date().getFullYear()} {systemName} · Trusted by farms worldwide
      </motion.p>
    </div>
  );
}
