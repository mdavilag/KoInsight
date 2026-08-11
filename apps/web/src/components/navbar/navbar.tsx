import {
  ActionIcon,
  Box,
  Flex,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBooks,
  IconCalendar,
  IconChartBar,
  IconDownload,
  IconLogin,
  IconLogout,
  IconMoon,
  IconReload,
  IconSun,
} from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/auth-context';
import { RoutePath } from '../../routes';
import { Logo } from '../logo/logo';
import { DownloadPluginModal } from './download-plugin';

import style from './navbar.module.css';

export function Navbar({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { authenticated, logout } = useAuth();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme();
  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
    navigate(RoutePath.LOGIN, { replace: true });
  };

  const handleLogin = () => {
    onNavigate?.();
    navigate(RoutePath.LOGIN);
  };

  const [downloadOpened, { close: closeDownload, open: openDownload }] = useDisclosure(false);

  // Read-only tabs are always visible; login-only tabs (Progress syncs, plugin
  // download) only appear once authenticated.
  const tabs = [
    { link: RoutePath.BOOKS, label: 'Books', icon: IconBooks },
    { link: RoutePath.CALENDAR, label: 'Calendar', icon: IconCalendar },
    { link: RoutePath.STATS, label: 'Reading stats', icon: IconChartBar },
    ...(authenticated
      ? [
          { link: RoutePath.SYNCS, label: 'Progress syncs', icon: IconReload },
          { onClick: openDownload, label: 'KOReader Plugin', icon: IconDownload },
        ]
      : []),
  ];

  const [active, setActive] = useState(
    () => tabs.find((item) => item.link === pathname)?.link ?? RoutePath.HOME
  );

  const onClick = (link: RoutePath) => {
    setActive(link);
    onNavigate?.();
  };

  const links = tabs.map((item) =>
    item.link ? (
      <NavLink
        className={style.Link}
        data-active={item.link === active || undefined}
        to={item.link}
        key={item.label}
        onClick={() => onClick(item.link)}
      >
        <item.icon className={style.LinkIcon} stroke={1.5} />
        <span>{item.label}</span>
      </NavLink>
    ) : (
      <a className={style.Link} key={item.label} onClick={() => item.onClick()}>
        <item.icon className={style.LinkIcon} stroke={1.5} />
        <span>{item.label}</span>
      </a>
    )
  );

  return (
    <Box className={style.Navbar} component="nav">
      <Logo
        onClick={() => {
          setActive(RoutePath.HOME);
          onNavigate?.();
        }}
        className={style.Logo}
      />
      <div>{links}</div>
      <div className={style.Footer}>
        <Flex gap="xs">
          {authenticated === true && (
            <ActionIcon
              onClick={handleLogout}
              variant="default"
              size="lg"
              aria-label="Log out"
              title="Log out"
            >
              <IconLogout stroke={1.5} />
            </ActionIcon>
          )}
          {authenticated === false && (
            <ActionIcon
              onClick={handleLogin}
              variant="default"
              size="lg"
              aria-label="Log in"
              title="Log in"
            >
              <IconLogin stroke={1.5} />
            </ActionIcon>
          )}
          <ActionIcon
            onClick={toggleColorScheme}
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
          >
            {computedColorScheme === 'dark' ? (
              <IconSun stroke={1.5} color="yellow" />
            ) : (
              <IconMoon stroke={1.5} color="violet" />
            )}
          </ActionIcon>
        </Flex>
      </div>
      <DownloadPluginModal opened={downloadOpened} onClose={closeDownload} />
    </Box>
  );
}
