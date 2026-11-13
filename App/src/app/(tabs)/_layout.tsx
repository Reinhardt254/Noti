import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

function glyph(char: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{char}</Text>;
  };
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Notes', tabBarIcon: glyph('☰') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: glyph('☑') }} />
      <Tabs.Screen name="graph" options={{ title: 'Graph', tabBarIcon: glyph('◎') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: glyph('⚙') }} />
    </Tabs>
  );
}
