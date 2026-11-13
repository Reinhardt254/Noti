import {
  checklistProgress,
  extractChecklists,
  extractTags,
  extractWikiLinks,
  firstLineTitle,
  toggleChecklistLine,
} from './markdown';

describe('markdown helpers', () => {
  it('extracts tags', () => {
    expect(extractTags('Hello #work and #Home/Office')).toEqual([
      'work',
      'home/office',
    ]);
  });

  it('extracts wiki links', () => {
    expect(extractWikiLinks('See [[Project Alpha]] and [[Inbox]]')).toEqual([
      'Project Alpha',
      'Inbox',
    ]);
  });

  it('parses checklists and toggles lines', () => {
    const body = '- [ ] one\n- [x] two\nplain';
    const items = extractChecklists(body);
    expect(items).toHaveLength(2);
    expect(checklistProgress(items)).toEqual({ total: 2, done: 1, ratio: 0.5 });
    expect(toggleChecklistLine(body, 0)).toContain('- [x] one');
    expect(toggleChecklistLine(body, 1)).toContain('- [ ] two');
  });

  it('derives a title from the first heading/line', () => {
    expect(firstLineTitle('# Hello\n\nworld')).toBe('Hello');
    expect(firstLineTitle('')).toBe('Untitled');
  });
});
