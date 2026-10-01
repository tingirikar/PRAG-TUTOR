import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// @ts-ignore
import { installMockApi } from './mock/mockApi'

if (import.meta.env.VITE_USE_MOCK === 'true') {
  installMockApi()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
