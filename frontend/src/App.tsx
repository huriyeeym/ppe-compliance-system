import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import LiveCamera from './pages/LiveCamera'
import Report from './pages/Report'
import Analytics from './pages/Analytics'
import Configure from './pages/Configure'

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
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
