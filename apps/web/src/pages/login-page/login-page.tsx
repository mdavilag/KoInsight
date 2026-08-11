import { Button, Card, Center, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { FormEvent, JSX, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../auth/auth-context';
import { Logo } from '../../components/logo/logo';
import { RoutePath } from '../../routes';

export function LoginPage(): JSX.Element {
  const { authenticated, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in — no reason to show the form.
  if (authenticated) {
    return <Navigate to={RoutePath.HOME} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const ok = await login(username, password);
      if (ok) {
        navigate(RoutePath.HOME, { replace: true });
      } else {
        setError('Invalid username or password.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center h="100vh" p="md">
      <Card withBorder shadow="sm" padding="xl" radius="md" w={360} maw="100%">
        <Stack align="center" mb="lg">
          <Logo />
        </Stack>
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="admin"
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              autoFocus
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
            <Button type="submit" loading={loading} fullWidth>
              Sign in
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
