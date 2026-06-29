export interface MediaDraftInsert {
  content: string;
  caret: number;
}

export function appendMediaUrlToDraft(content: string, url: string): MediaDraftInsert {
  const trimmed = content.trimEnd();
  if (!trimmed) return { content: `\n\n${url}`, caret: 0 };
  return { content: `${trimmed}\n\n${url}`, caret: trimmed.length };
}
