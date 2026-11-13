import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField(
  { label, error, style, multiline, ...rest },
  ref,
) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.primary}
        accessibilityLabel={label ?? rest.placeholder}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.card,
            borderColor: error ? theme.danger : theme.border,
          },
          multiline && styles.multiline,
          style,
        ]}
        {...rest}
      />
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  label: { ...Typography.label, textTransform: 'uppercase' },
  input: {
    minHeight: TouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontFamily: Fonts.sans,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: Spacing.three },
  error: { ...Typography.caption },
});
