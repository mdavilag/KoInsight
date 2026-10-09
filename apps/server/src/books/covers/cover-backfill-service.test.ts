import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBook } from '../../db/factories/book-factory';
import { db } from '../../knex';
import {
  OpenLibraryService,
  OpenLibraryUnavailableError,
} from '../../open-library/open-library-service';
import { BooksRepository } from '../books-repository';
import { CoverBackfillService } from './cover-backfill-service';

// Large enough to clear the placeholder size check.
const REAL_COVER = new ArrayBuffer(4096);

const koReaderBook = (md5: string) => ({ md5 }) as any;

describe('CoverBackfillService', () => {
  let saveCover: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Keep every run off the filesystem; nothing is on disk, so all books are candidates.
    vi.spyOn(CoverBackfillService as any, 'hasCover').mockResolvedValue(false);
    saveCover = vi.spyOn(CoverBackfillService as any, 'saveCover').mockImplementation(() => {});
  });

  it('saves a cover for a book that has never been looked up', async () => {
    const book = await createBook(db, { title: 'Admirável mundo novo', authors: 'Aldous Huxley' });

    const find = vi.spyOn(OpenLibraryService, 'findFirstCoverId').mockResolvedValue(123);
    const fetchCover = vi.spyOn(OpenLibraryService, 'fetchCover').mockResolvedValue(REAL_COVER);

    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    expect(find).toHaveBeenCalledWith('Admirável mundo novo Aldous Huxley');
    expect(fetchCover).toHaveBeenCalledWith('123', 'L');
    expect(saveCover).toHaveBeenCalledWith(book.md5, REAL_COVER);
  });

  it('discards the Open Library placeholder instead of saving it', async () => {
    const book = await createBook(db);

    vi.spyOn(OpenLibraryService, 'findFirstCoverId').mockResolvedValue(123);
    vi.spyOn(OpenLibraryService, 'fetchCover').mockResolvedValue(new ArrayBuffer(64));

    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    expect(saveCover).not.toHaveBeenCalled();
  });

  it('marks the book as attempted so the next sync does not query again', async () => {
    const book = await createBook(db);

    const find = vi.spyOn(OpenLibraryService, 'findFirstCoverId').mockResolvedValue(null);

    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    expect(find).toHaveBeenCalledOnce();

    const updated = await BooksRepository.getById(book.id);
    expect(updated!.cover_fetch_attempted_at).toBeTypeOf('number');

    find.mockClear();
    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    expect(find).not.toHaveBeenCalled();
  });

  it('marks the book as attempted even when Open Library throws', async () => {
    const book = await createBook(db);

    vi.spyOn(OpenLibraryService, 'findFirstCoverId').mockRejectedValue(new Error('network down'));

    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    const updated = await BooksRepository.getById(book.id);
    expect(updated!.cover_fetch_attempted_at).toBeTypeOf('number');
  });

  it('leaves books eligible and stops the run when Open Library is unreachable', async () => {
    const first = await createBook(db);
    const second = await createBook(db);

    const find = vi
      .spyOn(OpenLibraryService, 'findFirstCoverId')
      .mockRejectedValue(
        new OpenLibraryUnavailableError('https://openlibrary.org/search.json', new Error('timeout'))
      );

    await CoverBackfillService.backfillMissing([
      koReaderBook(first.md5),
      koReaderBook(second.md5),
    ]);

    expect(find).toHaveBeenCalledOnce();
    expect((await BooksRepository.getById(first.id))!.cover_fetch_attempted_at).toBeNull();
    expect((await BooksRepository.getById(second.id))!.cover_fetch_attempted_at).toBeNull();
  });

  it('never overwrites a cover that is already on disk', async () => {
    const book = await createBook(db);

    vi.spyOn(CoverBackfillService as any, 'hasCover').mockResolvedValue(true);
    const find = vi.spyOn(OpenLibraryService, 'findFirstCoverId');

    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    expect(find).not.toHaveBeenCalled();
    expect(saveCover).not.toHaveBeenCalled();

    const updated = await BooksRepository.getById(book.id);
    expect(updated!.cover_fetch_attempted_at).toBeTypeOf('number');
  });

  it('ignores soft-deleted books', async () => {
    const book = await createBook(db, { soft_deleted: true });

    const find = vi.spyOn(OpenLibraryService, 'findFirstCoverId');

    await CoverBackfillService.backfillMissing([koReaderBook(book.md5)]);

    expect(find).not.toHaveBeenCalled();
  });
});
