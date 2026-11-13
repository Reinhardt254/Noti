import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { Button } from '@/components/ui/button';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { prepareRecording, recordingMarkdown } from '@/features/voice/recorder';

type Props = {
  onRecorded: (markdownSnippet: string) => void;
};

export function VoiceRecorder({ onRecorded }: Props) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    try {
      setError(null);
      await prepareRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording');
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) onRecorded(recordingMarkdown(uri));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop recording');
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[Typography.caption, { color: theme.textSecondary }]}>
        Voice note (transcription later)
      </Text>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {state.isRecording ? (
        <Button label="Stop recording" variant="danger" onPress={stop} />
      ) : (
        <Button label="Record voice" variant="secondary" onPress={start} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
