import { Annotation } from './annotation';
import { Book, ReadingStatus } from './book';
import { BookDevice } from './book-device';
import { Genre } from './genre';
import { PageStat } from './page-stat';

type Stats = {
  last_open: number;
  total_read_time: number;
  total_pages: number;
  total_read_pages: number;
  unique_read_pages: number;
  /** Position the book is at: page of the most recent page_stat row, in reference pages. */
  current_page: number;
  /** Furthest page ever reached. Only used to decide whether the book is finished. */
  max_read_page: number;
  /** `current_page / total_pages`, rounded and clamped to 0..100. */
  read_percentage: number;
  status: ReadingStatus;
  notes: number;
  highlights: number;
  read_per_day: Record<string, number>;
  started_reading: number;
  highlights_count: number;
  notes_count: number;
  bookmarks_count: number;
  deleted_count: number;
};

type RelatedEntities = {
  stats: PageStat[];
  device_data: BookDevice[];
  genres: Genre[];
  annotations: Annotation[];
};

export type BookWithData = Book & Stats & RelatedEntities;
