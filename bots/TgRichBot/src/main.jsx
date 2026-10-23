import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/theme.css'
import './styles/app.css'
import 'katex/dist/katex.min.css'

createRoot(document.getElementById('root')).render(<App />)
