import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { NotesService } from '../notes/notes.service';

@Injectable()
export class AiService {
  private readonly client: OpenAI | null;

  constructor(private readonly notes: NotesService) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    this.client = apiKey
      ? new OpenAI({
          apiKey,
          baseURL: 'https://api.deepseek.com',
        })
      : null;
  }

  private requireClient() {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'DEEPSEEK_API_KEY is not configured',
      );
    }
    return this.client;
  }

  async summarize(userId: string, noteId: string) {
    const note = await this.notes.get(userId, noteId);
    if (note.encrypted) {
      throw new ServiceUnavailableException('Encrypted notes cannot be sent to AI');
    }
    const client = this.requireClient();
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Summarize the note in clear markdown bullet points. Keep it concise.',
        },
        {
          role: 'user',
          content: `# ${note.title}\n\n${note.body}`,
        },
      ],
      stream: false,
    });
    return {
      summary: completion.choices[0]?.message?.content ?? '',
      noteId,
    };
  }

  async *summarizeStream(userId: string, noteId: string) {
    const note = await this.notes.get(userId, noteId);
    if (note.encrypted) {
      throw new ServiceUnavailableException('Encrypted notes cannot be sent to AI');
    }
    const client = this.requireClient();
    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Summarize the note in clear markdown bullet points. Keep it concise.',
        },
        {
          role: 'user',
          content: `# ${note.title}\n\n${note.body}`,
        },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async suggestTags(userId: string, noteId: string) {
    const note = await this.notes.get(userId, noteId);
    if (note.encrypted) {
      throw new ServiceUnavailableException('Encrypted notes cannot be sent to AI');
    }
    const existing = await this.notes.listTags(userId);
    const client = this.requireClient();
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Suggest up to 5 short lowercase tags for a note. Prefer existing tags when relevant. Return JSON: {"tags":["tag1","tag2"]}. Existing tags: ${existing.map((t) => t.name).join(', ') || '(none)'}`,
        },
        {
          role: 'user',
          content: `# ${note.title}\n\n${note.body}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{"tags":[]}';
    try {
      const parsed = JSON.parse(raw) as { tags?: string[] };
      return {
        tags: (parsed.tags ?? [])
          .map((t) => t.toLowerCase().replace(/^#/, '').trim())
          .filter(Boolean)
          .slice(0, 5),
        existing: existing.map((t) => t.name),
      };
    } catch {
      return { tags: [], existing: existing.map((t) => t.name) };
    }
  }

  async *askStream(userId: string, question: string) {
    const matches = await this.notes.search(userId, question, false, 8);
    const context = matches
      .map(
        (n, i) =>
          `[${i + 1}] id=${n.id} title=${n.title}\n${n.body.slice(0, 2000)}`,
      )
      .join('\n\n---\n\n');

    const client = this.requireClient();
    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'Answer using only the provided notes. Cite note ids like [id:UUID]. If the notes do not contain the answer, say so.',
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nNotes:\n${context || '(no matching notes)'}`,
        },
      ],
    });

    yield JSON.stringify({
      type: 'sources',
      sources: matches.map((n) => ({ id: n.id, title: n.title })),
    }) + '\n';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield JSON.stringify({ type: 'token', token: delta }) + '\n';
      }
    }
  }
}
