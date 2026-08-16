import { BookWithData, PageStat } from '@koinsight/common/types';
import { Group, Stack, Text } from '@mantine/core';
import { IconClock, IconPageBreak } from '@tabler/icons-react';
import { sum } from 'ramda';
import { JSX, ReactNode } from 'react';
import { getReferencePageRange } from '../../utils/book-progress';
import { formatSecondsToHumanReadable } from '../../utils/dates';

type CalendarBookDayDetailProps = {
  book: BookWithData;
  events: PageStat[];
  /** Rendered in place of the plain title, e.g. a link to the book page. */
  title?: ReactNode;
};

/**
 * Expanded version of {@link CalendarBookDay} for the mobile day Drawer, where
 * there is room to spell the numbers out instead of hiding them in a tooltip.
 */
export function CalendarBookDayDetail({
  book,
  events,
  title,
}: CalendarBookDayDetailProps): JSX.Element {
  const [start, end] = getReferencePageRange(book, events);
  const from = Math.round(start);
  const to = Math.round(end);

  return (
    <Stack gap={4}>
      {title ?? <Text fw={700}>{book.title}</Text>}
      <Group gap="xs" wrap="nowrap">
        <IconClock size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
        <Text size="sm">{formatSecondsToHumanReadable(sum(events.map((e) => e.duration)))}</Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <IconPageBreak size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
        <Text size="sm">
          Pages {from} – {to} ({to - from} pages)
        </Text>
      </Group>
    </Stack>
  );
}
