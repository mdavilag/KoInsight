import { BookWithData, PageStat } from '@koinsight/common/types';
import { normalizeRanges } from '@koinsight/common/utils/ranges';

export type Range = [number, number];

export function getReferencePageRanges(book: BookWithData, stats: PageStat[]): Range[] {
  const ranges: Range[] = [];

  stats.forEach((stat) => {
    if (book.reference_pages) {
      const startRefPage =
        (Math.max(stat.page - 1, 0) * book.reference_pages) / stat.total_pages + 1;
      const endRefPage = (stat.page * book.reference_pages) / stat.total_pages;
      ranges.push([startRefPage, endRefPage]);
    } else {
      ranges.push([Math.max(stat.page - 1, 0), stat.page]);
    }
  });

  return normalizeRanges(ranges);
}

export function getReferencePageRange(book: BookWithData, stats: PageStat[]): Range {
  const ranges = getReferencePageRanges(book, stats);
  const start = Math.min(...ranges.map(([start]) => start));
  const end = Math.max(...ranges.map(([, end]) => end));

  return [start, end];
}
