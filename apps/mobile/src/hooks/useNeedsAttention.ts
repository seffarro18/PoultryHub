import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@poultryhub/shared/context/AuthContext";
import {
  dismissAttentionItem,
  listAttentionState,
  listFarmAdminAttentionItems,
  listStaffAttentionItems,
  markAttentionItemRead,
} from "@poultryhub/shared/services/attentionService";
import type { AttentionItem } from "@poultryhub/shared/types/attention";

interface UseNeedsAttentionReturn {
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (item: AttentionItem) => Promise<void>;
  dismiss: (item: AttentionItem) => Promise<void>;
  dismissingId: string | null;
}

/** Role-branches the same way every other split screen in this app already does (Staff gets their own personal task list; Farm Admin/Manager get the farm's issue queue, Manager minus staff-management since they have no staff access). */
export function useNeedsAttention(): UseNeedsAttentionReturn {
  const { user } = useAuth();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [rawItems, state] = await Promise.all([
        user.role === "Staff" ? listStaffAttentionItems(user.id) : listFarmAdminAttentionItems(user.role === "Farm Admin"),
        listAttentionState(),
      ]);
      const overlayByKey = new Map(state.map((s) => [`${s.module}:${s.referenceId}`, s]));
      setItems(
        rawItems.map((item) => {
          const overlay = overlayByKey.get(item.id);
          return overlay ? { ...item, isRead: overlay.isRead, dismissed: overlay.dismissed } : item;
        })
      );
    } catch (err) {
      console.error("[useNeedsAttention] failed to load:", err);
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
