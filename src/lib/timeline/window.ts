export interface TimelineItem {
  id: string;
  created_at: number;
}

export type TimelineDirection = 'newer' | 'older';
export type TimelineTrimEdge = 'top' | 'bottom';

export function mergeTimelineItems<T extends TimelineItem>(incoming: T[], existing: T[]) {
  const byId = new Map<string, T>();
  [...existing, ...incoming].forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
}

export function timelineCursor<T extends TimelineItem>(items: T[], edge: 'newest' | 'oldest') {
  if (!items.length) return undefined;
  const timestamps = items.map((item) => item.created_at);
  return edge === 'newest' ? Math.max(...timestamps) : Math.min(...timestamps);
}

export function uniqueFreshItems<T extends TimelineItem>(incoming: T[], known: T[]) {
  const knownIds = new Set(known.map((item) => item.id));
  return incoming.filter((item) => !knownIds.has(item.id));
}

export function windowTimelineItems<T extends TimelineItem>(
  items: T[],
  limit: number,
  trimEdge: TimelineTrimEdge,
  trim?: (items: T[], limit: number, edge: TimelineTrimEdge) => T[]
) {
  if (items.length <= limit) return { visible: items, trimmed: [] };
  const visible = trim ? trim(items, limit, trimEdge) : defaultTrimTimelineItems(items, limit, trimEdge);
  const visibleIds = new Set(visible.map((item) => item.id));
  return {
    visible,
    trimmed: items.filter((item) => !visibleIds.has(item.id))
  };
}

export function insertTimelineItems<T extends TimelineItem>(
  existing: T[],
  incoming: T[],
  options: {
    direction: TimelineDirection;
    limit: number;
    merge?: (incoming: T[], existing: T[]) => T[];
    trim?: (items: T[], limit: number, edge: TimelineTrimEdge) => T[];
  }
) {
  const merge = options.merge ?? mergeTimelineItems;
  const merged = merge(incoming, existing);
  const trimEdge: TimelineTrimEdge = options.direction === 'newer' ? 'bottom' : 'top';
  return windowTimelineItems(merged, options.limit, trimEdge, options.trim);
}

function defaultTrimTimelineItems<T extends TimelineItem>(items: T[], limit: number, trimEdge: TimelineTrimEdge) {
  return trimEdge === 'bottom' ? items.slice(0, limit) : items.slice(-limit);
}
