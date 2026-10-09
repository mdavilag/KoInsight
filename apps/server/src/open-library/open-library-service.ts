import { uniq } from 'ramda';
import { OpenLibrarySearchResult } from './open-library-types';

const OPEN_LIBRARY_API = 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS_API = 'https://covers.openlibrary.org';

/**
 * Well under undici's 10s connect timeout. openlibrary.org has outages where TCP connects
 * just hang (while covers.openlibrary.org stays up), and the cover search fans out to
 * several requests, so waiting the full default left the UI on a spinner before a bare 500.
 */
const REQUEST_TIMEOUT_MS = 6000;

/** Open Library could not be reached or answered with a server error — not our fault. */
export class OpenLibraryUnavailableError extends Error {
  constructor(
    url: string,
    readonly cause: unknown
  ) {
    super(`Open Library is unreachable (${new URL(url).host})`);
    this.name = 'OpenLibraryUnavailableError';
  }
}

async function request(url: string): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new OpenLibraryUnavailableError(url, error);
  }

  if (response.status >= 500) {
    throw new OpenLibraryUnavailableError(url, new Error(`HTTP ${response.status}`));
  }

  if (!response.ok) {
    throw new Error(`Open Library request failed: HTTP ${response.status} for ${url}`);
  }

  return response;
}

export class OpenLibraryService {
  static async fetchCover(coverId: string, size: 'S' | 'M' | 'L' = 'M') {
    const url = `${OPEN_LIBRARY_COVERS_API}/b/id/${coverId}-${size}.jpg`;
    return request(url).then((response) => response.arrayBuffer());
  }

  static async queryCovers(searchTerm: string, limit: number = 3) {
    const response = await this.searchBooks(searchTerm, limit);
    const docs = response.docs;

    const coverIds = docs.flatMap((doc) => doc.cover_i);
    const keys = docs.flatMap((doc) => doc.key);

    const newCoverIds = (await Promise.all(keys.map((k) => this.queryCoverForKey(k)))).flat();

    return uniq([...coverIds, ...newCoverIds].filter(Boolean));
  }

  /**
   * `lang` is deliberately not defaulted. Open Library biases results towards the language
   * it is given, so hardcoding one made every non-English library search for the wrong
   * edition — a Portuguese title would come back with its English cover. Omitting the
   * parameter lets Open Library rank on the query alone, which is what we want for a
   * library that can hold any mix of languages.
   */
  private static async searchBooks(
    searchTerm: string,
    limit = 3,
    fields = 'key,cover_i',
    lang?: string
  ): Promise<OpenLibrarySearchResult> {
    const params = new URLSearchParams({
      q: searchTerm,
      limit: limit.toString(),
      fields,
    });

    if (lang) {
      params.set('lang', lang);
    }

    return request(`${OPEN_LIBRARY_API}/search.json?${params}`).then((response) => response.json());
  }

  /**
   * Single best-guess cover for a book, in one request.
   *
   * `queryCovers` fans out to `editions.json` for every hit to build the widest possible
   * grid for a human to choose from. The automatic backfill runs unattended over the whole
   * library, so it takes the top-ranked hit that actually has a cover and makes no further
   * calls. Returns null when Open Library has nothing.
   */
  static async findFirstCoverId(searchTerm: string): Promise<number | null> {
    const response = await this.searchBooks(searchTerm, 5);
    const withCover = response.docs?.find((doc) => doc.cover_i);

    return withCover?.cover_i ?? null;
  }

  private static queryCoverForKey(key: string) {
    return request(`${OPEN_LIBRARY_API}${key}/editions.json`)
      .then((r) => r.json())
      .then((r) => r.entries.flatMap((entry: { covers: string[] }) => entry.covers));
  }
}
