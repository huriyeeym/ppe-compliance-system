import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Globe, Building2, Loader, AlertTriangle } from 'lucide-react'
import MultiDomainOverview from '../components/dashboard/MultiDomainOverview'
import { useDomain } from '../context/DomainContext'
import { logger } from '../lib/utils/logger'

export default function SystemOverview() {
  const { domains, setSelectedDomain } = useDomain()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load initial data if needed
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Loader className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-body text-gray-600">Loading system overview...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <Globe className="w-7 h-7 text-[#405189]" />
              System Overview
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Multi-domain PPE compliance monitoring across all sites
            </p>
          </div>
          <Link
            to="/"
            className="btn-secondary flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Domain View
          </Link>
        </div>
      </div>

      {/* Multi-Domain Overview */}
      <MultiDomainOverview
        onDomainSelect={(domain) => {
          setSelectedDomain(domain)
          // Navigate to dashboard with selected domain
          window.location.href = '/'
        }}
      />
    </div>
  )
}

