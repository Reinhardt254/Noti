import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getOrCreateDailyNote } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

export default function DailyScreen() {
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    getOrCreateDailyNote()
      .then((note) => {
        if (!cancelled) router.replace({ pathname: '/note/[id]', params: { id: note.id } });
      })
      .catch(() => {
        if (!cancelled) router.back();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
