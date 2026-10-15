import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/** First run: onboarding. Signed out: login. Signed in: straight to the game lobby. */
export default function Index() {
  const { token, onboarded } = useAuth();
  if (token) return <Redirect href="/play" />;
  return <Redirect href={onboarded ? '/login' : '/onboarding'} />;
}
