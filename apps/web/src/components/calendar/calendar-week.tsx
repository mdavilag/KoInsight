import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { startOfWeek } from 'date-fns/startOfWeek';
import { range } from 'ramda';
import { JSX } from 'react';
import { useIsMobile } from '../../hooks/use-is-mobile';

import style from './calendar-week.module.css';

export function CalendarWeek({ currentDate }: { currentDate: Date }): JSX.Element {
  const isMobile = useIsMobile();
  const startDate = startOfWeek(currentDate, { locale: { options: { weekStartsOn: 1 } } });
  // 'EEEEE' is the narrow (single-letter) name — 'EEEEEE' does not fit a ~48px column.
  const days = range(0, 7).map((i) => (
    <div key={i}>{format(addDays(startDate, i), isMobile ? 'EEEEE' : 'EEEEEE')}</div>
  ));

  return <div className={style.CalendarWeek}>{days}</div>;
}
