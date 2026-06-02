import { insertTimelineItems, mergeTimelineItems, timelineCursor, uniqueFreshItems } from './window';

type Item = { id: string; created_at: number; value?: string };

function item(id: string, created_at: number, value = id): Item {
  return { id, created_at, value };
}

describe('timeline window helpers', () => {
  it('merges by id, lets incoming items update existing records, and sorts newest first', () => {
    expect(mergeTimelineItems([item('same', 20, 'new')], [item('same', 10, 'old'), item('other', 15)])).toEqual([
      item('same', 20, 'new'),
      item('other', 15)
    ]);
  });

  it('calculates newest and oldest cursors', () => {
    const items = [item('older', 10), item('newer', 30), item('middle', 20)];

    expect(timelineCursor(items, 'newest')).toBe(30);
    expect(timelineCursor(items, 'oldest')).toBe(10);
    expect(timelineCursor([], 'oldest')).toBeUndefined();
  });

  it('keeps the newest window when adding newer items', () => {
    const result = insertTimelineItems([item('old', 10), item('middle', 20)], [item('new', 30)], {
      direction: 'newer',
      limit: 2
    });

    expect(result.visible.map((entry) => entry.id)).toEqual(['new', 'middle']);
    expect(result.trimmed.map((entry) => entry.id)).toEqual(['old']);
  });

  it('keeps the oldest window when adding older items', () => {
    const result = insertTimelineItems([item('new', 30), item('middle', 20)], [item('old', 10)], {
      direction: 'older',
      limit: 2
    });

    expect(result.visible.map((entry) => entry.id)).toEqual(['middle', 'old']);
    expect(result.trimmed.map((entry) => entry.id)).toEqual(['new']);
  });

  it('filters out items that are already known', () => {
    expect(uniqueFreshItems([item('a', 10), item('b', 20)], [item('a', 10)]).map((entry) => entry.id)).toEqual(['b']);
  });
});
