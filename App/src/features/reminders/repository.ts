import { and, eq, isNull } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { db } from '@/db/client';
import { reminders } from '@/db/schema';
import { createId, nowIso } from '@/lib/id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function scheduleReminder(noteId: string, remindAt: Date, title: string) {
  const allowed = await ensureNotificationPermission();
  let notificationId: string | null = null;
  if (allowed) {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Noti reminder',
        body: title || 'Note reminder',
        data: { noteId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: remindAt,
      },
    });
  }

  const id = createId();
  const ts = nowIso();
  await db.insert(reminders).values({
    id,
    noteId,
    remindAt: remindAt.toISOString(),
    notificationId,
    done: false,
    createdAt: ts,
    updatedAt: ts,
    dirty: true,
  });
  return id;
}

export async function listReminders(noteId?: string) {
  if (noteId) {
    return db
      .select()
      .from(reminders)
      .where(and(eq(reminders.noteId, noteId), isNull(reminders.deletedAt)));
  }
  return db.select().from(reminders).where(isNull(reminders.deletedAt));
}

export async function completeReminder(id: string) {
  const [row] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  if (row?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(row.notificationId);
  }
  await db
    .update(reminders)
    .set({ done: true, updatedAt: nowIso(), dirty: true })
    .where(eq(reminders.id, id));
}
