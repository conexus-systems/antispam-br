/**
 * Compat: o app usa expo-router (app/). Este arquivo existe apenas como
 * fallback de registro e redireciona para a rota raiz.
 */
import { Text } from 'react-native';
import { Link } from 'expo-router';

export default function App() {
  return (
    <Link href="/" style={{ marginTop: 80, color: '#22C55E' }}>
      Abrir AntiSpam BR
    </Link>
  );
}
