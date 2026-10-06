import { AlertCircle, RotateCcw } from "lucide-react";
import Button from "./Button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** A load failure, with a real way to recover — never just a dead end. Friendly wording is the caller's job (pass a message like "Couldn't load records.", not a raw error/status code). */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        <AlertCircle size={26} strokeWidth={1.75} />
      </div>
      <p className="max-w-sm text-sm text-[var(--color-foreground)]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RotateCcw} onClick={onRetry} className="mt-1">
          Retry
        </Button>
      )}
    </div>
  );
}
