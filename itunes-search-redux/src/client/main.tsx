import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { makeStore } from './store';
import ThemeProvider from './components/ThemeProvider';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
createRoot(container).render(
  <Provider store={makeStore()}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </Provider>,
);
