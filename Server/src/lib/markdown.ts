export function extractTags(text: string): string[] {
  const matches = text.match(/(^|\s)#([a-zA-Z0-9_/-]+)/g) ?? [];
  return [
    ...new Set(
      matches
        .map((m) => m.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function extractWikiLinks(text: string): string[] {
  return [...text.matchAll(/\[\[([^\]]+)\]\]/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
}

export type ChecklistItem = {
  text: string;
  checked: boolean;
  lineIndex: number;
  raw: string;
};

export function extractChecklists(text: string): ChecklistItem[] {
  return text.split('\n').flatMap((line, lineIndex) => {
    const match = line.match(/^(\s*[-*]\s+)\[([ xX])\]\s+(.*)$/);
    if (!match) return [];
    return [
      {
        text: match[3],
        checked: match[2].toLowerCase() === 'x',
        lineIndex,
        raw: line,
      },
    ];
  });
}

export function toggleChecklistLine(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  const line = lines[lineIndex];
  if (!line) return body;
  if (/\[[ ]\]/.test(line)) {
    lines[lineIndex] = line.replace('[ ]', '[x]');
  } else if (/\[[xX]\]/.test(line)) {
    lines[lineIndex] = line.replace(/\[[xX]\]/, '[ ]');
  }
  return lines.join('\n');
}

export function checklistProgress(items: ChecklistItem[]) {
  if (!items.length) return { total: 0, done: 0, ratio: 0 };
  const done = items.filter((i) => i.checked).length;
  return { total: items.length, done, ratio: done / items.length };
}

export function firstLineTitle(body: string, fallback = 'Untitled') {
  const line = body
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  return line?.slice(0, 120) || fallback;
}
