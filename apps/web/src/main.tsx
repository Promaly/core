import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import './styles.css';
import '@promaly/ui/styles.css';
import { router } from './router.js';
import { ThemeProvider } from './theme.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </QueryClientProvider>,
);
