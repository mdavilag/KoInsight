import { BookWithData, PageStat } from '@koinsight/common/types';
import { Book } from '@koinsight/common/types/book';
import { Anchor, Flex, Loader, Stack, Title } from '@mantine/core';
import { startOfDay } from 'date-fns/startOfDay';
import { sum, uniq } from 'ramda';
import { Fragment, JSX, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useBooks } from '../api/books';
import { usePageStats } from '../api/use-page-stats';
import { CalendarBookDayDetail } from '../components/calendar/calendar-book-day-detail';
import { CalendarBookDay } from '../components/calendar/calendar-book-day';
import { Calendar, CalendarEvent } from '../components/calendar/calendar';
import { getBookPath } from '../routes';

type DayData = {
  events: PageStat[];
};

const dayDuration = (data: DayData) => sum(data.events.map((event) => event.duration));

export function CalendarPage(): JSX.Element {
  const { data: books, isLoading } = useBooks();
  const {
    data: { stats: events },
    isLoading: eventsLoading,
  } = usePageStats();

  const calendarEvents = useMemo<Record<string, CalendarEvent<DayData>>>(() => {
    if (eventsLoading || !events) {
      return {};
    }

    const eventsList = events.reduce<Record<string, CalendarEvent<DayData>>>((acc, event) => {
      const date = startOfDay(event.start_time);
      const key = date.toISOString();

      acc[key] = {
        date,
        data: acc[key]?.data?.events
          ? { events: [...acc[key].data.events, event] }
          : { events: [event] },
      };

      return acc;
    }, {});

    return eventsList;
  }, [events, eventsLoading]);

  // Busiest day of the whole range, used to normalise the mobile day dots.
  const maxDayDuration = useMemo(
    () => Math.max(1, ...Object.values(calendarEvents).map((e) => dayDuration(e.data!))),
    [calendarEvents]
  );

  const getBookByMd5 = useCallback(
    (md5: Book['md5']) => books?.find((book) => book.md5 === md5),
    [books]
  );

  /** The books read on a given day, paired with just that day's page stats. */
  const getDayBooks = useCallback(
    (data: DayData) => {
      const uniqueBookMd5s = uniq(data.events.map(({ book_md5 }) => book_md5));

      return (uniqueBookMd5s.map((id) => getBookByMd5(id)).filter(Boolean) as BookWithData[]).map(
        (book) => ({
          book,
          events: data.events.filter((event) => event.book_md5 === book.md5),
        })
      );
    },
    [getBookByMd5]
  );

  const bookLink = (book: BookWithData) => (
    <Anchor component={Link} to={getBookPath(book.id)} fw={700}>
      {book.title}
    </Anchor>
  );

  if (isLoading || !books || !events || eventsLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      <Title mb="xl">Calendar</Title>
      <Calendar<DayData>
        events={calendarEvents}
        dayRenderer={(data) =>
          getDayBooks(data).map(({ book, events: bookEvents }) => (
            <Fragment key={book.md5}>
              {bookLink(book)}
              <br />
              <CalendarBookDay book={book} data={{ events: bookEvents }} />
              <br />
            </Fragment>
          ))
        }
        dayDetailRenderer={(data) => (
          <Stack gap="lg">
            {getDayBooks(data).map(({ book, events: bookEvents }) => (
              <CalendarBookDayDetail
                key={book.md5}
                book={book}
                events={bookEvents}
                title={bookLink(book)}
              />
            ))}
          </Stack>
        )}
        dayIntensity={(data) => dayDuration(data) / maxDayDuration}
      />
    </>
  );
}
