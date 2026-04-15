"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Recent";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }
  return date.toLocaleString();
};

export default function NotificationsPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async (nextPage = page) => {
    setLoading(true);
    try {
      const payload = await fetchNotifications({
        page: nextPage,
        pageSize: 12,
      });
      setItems(payload.items || []);
      setPage(payload.pagination.page);
      setTotalPages(payload.pagination.totalPages);
      setUnreadCount(payload.unreadCount || 0);
    } catch {
      submitToast("Notifications unavailable", "Unable to load notifications right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    loadNotifications(1);
  }, [status]);

  const onMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      await loadNotifications(page);
    } catch {
      submitToast("Action failed", "Unable to mark notification as read.");
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await loadNotifications(page);
      submitToast("Updated", "All notifications marked as read.");
    } catch {
      submitToast("Action failed", "Unable to mark all notifications as read.");
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Notifications"
        title="Security, wallet, KYC, and trading alerts"
        description="Review account activity and operational alerts in one secure notification center."
        badge={`${unreadCount} unread`}
      />
      <ContentSection>
        <ProtectedRoute>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold text-white">Notification center</p>
              <Button type="button" variant="secondary" onClick={onMarkAllRead} disabled={loading || unreadCount === 0}>
                Mark all read
              </Button>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-muted">Loading notifications...</p>
            ) : !items.length ? (
              <p className="mt-4 text-sm text-muted">No notifications available.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-white">{item.title}</p>
                      <span className="text-xs uppercase tracking-[0.12em] text-muted">
                        {item.severity} {item.readAt ? "read" : "unread"}
                      </span>
                    </div>
                    <p className="mt-2 text-muted">{item.message}</p>
                    <p className="mt-2 text-xs text-muted">{formatDateTime(item.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {!item.readAt ? (
                        <Button type="button" variant="ghost" onClick={() => onMarkRead(item.id)}>
                          Mark as read
                        </Button>
                      ) : null}
                      {item.actionUrl ? (
                        <Link href={item.actionUrl}>
                          <Button type="button" variant="secondary">
                            Open
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <p>Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={page <= 1 || loading} onClick={() => loadNotifications(Math.max(1, page - 1))}>
                  Previous
                </Button>
                <Button type="button" variant="secondary" disabled={page >= totalPages || loading} onClick={() => loadNotifications(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}

