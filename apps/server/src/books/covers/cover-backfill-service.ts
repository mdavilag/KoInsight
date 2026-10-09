import { Book, KoReaderBook } from '@koinsight/common/types';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { appConfig } from '../../config';
import {
  OpenLibraryService,
  OpenLibraryUnavailableError,
} from '../../open-library/open-library-service';
import { BooksRepository } from '../books-repository';
import { CoversService } from './covers-service';

/**
 * Fills in book covers from Open Library without the user having to pick one per book.
 *
 * Runs after an import, off the request path: the KOReader plugin is holding a socket open
 * waiting for the import response, and Open Library is slow enough that blocking on it would
 * push the plugin towards its own timeout.
 */
export class CoverBackfillService {
  /** Open Library asks for gentle use, and an unattended sweep is exactly what it means. */
  private static readonly MAX_PER_RUN = 10;
  private static readonly DELAY_BETWEEN_LOOKUPS_MS = 1000;

  /** Open Library answers a missing cover with a tiny placeholder rather than a 404. */
  private static readonly MIN_COVER_BYTES = 1024;

  /** A sync can arrive while the previous sweep is still going; one at a time is plenty. */
  private static running = false;

  /**
   * Look up covers for books in this payload that have never been looked up before.
   * Never throws: the caller is fire-and-forget and an import must not fail over a cover.
   */
  static async backfillMissing(books: KoReaderBook[]): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const md5s = [...new Set(books.map((book) => book.md5).filter(Boolean))];
      const candidates = await BooksRepository.getCoverBackfillCandidates(md5s);

      let processed = 0;

      for (const book of candidates) {
        if (processed >= this.MAX_PER_RUN) {
          console.debug(
            `[covers] Reached the per-run cap; ${candidates.length - processed} book(s) left for the next sync`
          );
          break;
        }

        // A cover uploaded by hand, or fetched before this column existed, wins over anything
        // Open Library would guess. Mark it so we never reconsider this book.
        if (await this.hasCover(book)) {
          await BooksRepository.markCoverFetchAttempted(book.id);
          continue;
        }

        if (processed > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.DELAY_BETWEEN_LOOKUPS_MS));
        }

        processed++;
        await this.fetchCoverFor(book);
      }
    } catch (error) {
      if (error instanceof OpenLibraryUnavailableError) {
        console.warn(`[covers] ${error.message}; backfill postponed to the next sync`);
      } else {
        console.error('[covers] Backfill run failed:', error);
      }
    } finally {
      this.running = false;
    }
  }

  private static async hasCover(book: Book): Promise<boolean> {
    // CoversService.get reads the directory, which throws when nothing has ever been saved.
    if (!existsSync(appConfig.coversPath)) return false;

    return (await CoversService.get(book)) !== null;
  }

  private static async fetchCoverFor(book: Book): Promise<void> {
    // Marked before the lookup, not after: a book Open Library throws an error on is exactly
    // the book we do not want to retry on every single sync from here on.
    await BooksRepository.markCoverFetchAttempted(book.id);

    const searchTerm = [book.title, book.authors].filter(Boolean).join(' ').trim();

    if (!searchTerm) return;

    try {
      const coverId = await OpenLibraryService.findFirstCoverId(searchTerm);

      if (!coverId) {
        console.debug(`[covers] No Open Library cover for "${book.title}"`);
        return;
      }

      const cover = await OpenLibraryService.fetchCover(String(coverId), 'L');

      if (cover.byteLength < this.MIN_COVER_BYTES) {
        console.debug(`[covers] Open Library returned a placeholder for "${book.title}"`);
        return;
      }

      this.saveCover(book.md5, cover);
      console.log(`[covers] Saved a cover for "${book.title}"`);
    } catch (error) {
      if (error instanceof OpenLibraryUnavailableError) {
        // An outage says nothing about this book. Leave it eligible for the next sync and
        // stop the run, or every book in it would be marked and never looked up again.
        await BooksRepository.clearCoverFetchAttempted(book.id);
        throw error;
      }

      console.error(`[covers] Lookup failed for "${book.title}":`, error);
    }
  }

  private static saveCover(md5: Book['md5'], cover: ArrayBuffer): void {
    if (!existsSync(appConfig.coversPath)) {
      mkdirSync(appConfig.coversPath, { recursive: true });
    }

    writeFileSync(`${appConfig.coversPath}/${md5}.jpg`, Buffer.from(cover));
  }
}
