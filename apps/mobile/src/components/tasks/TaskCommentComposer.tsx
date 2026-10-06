import { useState } from "react";
import { Loader2, Send } from "lucide-react";

interface TaskCommentComposerProps {
  onSend: (comment: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/** Plain reply box — used by both roles for ordinary back-and-forth on a task (see taskService.addTaskComment). */
export default function TaskCommentComposer({ onSend, disabled = false, placeholder = "Write a reply…" }: TaskCommentComposerProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-[var(--color-border)] pt-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        rows={1}
        disabled={disabled || sending}
        placeholder={placeholder}
        className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)] disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={disabled || sending || !value.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-50"
        aria-label="Send comment"
      >
        {sending ? <Loader2 size={15} className="spinner" /> : <Send size={15} />}
      </button>
    </div>
  );
}
