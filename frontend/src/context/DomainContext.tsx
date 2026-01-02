import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { logger } from '../lib/utils/logger'

interface DomainContextType {
  selectedDomain: Domain | null
  domains: Domain[]
  setSelectedDomain: (domain: Domain | null) => void
  loading: boolean
}

const DomainContext = createContext<DomainContextType | undefined>(undefined)

export function DomainProvider({ children }: { children: ReactNode }) {
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDomains = async () => {
      try {
        const domainList = await domainService.getActive()
        setDomains(domainList)
        
        // Restore from localStorage or select first active domain
        const savedDomainId = localStorage.getItem('selectedDomainId')
        if (savedDomainId) {
          const saved = domainList.find(d => d.id === Number(savedDomainId))
          if (saved) {
            setSelectedDomain(saved)
            return
          }
        }
        
        // Default to construction domain or first active
        const defaultDomain = domainList.find(d => d.type === 'construction') || domainList[0]
        if (defaultDomain) {
          setSelectedDomain(defaultDomain)
        }
      } catch (err) {
        logger.error('Failed to load domains', err)
      } finally {
        setLoading(false)
      }
    }
    loadDomains()
  }, [])

  useEffect(() => {
    if (selectedDomain) {
      localStorage.setItem('selectedDomainId', String(selectedDomain.id))
    }
  }, [selectedDomain])

  return (
    <DomainContext.Provider value={{ selectedDomain, domains, setSelectedDomain, loading }}>
      {children}
    </DomainContext.Provider>
  )
}

export function useDomain() {
  const context = useContext(DomainContext)
  if (context === undefined) {
    throw new Error('useDomain must be used within a DomainProvider')
  }
  return context
}

