import { generatePath } from 'react-router';

export enum RoutePath {
  LOGIN = '/login',
  BOOKS = '/books',
  BOOK = '/books/:id',
  CALENDAR = '/calendar/',
  STATS = '/stats/',
  SYNCS = '/syncs',

  HOME = BOOKS,
}

export function getBookPath(bookId: number | string): string {
  return generatePath(RoutePath.BOOK, { id: bookId.toString() });
}
