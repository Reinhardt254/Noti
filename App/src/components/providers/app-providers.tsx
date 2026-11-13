import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { db, ensureFts } from '@/db/client';
import { seedTemplates } from '@/features/notes/repository';
import { useColorScheme } from '@/hooks/use-color-scheme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
import migrations from '../../../drizzle/migrations';

SplashScreen.preventAutoHideAsync().catch(() => {});

function DatabaseGate({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const { success, error } = useMigrations(db, migrations);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      try {
        ensureFts();
        await seedTemplates();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success]);

  const failure = error?.message ?? bootError;

  useEffect(() => {
    if (ready || failure) SplashScreen.hideAsync().catch(() => {});
  }, [ready, failure]);

  if (failure) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.danger }]}>Database error</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{failure}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <DatabaseGate>{children}</DatabaseGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.two,
  },
  title: { ...Typography.subtitle },
  body: { ...Typography.caption, textAlign: 'center' },
});
