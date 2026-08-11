import { ProgressWithUsername } from '@koinsight/common/types/progress';
import useSWR from 'swr';
import { SERVER_URL } from './api';

export function useProgresses() {
  return useSWR(
    'progresses',
    () =>
      fetch(`${SERVER_URL}/syncs/progress`, { credentials: 'include' }).then(
        (res) => res.json() as Promise<ProgressWithUsername[]>
      ),
    { fallbackData: [] }
  );
}
