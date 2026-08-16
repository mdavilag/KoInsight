import { Button, Drawer, Flex, Text } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import clsx from 'clsx';
import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { endOfMonth } from 'date-fns/endOfMonth';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { isSameMonth } from 'date-fns/isSameMonth';
import { isToday } from 'date-fns/isToday';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { subMonths } from 'date-fns/subMonths';
import {
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  TouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { CalendarWeek } from './calendar-week';

import style from './calendar.module.css';

/** Horizontal travel (px) that counts as a month swipe. */
const SWIPE_THRESHOLD = 60;

export type CalendarEvent<T> = {
  date: Date;
  title?: string;
  data?: T;
};

export type CalendarProps<T> = {
  events: Record<string, CalendarEvent<T>>;
  dayRenderer?: (data: T) => ReactNode;
  /**
   * Content of the mobile day Drawer. Falls back to `dayRenderer`, which is
   * usually too wide for a calendar cell but fits fine in a full-width sheet.
   */
  dayDetailRenderer?: (data: T, date: Date) => ReactNode;
  /** 0–1, drives the opacity of the mobile day dot. Defaults to a full dot. */
  dayIntensity?: (data: T) => number;
};

export function Calendar<T>({
  events,
  dayRenderer,
  dayDetailRenderer,
  dayIntensity,
}: CalendarProps<T>): JSX.Element {
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goToPreviousMonth = () => setCurrentDate((date) => subMonths(date, 1));
  const goToNextMonth = () => setCurrentDate((date) => addMonths(date, 1));

  const startDate = startOfWeek(startOfMonth(currentDate), {
    locale: { options: { weekStartsOn: 1 } },
  });
  const endDate = endOfWeek(endOfMonth(currentDate), { locale: { options: { weekStartsOn: 1 } } });
  const dates = [];

  let day = startDate;
  while (day <= endDate) {
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isCurrentDay = isToday(day);
    const key = day.toISOString();
    const event = events[key];
    const dayNum = format(day, 'd');
    // On mobile the cell only shows a dot, so it has to be tappable to be useful.
    const isInteractive = isMobile && !!event;

    dates.push(
      <div
        className={clsx(
          style.CalendarDate,
          !isCurrentMonth && style.CalendarDateDisabled,
          isCurrentDay && style.CalendarDateToday,
          isInteractive && style.CalendarDateInteractive
        )}
        key={key}
        {...(isInteractive
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': `Reading on ${format(day, 'd MMMM yyyy')}`,
              onClick: () => setSelectedKey(key),
              onKeyDown: (e: ReactKeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKey(key);
                }
              },
            }
          : {})}
      >
        <div className={style.CalendarDay}>{event ? <strong>{dayNum}</strong> : dayNum}</div>
        {event && (
          <>
            <span
              className={style.CalendarDot}
              style={{
                opacity: event.data && dayIntensity ? 0.25 + 0.75 * dayIntensity(event.data) : 1,
              }}
            />
            {/* Hidden by CSS on mobile — skip the work (and the stray tooltip
                targets) rather than render it behind display:none. */}
            {!isMobile && (
              <div className={style.CalendarEvent}>
                {event.title}
                {event?.data && dayRenderer?.(event.data!)}
              </div>
            )}
          </>
        )}
      </div>
    );
    day = addDays(day, 1);
  }

  useEffect(() => {
    function bindShortcuts(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPreviousMonth();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextMonth();
          break;
      }
    }

    window.addEventListener('keydown', bindShortcuts);
    return () => {
      window.removeEventListener('keydown', bindShortcuts);
    };
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) {
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    // Ignore mostly-vertical gestures so page scrolling still works.
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      goToNextMonth();
    } else {
      goToPreviousMonth();
    }
  };

  const selectedEvent = selectedKey ? events[selectedKey] : undefined;

  return (
    <div className={style.Calendar}>
      <div className={style.CalendarHeader}>
        <Flex gap="xs" align="center" style={{ flex: '1 1 auto' }}>
          <Button size="xs" variant="light" color="violet" onClick={goToPreviousMonth}>
            <IconArrowLeft size={16} />
          </Button>

          <Button size="xs" variant="default" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <MonthPickerInput
            size="xs"
            value={currentDate}
            onChange={(e) => setCurrentDate(e!)}
            style={{ flex: '1 1 auto', maxWidth: 200 }}
          />
        </Flex>
        <Button size="xs" color="violet" variant="light" onClick={goToNextMonth}>
          <IconArrowRight size={16} />
        </Button>
      </div>
      <CalendarWeek currentDate={currentDate} />
      <div className={style.CalendarGrid} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {dates}
      </div>

      <Drawer
        opened={!!selectedEvent}
        onClose={() => setSelectedKey(null)}
        position="bottom"
        size="auto"
        padding="md"
        title={selectedEvent ? format(selectedEvent.date, 'd MMMM yyyy') : undefined}
        styles={{ title: { fontWeight: 700 } }}
      >
        {selectedEvent?.data ? (
          (dayDetailRenderer ?? ((data: T) => dayRenderer?.(data)))(
            selectedEvent.data,
            selectedEvent.date
          )
        ) : (
          <Text c="dimmed">No reading data for this day.</Text>
        )}
      </Drawer>
    </div>
  );
}
