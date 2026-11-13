import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/components/providers/app-providers';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Root works fully offline. Auth screens are only reached from Settings
 * (sign in / sign up to enable sync) — there is no forced redirect.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <AppProviders>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="note/[id]" />
        <Stack.Screen name="(auth)/sign-in" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(auth)/sign-up" options={{ presentation: 'modal' }} />
        <Stack.Screen name="daily" options={{ animation: 'fade' }} />
        <Stack.Screen name="palette" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="history/[id]" />
      </Stack>
    </AppProviders>
  );
}
