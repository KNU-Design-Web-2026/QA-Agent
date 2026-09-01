/** Counts only notifications that can be rendered in the notification list. */
export function getUnreadVisibleNotificationCount<
  T extends { read_at: string | null },
>(
  notifications: Array<T | null>,
) {
  return notifications.filter(
    (notification) => notification && !notification.read_at,
  ).length;
}
