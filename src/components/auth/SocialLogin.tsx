import { motion } from "framer-motion";

interface SocialButtonProps {
  provider: "google" | "facebook";
  disabled?: boolean;
  onClick?: () => void;
}

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

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect width="18" height="18" rx="4" fill="#1877F2" />
      <path
        d="M12.5 9H10.5V15H8V9H6.5V6.5H8V5C8 3.619 8.881 2.5 10.5 2.5H12.5V5H11C10.724 5 10.5 5.224 10.5 5.5V6.5H12.5L12.5 9Z"
        fill="white"
      />
    </svg>
  );
}

function SocialButton({ provider, disabled, onClick }: SocialButtonProps) {
  const label =
    provider === "google" ? "Continue with Google" : "Continue with Facebook";

  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        border: "1.5px solid #E5E7EB",
        backgroundColor: "#ffffff",
        color: "#374151",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {provider === "google" ? <GoogleIcon /> : <FacebookIcon />}
      <span>{label}</span>
    </motion.button>
  );
}

interface SocialLoginProps {
  disabled?: boolean;
  onGoogleClick?: () => void;
  onFacebookClick?: () => void;
}

export default function SocialLogin({ disabled, onGoogleClick, onFacebookClick }: SocialLoginProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <SocialButton provider="google" disabled={disabled} onClick={onGoogleClick} />
      <SocialButton provider="facebook" disabled={disabled} onClick={onFacebookClick} />
    </div>
  );
}

