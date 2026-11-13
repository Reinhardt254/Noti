import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { countDirty, getSyncCursor, runSync } from '@/features/sync/engine';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

type Props = {
  /** Compact pill for headers; otherwise a full row. */
  compact?: boolean;
  refreshKey?: number;
  onSynced?: () => void;
};

export function SyncStatus({ compact, refreshKey, onSynced }: Props) {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const [dirty, setDirty] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDirty(await countDirty());
      const cursor = await getSyncCursor();
      setLastSynced(cursor?.lastSyncedAt ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  async function sync() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    const result = await runSync();
    if (!result.ok) setError(result.message);
    await refresh();
    setBusy(false);
    if (result.ok) onSynced?.();
  }

  const signedIn = !!session;
  const color = error ? theme.danger : !signedIn ? theme.textMuted : dirty > 0 ? theme.warning : theme.success;
  const label = busy
    ? 'Syncing…'
    : error
      ? 'Sync failed'
      : !signedIn
        ? 'Local only'
        : dirty > 0
          ? `${dirty} pending`
          : 'Synced';

  if (compact) {
    return (
      <Pressable
        onPress={sync}
        disabled={!signedIn || busy}
        accessibilityRole="button"
        accessibilityLabel={`Sync status: ${label}`}
        hitSlop={8}
        style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
        <Text style={[styles.pillText, { color: theme.textSecondary }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.full}>
      <View style={styles.fullHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.fullLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {signedIn ? session?.user?.email : 'Sign in to sync across devices'}
        {lastSynced ? ` · Last sync ${new Date(lastSynced).toLocaleString()}` : ''}
      </Text>
      {error ? <Text style={[styles.meta, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
  },
  pillText: { ...Typography.label, textTransform: 'none' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  full: { gap: Spacing.one, minHeight: TouchTarget },
  fullHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  fullLabel: { ...Typography.subtitle },
  meta: { ...Typography.caption },
});
