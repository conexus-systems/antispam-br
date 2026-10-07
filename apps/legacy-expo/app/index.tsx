import { Redirect } from 'expo-router';
import { useAppState } from '../src/services/store';

export default function Index() {
  const onboardingDone = useAppState((s) => s.onboardingDone);
  return <Redirect href={onboardingDone ? '/(tabs)' : '/onboarding'} />;
}
