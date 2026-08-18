import { BookWithData, PageStat } from '@koinsight/common/types';
import { Tooltip } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { sum } from 'ramda';
import { JSX } from 'react';
import { describeReferencePageRange, getReferencePageRange } from '../../utils/book-progress';
import { getDuration, shortDuration } from '../../utils/dates';

type CalendarBookDayProps = {
  book: BookWithData;
  data: {
    events: PageStat[];
  };
};

export function CalendarBookDay({ book, data }: CalendarBookDayProps): JSX.Element {
  const { from, to, count } = describeReferencePageRange(getReferencePageRange(book, data.events));
  const duration = getDuration(sum(data.events.map((event) => event.duration)));

  return (
    <Tooltip label={`Pages read: ${from} - ${to} (${count} ${count === 1 ? 'page' : 'pages'})`}>
      <span>
        <IconClock size={14} /> {shortDuration(duration)}
      </span>
    </Tooltip>
  );
}
