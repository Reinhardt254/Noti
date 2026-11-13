import { apiFetch, apiStream } from '@/lib/api';

export async function summarizeNote(noteId: string) {
  return apiFetch<{ summary: string; noteId: string }>(
    `/ai/summarize/${noteId}`,
    { method: 'POST' },
  );
}

export async function suggestTags(noteId: string) {
  return apiFetch<{ tags: string[]; existing: string[] }>(
    `/ai/suggest-tags/${noteId}`,
    { method: 'POST' },
  );
}

export async function askNotes(
  question: string,
  onEvent: (event: { type: string; token?: string; sources?: Array<{ id: string; title: string }> }) => void,
) {
  await apiStream(
    '/ai/ask',
    {
      method: 'POST',
      body: JSON.stringify({ question }),
    },
    (line) => {
      try {
        const parsed = JSON.parse(line);
        onEvent(parsed);
      } catch {
        // ignore non-json keepalive
      }
    },
  );
}

export async function clipUrl(url: string) {
  return apiFetch<{ id: string; title: string }>('/clipper', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
