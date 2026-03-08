import { ThemeProvider } from '@ui5/webcomponents-react';
import { AppShell } from './components/layout/AppShell.tsx';

function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
