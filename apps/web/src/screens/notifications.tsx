import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Button,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  toast,
} from '@promaly/ui';
import { Bell, BellOff } from 'lucide-react';
import type { Notification } from '../issues/data.js';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from '../issues/data.js';

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function notificationTitle(n: Notification): string {
  const d = n.data as Record<string, unknown>;
  const issueRef = d.issueTitle ? `"${String(d.issueTitle)}"` : 'an issue';
  switch (n.type) {
    case 'notification.fanout':
    case 'comment':
      return `New comment on ${issueRef}`;
    case 'assignment':
      return `You were assigned to ${issueRef}`;
    case 'mention':
      return `You were mentioned in ${issueRef}`;
    default:
      return `Update on ${issueRef}`;
  }
}

function NotificationRow({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead();
  const unread = !notification.readAt;

  return (
    <div
      className={`flex items-start gap-3 rounded-md px-3 py-3 ${
        unread ? 'bg-primary/5' : ''
      } hover:bg-secondary/50`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {unread ? (
          <span className="block size-2 rounded-full bg-primary" />
        ) : (
          <span className="block size-2 rounded-full bg-transparent" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">{notificationTitle(notification)}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {notification.issueId && (
            <Link
              to="/issues/$issueId"
              params={{ issueId: notification.issueId }}
              className="text-[12px] text-primary hover:underline"
            >
              View issue
            </Link>
          )}
          <span className="text-[12px] text-faint">{relativeTime(notification.createdAt)}</span>
        </div>
      </div>
      {unread && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[12px] text-faint hover:text-foreground"
          disabled={markRead.isPending}
          onClick={() =>
            markRead.mutate(notification.id, {
              onError: () => toast('Could not mark as read.'),
            })
          }
        >
          Mark read
        </Button>
      )}
    </div>
  );
}

export function NotificationsScreen() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data: notifications, isPending } = useNotifications(
    filter === 'unread' ? 'unread' : 'all',
  );
  const markAll = useMarkAllRead();

  const hasUnread = notifications?.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-[720px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold">Notifications</h1>
        <div className="flex items-center gap-3">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as 'all' | 'unread')}
          >
            <SelectTrigger className="h-7 w-28 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
            </SelectContent>
          </Select>
          {hasUnread && (
            <Button
              variant="secondary"
              size="sm"
              disabled={markAll.isPending}
              onClick={() =>
                markAll.mutate(undefined, {
                  onSuccess: () => toast('All notifications marked as read.'),
                  onError: () => toast('Could not mark all as read.'),
                })
              }
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState
          icon={filter === 'unread' ? <BellOff /> : <Bell />}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? "You're all caught up."
              : 'You will see updates about your issues here.'
          }
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
