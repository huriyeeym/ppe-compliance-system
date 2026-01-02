import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import LiveCamera from './pages/LiveCamera'
import Report from './pages/Report'
import Analytics from './pages/Analytics'
import Configure from './pages/Configure'
import Admin from './pages/Admin'
import Login from './pages/Login'
import RequireAuth from './components/auth/RequireAuth'

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#FFFFFF',
            color: '#495057',
            border: '1px solid #E9ECEF',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#0AB39C',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#F06548',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/live-camera" element={<LiveCamera />} />
          <Route path="/report" element={<Report />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/configure" element={<Configure />} />
          <Route
            path="/admin"
            element={
              <RequireAuth role="admin">
                <Admin />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
