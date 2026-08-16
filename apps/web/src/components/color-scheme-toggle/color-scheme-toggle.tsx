import {
  ActionIcon,
  ActionIconProps,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { JSX } from 'react';

/** Shared by the desktop navbar footer and the mobile sticky header. */
export function ColorSchemeToggle(props: ActionIconProps): JSX.Element {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme();

  return (
    <ActionIcon
      onClick={() => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')}
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
      {...props}
    >
      {computedColorScheme === 'dark' ? (
        <IconSun stroke={1.5} color="yellow" />
      ) : (
        <IconMoon stroke={1.5} color="violet" />
      )}
    </ActionIcon>
  );
}
