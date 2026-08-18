import { Book, BookDevice, Device, PageStat } from '@koinsight/common/types';
import { addDays, startOfDay } from 'date-fns';
import { createBookDevice } from '../db/factories/book-device-factory';
import { createBook, fakeBook } from '../db/factories/book-factory';
import { createDevice } from '../db/factories/device-factory';
import { createPageStat } from '../db/factories/page-stat-factory';
import { db } from '../knex';
import { BooksService } from './books-service';

describe(BooksService.withData, () => {
  let device: Device;

  beforeEach(async () => {
    device = await createDevice(db);
  });
  describe('total_pages', () => {
    it('returns reference pages if available', async () => {
      const book = await createBook(db, { title: 'Test Book 1', reference_pages: 121 });

      const result = await BooksService.withData(book);

      expect(result.total_pages).toEqual(121);
    });

    it('returns the max pages from device data if reference pages are not available', async () => {
      const book = await createBook(db, { title: 'Test Book 1', reference_pages: undefined });

      await createBookDevice(db, book, device, { pages: 100 });

      const device2 = await createDevice(db);
      await createBookDevice(db, book, device2, { pages: 200 });

      const result = await BooksService.withData(book);

      expect(result.total_pages).toEqual(200);
    });
  });

  describe('total_read_time', () => {
    it('returns the sum of total read time from device data', async () => {
      const book1 = await createBook(db, { title: 'Test Book 1' });

      await db<BookDevice>('book_device').insert([
        { book_md5: book1.md5, total_read_time: 100 },
        { book_md5: book1.md5, total_read_time: 200 },
      ]);

      const result = await BooksService.withData(book1);

      expect(result.total_read_time).toEqual(300);
    });

    it('returns 0 if no device data is available', async () => {
      const book1 = await createBook(db, { title: 'Test Book 1' });
      const result = await BooksService.withData(book1);

      expect(result.total_read_time).toEqual(0);
    });
  });

  describe('started_reading', () => {
    it('returns the earliest start time from stats', async () => {
      const book1 = await createBook(db, { title: 'Test Book 1' });
      const bookDevice = await createBookDevice(db, book1, device, { book_md5: book1.md5 });

      await createPageStat(db, book1, bookDevice, device, { start_time: 1720898518 });
      await createPageStat(db, book1, bookDevice, device, { start_time: 1720898618 });
      await createPageStat(db, book1, bookDevice, device, { start_time: 1720898718 });
      await createPageStat(db, book1, bookDevice, device, { start_time: 1720898818 });

      const result = await BooksService.withData(book1);

      expect(result.started_reading).toEqual(1720898518000);
    });

    it('returns 0 if no stats are available', async () => {
      const book1 = await createBook(db, { title: 'Test Book 1' });
      const result = await BooksService.withData(book1);

      expect(result.started_reading).toEqual(0);
    });
  });

  describe('read_per_day', () => {
    it('returns the read time per day', async () => {
      const book1 = await createBook(db, { title: 'Test Book 1', reference_pages: 100 });
      const bookDevice = await createBookDevice(db, book1, device, {
        book_md5: book1.md5,
        pages: 100,
      });

      const day1 = 1720898518; // database dates are stored in seconds :/
      const day2 = addDays(day1, 1).getTime();
      const day3 = addDays(day1, 2).getTime();

      await createPageStat(db, book1, bookDevice, device, {
        start_time: day1,
        duration: 1,
        page: 1,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day1,
        duration: 10,
        page: 2,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day1,
        duration: 100,
        page: 3,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day2,
        duration: 2,
        page: 4,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day2,
        duration: 20,
        page: 5,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day2,
        duration: 200,
        page: 6,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day3,
        duration: 3,
        page: 7,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day3,
        duration: 30,
        page: 8,
      });
      await createPageStat(db, book1, bookDevice, device, {
        start_time: day3,
        duration: 300,
        page: 9,
      });

      const result = await BooksService.withData(book1);

      expect(result.read_per_day).toEqual({
        [startOfDay(day1 * 1000).getTime()]: 111,
        [startOfDay(day2 * 1000).getTime()]: 222,
        [startOfDay(day3 * 1000).getTime()]: 333,
      });
    });

    it('returns an empty object if no stats are available', async () => {
      const book1 = await createBook(db, { title: 'Test Book 1' });
      const result = await BooksService.withData(book1);

      expect(result.read_per_day).toEqual({});
    });
  });

  describe('total_read_pages', () => {
    describe('with reference pages', () => {
      it('returns the total read pages', async () => {
        const book1 = await createBook(db, { title: 'Test Book 1', reference_pages: 100 });
        const bookDevice1 = await createBookDevice(db, book1, device, {
          book_md5: book1.md5,
          pages: 200, // each page counts as half
        });
        const device2 = await createDevice(db);
        const bookDevice2 = await createBookDevice(db, book1, device2, {
          book_md5: book1.md5,
          pages: 50, // each page counts as 2
        });

        // 2 pages on device 1
        await createPageStat(db, book1, bookDevice1, device, { page: 1 });
        await createPageStat(db, book1, bookDevice1, device, { page: 2 });
        await createPageStat(db, book1, bookDevice1, device, { page: 3 });
        await createPageStat(db, book1, bookDevice1, device, { page: 4 });

        // 8 pages on device 2
        await createPageStat(db, book1, bookDevice2, device, { page: 8 });
        await createPageStat(db, book1, bookDevice2, device, { page: 9 });
        await createPageStat(db, book1, bookDevice2, device, { page: 10 });
        await createPageStat(db, book1, bookDevice2, device, { page: 11 });

        const result = await BooksService.withData(book1);

        expect(result.total_read_pages).toEqual(10);
      });

      it('returns 0 if no pages are read', async () => {
        const book1 = await createBook(db, { title: 'Test Book 1', reference_pages: 100 });
        const result = await BooksService.withData(book1);

        expect(result.total_read_pages).toEqual(0);
      });
    });

    describe('without reference pages', () => {
      it('returns the total read pages', async () => {
        const book1 = await createBook(db, { title: 'Test Book 1', reference_pages: undefined });
        const bookDevice1 = await createBookDevice(db, book1, device, {
          book_md5: book1.md5,
          pages: 200,
        });
        const device2 = await createDevice(db);
        const bookDevice2 = await createBookDevice(db, book1, device2, {
          book_md5: book1.md5,
          pages: 50,
        });

        await createPageStat(db, book1, bookDevice1, device, { page: 1 });
        await createPageStat(db, book1, bookDevice1, device, { page: 2 });
        await createPageStat(db, book1, bookDevice1, device, { page: 3 });
        await createPageStat(db, book1, bookDevice1, device, { page: 4 });

        await createPageStat(db, book1, bookDevice2, device, { page: 8 });
        await createPageStat(db, book1, bookDevice2, device, { page: 9 });
        await createPageStat(db, book1, bookDevice2, device, { page: 10 });
        await createPageStat(db, book1, bookDevice2, device, { page: 11 });

        const result = await BooksService.withData(book1);

        expect(result.total_read_pages).toEqual(8);
      });

      it('returns 0 if no pages are read', async () => {
        const book1 = await createBook(db, { title: 'Test Book 1', reference_pages: 100 });
        const result = await BooksService.withData(book1);

        expect(result.total_read_pages).toEqual(0);
      });
    });
  });
});

describe(BooksService.getUniqueReadPages, () => {
  let device1: Device;
  let device2: Device;
  let book1: Book;

  beforeEach(async () => {
    device1 = await createDevice(db);
    device2 = await createDevice(db);
    book1 = await createBook(db, { title: 'Test Book 1', reference_pages: 100 });
  });

  it('returns unique read pages for a book with reference pages', async () => {
    const bookDevice1 = await createBookDevice(db, book1, device1, {
      book_md5: book1.md5,
      pages: 50,
    });
    const bookDevice2 = await createBookDevice(db, book1, device2, {
      book_md5: book1.md5,
      pages: 200,
    });

    const statPromises = [
      createPageStat(db, book1, bookDevice1, device1, { page: 1, total_pages: 50 }),
      createPageStat(db, book1, bookDevice1, device1, { page: 2, total_pages: 50 }),

      createPageStat(db, book1, bookDevice2, device2, { page: 10, total_pages: 200 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 11, total_pages: 200 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 12, total_pages: 200 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 13, total_pages: 200 }),
    ];

    const stats = await Promise.all(statPromises);

    const result = await BooksService.getUniqueReadPages(book1, stats);

    expect(result).toEqual(6);
  });

  it('returns unique read pages with overlapping page stats', async () => {
    const bookDevice1 = await createBookDevice(db, book1, device1, {
      book_md5: book1.md5,
      pages: 100,
    });
    const bookDevice2 = await createBookDevice(db, book1, device2, {
      book_md5: book1.md5,
      pages: 100,
    });

    const statPromises = [
      createPageStat(db, book1, bookDevice1, device1, { page: 2, total_pages: 100 }),
      createPageStat(db, book1, bookDevice1, device1, { page: 3, total_pages: 100 }),
      createPageStat(db, book1, bookDevice1, device1, { page: 4, total_pages: 100 }),

      createPageStat(db, book1, bookDevice2, device2, { page: 3, total_pages: 100 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 4, total_pages: 100 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 5, total_pages: 100 }),
    ];

    const stats = await Promise.all(statPromises);

    const result = await BooksService.getUniqueReadPages(book1, stats);

    expect(result).toEqual(4);
  });

  it('returns unique read pages with partially read pages', async () => {
    const bookDevice1 = await createBookDevice(db, book1, device1, {
      book_md5: book1.md5,
      pages: 50,
    });
    const bookDevice2 = await createBookDevice(db, book1, device2, {
      book_md5: book1.md5,
      pages: 200,
    });

    const statPromises = [
      // these count for 2
      createPageStat(db, book1, bookDevice1, device1, { page: 1, total_pages: 50 }),
      createPageStat(db, book1, bookDevice1, device1, { page: 2, total_pages: 50 }),

      // these count for .5
      createPageStat(db, book1, bookDevice2, device2, { page: 10, total_pages: 200 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 11, total_pages: 200 }),
      createPageStat(db, book1, bookDevice2, device2, { page: 12, total_pages: 200 }),
    ];

    const stats = await Promise.all(statPromises);

    const result = await BooksService.getUniqueReadPages(book1, stats);

    expect(result).toEqual(6); // result is rounded
  });
});

/**
 * The helpers below are pure, so they are exercised with plain objects instead of
 * round-tripping through the database.
 */
function aBook(overrides: Partial<Book> = {}): Book {
  return { ...fakeBook({ reference_pages: null, ...overrides }), id: 1 } as Book;
}

function aStat(overrides: Partial<PageStat>): PageStat {
  return {
    device_id: 'device-1',
    book_md5: 'md5',
    page: 1,
    start_time: 0,
    duration: 30,
    total_pages: 100,
    ...overrides,
  };
}

describe(BooksService.getCurrentPage, () => {
  it('returns 0 when there are no stats', () => {
    expect(BooksService.getCurrentPage(aBook(), [])).toEqual(0);
  });

  it('returns the page of the most recent stat, not the highest page', () => {
    const stats = [
      aStat({ page: 10, start_time: 100 }),
      // a glossary lookup at the end of the book
      aStat({ page: 98, start_time: 200 }),
      aStat({ page: 12, start_time: 300 }),
    ];

    expect(BooksService.getCurrentPage(aBook(), stats)).toEqual(12);
  });

  it('breaks ties on start_time with the higher page', () => {
    const stats = [aStat({ page: 40, start_time: 500 }), aStat({ page: 41, start_time: 500 })];

    expect(BooksService.getCurrentPage(aBook(), stats)).toEqual(41);
  });

  it('rescales the page to the reference page count', () => {
    const book = aBook({ reference_pages: 200 });
    const stats = [aStat({ page: 25, start_time: 100, total_pages: 100 })];

    expect(BooksService.getCurrentPage(book, stats)).toEqual(50);
  });

  it('leaves the page untouched when a stat reports no total pages', () => {
    const book = aBook({ reference_pages: 200 });
    const stats = [aStat({ page: 25, start_time: 100, total_pages: 0 })];

    expect(BooksService.getCurrentPage(book, stats)).toEqual(25);
  });
});

describe(BooksService.getMaxReadPage, () => {
  it('returns 0 when there are no stats', () => {
    expect(BooksService.getMaxReadPage(aBook(), [])).toEqual(0);
  });

  it('returns the highest page ever reached, regardless of when', () => {
    const stats = [
      aStat({ page: 10, start_time: 100 }),
      aStat({ page: 98, start_time: 200 }),
      aStat({ page: 12, start_time: 300 }),
    ];

    expect(BooksService.getMaxReadPage(aBook(), stats)).toEqual(98);
  });

  it('rescales pages to the reference page count', () => {
    const book = aBook({ reference_pages: 50 });
    const stats = [aStat({ page: 100, start_time: 100, total_pages: 100 })];

    expect(BooksService.getMaxReadPage(book, stats)).toEqual(50);
  });
});

describe(BooksService.getReadPercentage, () => {
  it('returns 0 when the total page count is unknown', () => {
    expect(BooksService.getReadPercentage(0, 42)).toEqual(0);
  });

  it('rounds to a whole percentage', () => {
    expect(BooksService.getReadPercentage(272, 250)).toEqual(92);
  });

  it('clamps to 100', () => {
    expect(BooksService.getReadPercentage(100, 105)).toEqual(100);
  });
});

describe(BooksService.getStatus, () => {
  it('is reading while the last page has not been reached', () => {
    expect(BooksService.getStatus(aBook(), 272, 250)).toEqual('reading');
  });

  it('is read once the last page has been reached', () => {
    expect(BooksService.getStatus(aBook(), 272, 272)).toEqual('read');
  });

  it('allows one page of slack for page count mismatches', () => {
    expect(BooksService.getStatus(aBook(), 272, 271)).toEqual('read');
  });

  it('is reading when the total page count is unknown', () => {
    expect(BooksService.getStatus(aBook(), 0, 0)).toEqual('reading');
  });

  it('lets a manual override win over the derived status', () => {
    expect(BooksService.getStatus(aBook({ status_override: 'read' }), 272, 10)).toEqual('read');
    expect(BooksService.getStatus(aBook({ status_override: 'reading' }), 272, 272)).toEqual(
      'reading'
    );
  });
});
