import { QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

import './lib/api.interceptors'

import { queryClient } from './lib/queryClient'
import { AppRouter } from './router/RouterProvider'
import { ThemeProvider } from './components/theme/ThemeProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
