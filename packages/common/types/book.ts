export type KoReaderBook = {
  id: number;
  md5: string;
  title: string;
  authors: string;
  notes: number;
  last_open: number;
  highlights: number;
  pages: number;
  series: string;
  language: string;
  // These fields only come from statistics.db sync, not annotation sync
  total_read_time?: number;
  total_read_pages?: number;
};

export type DbBook = {
  id: number;
  md5: string;
  title: string;
  authors: string;
  series: string;
  language: string;
};

/**
 * Whether the book is still being read or has been finished.
 * Derived from the reading statistics unless `Book['status_override']` is set.
 */
export type ReadingStatus = 'reading' | 'read';

export type Book = DbBook & {
  soft_deleted: boolean;
  reference_pages: number | null;
  /** Manually set status. `null` means the status is derived from the statistics. */
  status_override: ReadingStatus | null;
};
