import { BookWithData, ReadingStatus } from '@koinsight/common/types';
import { SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';
import { updateBookStatus } from '../../../api/books';
import { BookStatusBadge } from '../../../components/book-status-badge/book-status-badge';

export type BookStatusProps = {
  book: BookWithData;
};

type StatusValue = 'auto' | ReadingStatus;

export function BookStatus({ book }: BookStatusProps) {
  const [updateLoading, setUpdateLoading] = useState(false);

  const value: StatusValue = book.status_override ?? 'auto';

  const onUpdate = async (next: StatusValue) => {
    try {
      setUpdateLoading(true);
      await updateBookStatus(book.id, next === 'auto' ? null : next);

      // useBooks is keyed by ['books', showHidden], so a plain 'books' key would not match it.
      await mutate((key) => Array.isArray(key) && key[0] === 'books');
      await mutate(`books/${book.id}`);

      notifications.show({
        title: 'Reading status updated',
        message: `"${book.title}" is now marked as ${next === 'auto' ? 'automatic' : next}.`,
        color: 'green',
        position: 'top-center',
      });
    } catch (error) {
      notifications.show({
        title: 'Failed to update reading status',
        message: '',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div>
      <Title order={3} mb="md">
        Reading status
      </Title>
      <Text size="sm" mb="md" maw="80%" lh="xl">
        By default the status is derived from your reading statistics: a book counts as{' '}
        <strong>Read</strong> once the furthest page you reached matches the total page count.
        KOReader does not always record that final page, so you can override the status here.
      </Text>
      <Stack gap="xs" align="flex-start">
        <SegmentedControl
          disabled={updateLoading}
          value={value}
          onChange={(next) => onUpdate(next as StatusValue)}
          data={[
            { label: 'Automatic', value: 'auto' },
            { label: 'Reading', value: 'reading' },
            { label: 'Read', value: 'read' },
          ]}
        />
        <Text size="xs" c="dimmed" component="div">
          Currently showing as <BookStatusBadge status={book.status} size="xs" />
          {book.status_override === null
            ? ` (${book.max_read_page} of ${book.total_pages} pages reached)`
            : ' (manually set)'}
        </Text>
      </Stack>
    </div>
  );
}
