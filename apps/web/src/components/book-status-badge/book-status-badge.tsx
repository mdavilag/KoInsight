import { ReadingStatus } from '@koinsight/common/types';
import { Badge, BadgeProps } from '@mantine/core';
import { IconBook, IconCircleCheck } from '@tabler/icons-react';

export type BookStatusBadgeProps = Omit<BadgeProps, 'children' | 'color'> & {
  status: ReadingStatus;
};

const LABELS: Record<ReadingStatus, string> = {
  reading: 'Reading',
  read: 'Read',
};

export function BookStatusBadge({ status, ...props }: BookStatusBadgeProps): JSX.Element {
  const isRead = status === 'read';

  return (
    <Badge
      variant="light"
      color={isRead ? 'koinsight' : 'gray'}
      leftSection={isRead ? <IconCircleCheck size={12} /> : <IconBook size={12} />}
      {...props}
    >
      {LABELS[status]}
    </Badge>
  );
}
