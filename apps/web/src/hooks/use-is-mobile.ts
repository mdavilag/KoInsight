import { useMediaQuery } from '@mantine/hooks';

/**
 * Single source of truth for the mobile breakpoint. `62em` is Mantine's `md`,
 * the same value used by the `hiddenFrom`/`visibleFrom` props across the app.
 *
 * `getInitialValueInEffect: false` resolves the query during the first render
 * instead of after it, so phones never flash the desktop layout.
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 62em)', false, { getInitialValueInEffect: false }) ?? false;
}
