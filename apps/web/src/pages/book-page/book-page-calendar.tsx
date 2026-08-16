import { BookWithData, PageStat } from '@koinsight/common/types';
import { startOfDay } from 'date-fns/startOfDay';
import { sum } from 'ramda';
import { JSX } from 'react';
import { Calendar, CalendarEvent } from '../../components/calendar/calendar';
import { CalendarBookDayDetail } from '../../components/calendar/calendar-book-day-detail';
import { CalendarBookDay } from '../../components/calendar/calendar-book-day';

type BookPageCalendarProps = {
  book: BookWithData;
};

type DayData = {
  events: PageStat[];
};

const dayDuration = (data: DayData) => sum(data.events.map((event) => event.duration));

export function BookPageCalendar({ book }: BookPageCalendarProps): JSX.Element {
  const calendarEvents = book.stats.reduce<Record<string, CalendarEvent<DayData>>>((acc, event) => {
    const date = startOfDay(event.start_time);
    const key = date.toISOString();
    acc[key] = acc[key] || { date, data: { events: [] } };
    acc[key].data = acc[key]?.data?.events
      ? { events: [...acc[key].data.events, event] }
      : { events: [event] };

    return acc;
  }, {});

  // Busiest day, used to normalise the mobile day dots.
  const maxDayDuration = Math.max(
    1,
    ...Object.values(calendarEvents).map((event) => dayDuration(event.data!))
  );

  return (
    <Calendar<DayData>
      events={calendarEvents}
      dayRenderer={(data) => <CalendarBookDay book={book} data={data} />}
      dayDetailRenderer={(data) => <CalendarBookDayDetail book={book} events={data.events} />}
      dayIntensity={(data) => dayDuration(data) / maxDayDuration}
    />
  );
}
