import { SimpleGrid } from '@mantine/core';
import { JSX } from 'react';
import { Statistic, StatisticProps } from './statistic';

type StatisticsProps = {
  data: StatisticProps[];
};

export function Statistics({ data }: StatisticsProps): JSX.Element {
  return (
    // A grid rather than a wrapping flex row: 2×2 on phones, one row on desktop,
    // with every tile the same width instead of ragged flex-grow leftovers.
    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
      {data.map((stat) => (
        <Statistic key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
      ))}
    </SimpleGrid>
  );
}
