import { Injectable } from '@nestjs/common';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { NotesService } from '../notes/notes.service';

@Injectable()
export class ClipperService {
  private readonly turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  constructor(private readonly notes: NotesService) {}

  async clip(userId: string, url: string) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NotiClipper/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status})`);
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const title = article?.title || url;
    const body = article?.content
      ? this.turndown.turndown(article.content)
      : html;
    const note = await this.notes.create(userId, {
      title,
      body: `${body}\n\n---\nSource: ${url}`,
    });
    return note;
  }
}
