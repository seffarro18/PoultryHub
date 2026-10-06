import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface SocialLoginProps {
  disabled?: boolean;
  /** True only while the Google redirect itself is being prepared — swaps the label to "Signing in…" and stops another click from firing a second redirect. */
  loading?: boolean;
  onGoogleClick?: () => void;
}

export default function SocialLogin({ disabled, loading, onGoogleClick }: SocialLoginProps) {
  const isDisabled = disabled || loading;
  return (
    <div className="flex flex-col gap-2.5">
      <motion.button
        type="button"
        aria-label="Continue with Google"
        disabled={isDisabled}
        onClick={onGoogleClick}
        whileHover={{ scale: isDisabled ? 1 : 1.01 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-background)] text-sm font-medium text-[var(--color-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={18} className="spinner" aria-hidden="true" /> : <GoogleIcon />}
        <span>{loading ? "Signing in…" : "Continue with Google"}</span>
      </motion.button>
    </div>
  );
}
