import { router } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommandPalette } from '@/components/command-palette';
import { useTheme } from '@/hooks/use-theme';

export default function PaletteScreen() {
  const theme = useTheme();
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, []);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      <CommandPalette onClose={close} />
    </SafeAreaView>
  );
}
