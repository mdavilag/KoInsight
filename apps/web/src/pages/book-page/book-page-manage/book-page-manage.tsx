import { BookWithData } from '@koinsight/common/types';
import { Flex } from '@mantine/core';
import { JSX } from 'react';
import { BookUploadCover } from '../components/book-upload-cover';
import { BookDelete } from './book-delete';
import { BookHide } from './book-hide';
import { BookReferencePages } from './book-reference-pages';
import { BookStatus } from './book-status';

type BookPageManageProps = {
  book: BookWithData;
};

export function BookPageManage({ book }: BookPageManageProps): JSX.Element {
  return (
    <Flex direction="column" align="flex-start" gap="xl">
      <BookReferencePages book={book} />
      <BookStatus book={book} />
      <BookUploadCover book={book} />
      <BookHide book={book} />
      <BookDelete book={book} />
    </Flex>
  );
}
