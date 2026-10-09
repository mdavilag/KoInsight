import { NextFunction, Request, Response, Router } from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { requireAuth } from '../auth/auth-middleware';
import { BooksRepository } from '../books/books-repository';
import { CoversService } from '../books/covers/covers-service';
import { appConfig } from '../config';
import { OpenLibraryService, OpenLibraryUnavailableError } from './open-library-service';

const router = Router();

const UNAVAILABLE_MESSAGE = 'Open Library is not responding right now. Try again later.';

router.get('/list-covers', async (req: Request, res: Response, next: NextFunction) => {
  const { searchTerm, limit } = req.query;

  OpenLibraryService.queryCovers(searchTerm as string, Number(limit))
    .then((covers) => {
      res.send(covers);
    })
    .catch((error) => {
      if (error instanceof OpenLibraryUnavailableError) {
        console.warn(`[open-library] ${error.message}: ${(error.cause as Error)?.message}`);
        res.status(504).json({ error: UNAVAILABLE_MESSAGE });
        return;
      }

      next(error);
    });
});

// TODO: change method?
/**
 * Fetches a book cover from Open Library API and saves it to the server
 */
router.get('/cover', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const { coverId, bookId, size = 'M' } = req.query;

  if (!bookId || !coverId) {
    res.status(400).send('Invalid request');
    return next();
  }

  const book = await BooksRepository.getById(Number(bookId));
  if (!book) {
    res.status(404).send('Book not found');
    return next();
  }

  if (!existsSync(appConfig.coversPath)) {
    mkdirSync(appConfig.coversPath);
  }

  try {
    // Download first: deleting before the fetch left the book with no cover at all
    // whenever Open Library was unreachable.
    const cover = await OpenLibraryService.fetchCover(coverId as string, size as 'S' | 'M' | 'L');
    CoversService.deleteExisting(book);
    writeFileSync(`${appConfig.coversPath}/${book.md5}.jpg`, Buffer.from(cover));
    res.send({ status: 'Cover updated' });
  } catch (error) {
    if (error instanceof OpenLibraryUnavailableError) {
      console.warn(`[open-library] ${error.message}: ${(error.cause as Error)?.message}`);
      res.status(504).json({ error: UNAVAILABLE_MESSAGE });
      return;
    }

    res.status(404).json({ error: 'Cover not found' });
  }
});

export { router as openLibraryRouter };
