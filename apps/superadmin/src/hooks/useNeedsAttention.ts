import { useCallback, useEffect, useState } from "react";
import {
  dismissAttentionItem,
  listAttentionState,
  listSuperAdminAttentionItems,
  markAttentionItemRead,
} from "@poultryhub/shared/services/attentionService";
import type { AttentionItem } from "@poultryhub/shared/types/attention";
import { getErrorMessage } from "@poultryhub/shared/lib/errorMessage";

interface UseNeedsAttentionReturn {
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (item: AttentionItem) => Promise<void>;
  dismiss: (item: AttentionItem) => Promise<void>;
  dismissingId: string | null;
}

/** Platform-wide version of mobile's useNeedsAttention — no role branching needed since this app is Super Admin only. */
export function useNeedsAttention(): UseNeedsAttentionReturn {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rawItems, state] = await Promise.all([listSuperAdminAttentionItems(), listAttentionState()]);
      const overlayByKey = new Map(state.map((s) => [`${s.module}:${s.referenceId}`, s]));
      setItems(
        rawItems.map((item) => {
          const overlay = overlayByKey.get(item.id);
          return overlay ? { ...item, isRead: overlay.isRead, dismissed: overlay.dismissed } : item;
        })
      );
    } catch (err) {
      console.error("[useNeedsAttention] failed to load:", err);
      setError(getErrorMessage(err, "Failed to load."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(async (item: AttentionItem) => {
    if (item.isRead) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)));
    try {
      await markAttentionItemRead(item.module, item.referenceId);
    } catch (err) {
      console.error("[useNeedsAttention] failed to mark read:", err);
    }
  }, []);

  const dismiss = useCallback(async (item: AttentionItem) => {
    setDismissingId(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, dismissed: true, isRead: true } : i)));
    try {
      await dismissAttentionItem(item.module, item.referenceId);
    } catch (err) {
      console.error("[useNeedsAttention] failed to dismiss:", err);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, dismissed: false } : i)));
    } finally {
      setDismissingId(null);
    }
  }, []);

  return { items, isLoading, error, refresh, markRead, dismiss, dismissingId };
}
