import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

import './lib/api.interceptors'

import { AppRouter } from './router/RouterProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)
