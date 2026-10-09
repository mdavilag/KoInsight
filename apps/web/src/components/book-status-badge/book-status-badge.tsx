import { ReadingStatus } from '@koinsight/common/types';
import { Badge, BadgeProps, Box, BoxProps, Tooltip } from '@mantine/core';
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

type BookStatusIconProps = Omit<BoxProps, 'children' | 'c'> & {
  status: ReadingStatus;
  size?: number;
};

/** Icon-only variant of the badge, for rows too narrow to fit the label (mobile table). */
export function BookStatusIcon({ status, size = 13, ...props }: BookStatusIconProps): JSX.Element {
  const isRead = status === 'read';
  const Icon = isRead ? IconCircleCheck : IconBook;

  return (
    <Tooltip label={LABELS[status]} withArrow>
      <Box
        component="span"
        display="flex"
        c={isRead ? 'koinsight' : 'dimmed'}
        aria-label={LABELS[status]}
        {...props}
      >
        <Icon size={size} />
      </Box>
    </Tooltip>
  );
}
