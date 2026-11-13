import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

export default function SignUpScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signUp.email({
        name: name.trim() || email.trim().split('@')[0],
        email: email.trim(),
        password,
      });
      if (res.error) {
        setError(res.error.message ?? 'Sign up failed');
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>Create account</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Your existing local notes will sync after you sign in.
          </Text>
          <View style={styles.form}>
            <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              placeholder="At least 8 characters"
              onSubmitEditing={submit}
              error={error}
            />
            <Button label="Create account" onPress={submit} loading={loading} fullWidth />
            <Button label="Continue offline" variant="ghost" onPress={() => router.back()} fullWidth />
          </View>
          <Text style={[styles.footer, { color: theme.textSecondary }]}>
            Already have an account?{' '}
            <Link href="/sign-in" replace style={{ color: theme.primary }}>
              Sign in
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.five, gap: Spacing.three },
  title: { ...Typography.display },
  sub: { ...Typography.body },
  form: { gap: Spacing.three, marginTop: Spacing.three },
  footer: { ...Typography.body, textAlign: 'center', marginTop: Spacing.four },
});
