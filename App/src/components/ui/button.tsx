import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  fullWidth,
  style,
  ...rest
}: Props) {
  const theme = useTheme();

  const palette = {
    primary: { bg: theme.primary, fg: theme.primaryForeground, border: theme.primary },
    secondary: { bg: theme.backgroundElement, fg: theme.text, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.primary, border: 'transparent' },
    danger: { bg: 'transparent', fg: theme.danger, border: theme.danger },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
        fullWidth && styles.full,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  full: { alignSelf: 'stretch' },
  label: { ...Typography.callout },
});
