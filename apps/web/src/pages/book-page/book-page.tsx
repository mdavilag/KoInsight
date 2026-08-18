import { BookWithData } from '@koinsight/common/types';
import {
  Badge,
  Box,
  Flex,
  Group,
  Loader,
  Menu,
  Paper,
  RingProgress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCalendar,
  IconChevronDown,
  IconClock,
  IconClockHour4,
  IconFile,
  IconHighlight,
  IconRefresh,
  IconSettings,
  IconTable,
} from '@tabler/icons-react';
import { sum } from 'ramda';
import { ComponentType, CSSProperties, JSX, useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../../auth/auth-context';
import { useBookWithData } from '../../api/use-book-with-data';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { BookStatusBadge } from '../../components/book-status-badge/book-status-badge';
import { formatSecondsToHumanReadable } from '../../utils/dates';
import { BookCard } from './book-card';
import { BookPageAnnotations } from './book-page-annotations';
import { BookPageCalendar } from './book-page-calendar';
import { BookPageManage } from './book-page-manage/book-page-manage';
import { BookPageRaw } from './book-page-raw';

export function BookPage(): JSX.Element {
  const { id } = useParams() as { id: string };
  const isMobile = useIsMobile();
  const { authenticated } = useAuth();
  const { data: book, isLoading, mutate } = useBookWithData(Number(id));

  const [tabValue, setTabValue] = useState<string | null>('calendar');

  if (isLoading || !book) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        gap="md"
      >
        <BookCard book={book} />
        <StatsCard book={book} />
      </Flex>

      <Group gap="xs">
        {book.genres?.map((genre) => (
          <Badge radius="sm" variant="outline" key={genre.id}>
            {genre.name}
          </Badge>
        ))}
      </Group>

      <Tabs value={tabValue} onChange={(value) => setTabValue(value)}>
        <Tabs.List
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            // Scrollable tab strip — the standard mobile pattern. Without this the
            // tabs wrap and break the underline, or overflow the viewport.
            flexWrap: 'nowrap',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <Flex style={{ flexShrink: 0 }}>
            <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
              Calendar
            </Tabs.Tab>
            <Tabs.Tab value="annotations" leftSection={<IconHighlight size={16} />}>
              <Flex align="center" gap="xs">
                Annotations{' '}
                {book.annotations.length > 0 && (
                  <Badge color="gray" size="xs">
                    {book.annotations.length}
                  </Badge>
                )}
              </Flex>
            </Tabs.Tab>
            {authenticated && (
              <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />}>
                Manage data
              </Tabs.Tab>
            )}
            {tabValue === 'raw-values' && (
              <Tabs.Tab value="raw-values" leftSection={<IconTable size={16} />}>
                Raw Values
              </Tabs.Tab>
            )}
          </Flex>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <UnstyledButton
                fz={13}
                px="md"
                py="xs"
                aria-label="Advanced"
                style={{ transition: 'background-color 100ms ease', flexShrink: 0 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--tab-hover-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                <Flex align="center" gap="xs">
                  {/* The label is dropped on phones so the tab strip keeps the room. */}
                  {!isMobile && <span>Advanced</span>}
                  <IconChevronDown size={16} />
                </Flex>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconTable size={16} />}
                onClick={() => setTabValue('raw-values')}
              >
                Raw Values
              </Menu.Item>
              <Menu.Item leftSection={<IconRefresh size={16} />} onClick={() => mutate()}>
                Reload book data
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Tabs.List>

        <Tabs.Panel value="calendar">
          <Box py={20}>
            <BookPageCalendar book={book} />
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="annotations">
          <Box py={20}>
            <BookPageAnnotations book={book} />
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="raw-values">
          <Box py={20}>
            <BookPageRaw book={book} />
          </Box>
        </Tabs.Panel>

        {authenticated && (
          <Tabs.Panel value="manage">
            <Box py={20}>
              <BookPageManage book={book} />
            </Box>
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}

function StatsCard({ book }: { book: BookWithData }): JSX.Element {
  const isMobile = useIsMobile();
  const bookPages = book.total_pages;
  const progressPages = book.current_page;
  const progressPercent = book.read_percentage;

  const readingDays = book ? Object.keys(book.read_per_day).length : 0;
  const avgPerDay = readingDays > 0 ? (book?.total_read_time ?? 0) / readingDays : 0;

  return (
    <Paper
      withBorder
      px={{ base: 'md', md: 'lg' }}
      py="md"
      radius="md"
      w={{ base: '100%', md: 'auto' }}
      style={{
        background:
          'linear-gradient(135deg, var(--mantine-color-default) 0%, var(--mantine-color-body) 100%)',
      }}
    >
      <Stack gap={0} align="center">
        <Group gap="xs" align="center" mb="xs">
          <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
            Reading progress
          </Text>
          <BookStatusBadge status={book.status} />
        </Group>
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          align="center"
          justify="space-between"
          gap="md"
          w="100%"
        >
          <Stack align="center" gap="xs">
            <RingProgress
              size={isMobile ? 150 : 180}
              thickness={9}
              roundCaps
              label={
                <Stack gap={0} align="center">
                  <Text size="xl" fw={700} ta="center">
                    {progressPercent}%
                  </Text>
                  <Text size="xs" c="dimmed" ta="center" fw="bold">
                    {progressPages} / {bookPages} <br /> pages read
                  </Text>
                </Stack>
              }
              sections={[
                {
                  value: book.read_percentage,
                  color: 'koinsight',
                },
              ]}
            />
          </Stack>

          <SimpleGrid cols={2} spacing="md" w="100%" style={{ flex: 1 }}>
            <Metric
              icon={IconClock}
              label="Total read time"
              value={formatSecondsToHumanReadable(book.total_read_time)}
            />
            <Metric
              icon={IconCalendar}
              label="Days reading"
              value={Object.keys(book.read_per_day).length}
            />
            <Metric
              icon={IconClockHour4}
              label="Average per day"
              value={formatSecondsToHumanReadable(avgPerDay)}
            />
            <Metric
              icon={IconFile}
              label="Avg time per page"
              value={`${
                book.stats.length > 0
                  ? Math.round(sum(book.stats.map((p) => p.duration)) / book.stats.length)
                  : 0
              }s`}
            />
          </SimpleGrid>
        </Flex>
      </Stack>
    </Paper>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size: number; style: CSSProperties }>;
  label: string;
  value: string | number;
}): JSX.Element {
  return (
    <Group gap="sm" wrap="nowrap">
      <Icon size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text fz={11} c="dimmed" lh={1.2} tt="uppercase" fw="bold">
          {label}
        </Text>
        <Text size="md" fw={600}>
          {value}
        </Text>
      </Stack>
    </Group>
  );
}
