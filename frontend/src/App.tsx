import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
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
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
