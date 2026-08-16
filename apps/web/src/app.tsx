import {
  Anchor,
  Box,
  Burger,
  createTheme,
  Drawer,
  Flex,
  Group,
  MantineProvider,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { IconError404, IconHeart } from '@tabler/icons-react';
import { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import style from './app.module.css';
import { RequireAuth } from './auth/auth-context';
import { ColorSchemeToggle } from './components/color-scheme-toggle/color-scheme-toggle';
import { Logo } from './components/logo/logo';
import { Navbar } from './components/navbar/navbar';
import { BookPage } from './pages/book-page/book-page';
import { BooksPage } from './pages/books-page/books-page';
import { CalendarPage } from './pages/calendar-page';
import { LoginPage } from './pages/login-page/login-page';
import { StatsPage } from './pages/stats-page/stats-page';
import { SyncsPage } from './pages/syncs-page';
import { RoutePath } from './routes';

const theme = createTheme({
  headings: { fontFamily: 'Noto Serif, serif' },
  primaryColor: 'koinsight',
  primaryShade: 8,
  colors: {
    koinsight: [
      '#e2fefc',
      '#d3f8f5',
      '#acede8',
      '#81e3dc',
      '#5edad1',
      '#46d5ca',
      '#36d2c7',
      '#23baaf',
      '#0aa69c',
      '#009087',
    ],
  },
  components: {
    // Tooltips carry real information here (page ranges, series, hidden state).
    // Mantine's default is hover-only, which hides all of it on touch devices.
    Tooltip: {
      defaultProps: { events: { hover: true, focus: true, touch: true } },
    },
  },
});

function AppLayout(): JSX.Element {
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const version = __APP_VERSION__;
  return (
    <>
      <div className={style.App}>
        <Group hiddenFrom="md" className={style.MobileHeader} align="center" gap="sm" wrap="nowrap">
          <Burger size="sm" onClick={() => openDrawer()} aria-label="Open navigation" />
          <Logo />
          <ColorSchemeToggle ml="auto" />
        </Group>
        <Drawer opened={drawerOpened} onClose={closeDrawer} size="80%" padding="md">
          <Navbar onNavigate={closeDrawer} />
        </Drawer>
        <Box visibleFrom="md">
          <Navbar />
        </Box>
        <main className={style.Main}>
          <Routes>
            <Route index element={<Navigate to={RoutePath.BOOKS} />} />
            <Route path={RoutePath.BOOKS} element={<BooksPage />} />
            <Route path={RoutePath.BOOK} element={<BookPage />} />
            <Route path={RoutePath.CALENDAR} element={<CalendarPage />} />
            <Route path={RoutePath.STATS} element={<StatsPage />} />
            <Route
              path={RoutePath.SYNCS}
              element={
                <RequireAuth>
                  <SyncsPage />
                </RequireAuth>
              }
            />
            {/* Catch-all route goes last */}
            <Route
              path="*"
              element={
                <Stack align="center" justify="center" style={{ height: '100%' }}>
                  <IconError404 size={144} /> Page not found 😢
                </Stack>
              }
            />
          </Routes>
        </main>
      </div>
      <Text size="xs" ta="center" c="dimmed">
        Made with <IconHeart size={10} /> by{' '}
        <Anchor href="https://gar.dev" target="_blank">
          gar.dev
        </Anchor>
        . {version}
      </Text>
    </>
  );
}

export function App(): JSX.Element {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications />
        <Routes>
          <Route path={RoutePath.LOGIN} element={<LoginPage />} />
          {/* Public read-only dashboard; individual routes/controls gate on auth. */}
          <Route path="*" element={<AppLayout />} />
        </Routes>
      </ModalsProvider>
    </MantineProvider>
  );
}
