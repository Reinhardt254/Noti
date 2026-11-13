import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

/**
 * Voice notes: recording is supported via expo-audio.
 * Transcription is deferred — DeepSeek has no speech-to-text API.
 * Attach the recording URI to a note body as a markdown link for now.
 */
export { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState };

export async function prepareRecording() {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission denied');
  }
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
}

export function recordingMarkdown(uri: string) {
  return `\n\n🎙️ [Voice note](${uri})\n\n_Transcription deferred — add a speech-to-text provider later._\n`;
}
