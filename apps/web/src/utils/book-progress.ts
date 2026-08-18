import { BookWithData, PageStat } from '@koinsight/common/types';
import { normalizeRanges } from '@koinsight/common/utils/ranges';

export type Range = [number, number];

/**
 * Ranges are half-open — `[(page - 1) * scale, page * scale]` — so that summing their
 * lengths yields the number of pages covered. Mirrors `BooksService.getUniqueReadPages`
 * on the server; keep the two in step.
 *
 * Use {@link describeReferencePageRange} to turn one into page numbers for display.
 */
export function getReferencePageRanges(book: BookWithData, stats: PageStat[]): Range[] {
  const ranges: Range[] = [];

  stats.forEach((stat) => {
    if (book.reference_pages) {
      const startRefPage = (Math.max(stat.page - 1, 0) * book.reference_pages) / stat.total_pages;
      const endRefPage = (stat.page * book.reference_pages) / stat.total_pages;
      ranges.push([startRefPage, endRefPage]);
    } else {
      ranges.push([Math.max(stat.page - 1, 0), stat.page]);
    }
  });

  return normalizeRanges(ranges);
}

/**
 * Converts a half-open range into the inclusive page numbers a reader recognises:
 * the range covering pages 10 through 20 is `[9, 20]`, and reads as "10 – 20, 11 pages".
 */
export function describeReferencePageRange(range: Range): {
  from: number;
  to: number;
  count: number;
} {
  const [start, end] = range;

  return {
    from: Math.floor(start) + 1,
    to: Math.ceil(end),
    // Any recorded reading covers at least one page, however short the scaled range.
    count: Math.max(1, Math.round(end - start)),
  };
}

export function getReferencePageRange(book: BookWithData, stats: PageStat[]): Range {
  const ranges = getReferencePageRanges(book, stats);
  const start = Math.min(...ranges.map(([start]) => start));
  const end = Math.max(...ranges.map(([, end]) => end));

  return [start, end];
}
