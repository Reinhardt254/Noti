import { Injectable } from '@nestjs/common';
import { NotesService } from '../notes/notes.service';

@Injectable()
export class ExportService {
  constructor(private readonly notes: NotesService) {}

  async toJson(userId: string) {
    const items = await this.notes.list(userId, { archived: false });
    const archived = await this.notes.list(userId, { archived: true });
    return {
      exportedAt: new Date().toISOString(),
      notes: [...items, ...archived],
    };
  }

  async toMarkdownBundle(userId: string) {
    const active = await this.notes.list(userId, { archived: false });
    const archived = await this.notes.list(userId, { archived: true });
    const all = [...active, ...archived];
    return all.map((note) => ({
      filename: `${sanitize(note.title || 'untitled')}-${note.id.slice(0, 8)}.md`,
      content: `# ${note.title || 'Untitled'}\n\n${note.body}`,
    }));
  }
}

function sanitize(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 80) || 'untitled';
}
