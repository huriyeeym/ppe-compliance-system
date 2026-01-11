import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { useAuth } from './AuthContext'
import { authService } from '../lib/api/services/authService'
import { logger } from '../lib/utils/logger'

interface DomainContextType {
  selectedDomain: Domain | null
  domains: Domain[]
  setSelectedDomain: (domain: Domain | null) => void
  loading: boolean
}

const DomainContext = createContext<DomainContextType | undefined>(undefined)

export function DomainProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDomains = async () => {
      try {
        setLoading(true)
        
        // If user is logged in, load only their selected domains
        if (user && token) {
          try {
            // Get user's domains from /auth/me endpoint
            const currentUser = await authService.me()
            if (currentUser.domains && currentUser.domains.length > 0) {
              // Map backend domain format to frontend format
              // Filter to show only the 4 integrated domains
              const allowedDomainTypes = ['construction', 'manufacturing', 'mining', 'warehouse']
              const userDomains: Domain[] = currentUser.domains
                .filter(d => allowedDomainTypes.includes(d.type))
                .map(d => ({
                  id: d.id,
                  name: d.name,
                  type: d.type,
                  icon: d.icon || null,
                  description: d.description || null,
                  status: d.status,
                  created_at: d.created_at,
                  model_status: d.model_status,
                  model_last_updated: d.model_last_updated || null
                }))
              setDomains(userDomains)
              
              // Restore from localStorage or select first user domain
              const savedDomainId = localStorage.getItem('selectedDomainId')
              if (savedDomainId) {
                const saved = userDomains.find(d => d.id === Number(savedDomainId))
                if (saved) {
                  setSelectedDomain(saved)
                  setLoading(false)
                  return
                }
              }
              
              // Default to first user domain
              if (userDomains.length > 0) {
                setSelectedDomain(userDomains[0])
              }
              setLoading(false)
              return
            }
          } catch (err) {
            logger.warn('Failed to load user domains, falling back to all active domains', err)
          }
        }
        
        // Fallback: Load organization domains (should return only 4: Construction, Manufacturing, Mining, Warehouse)
        if (user?.organization_id) {
          try {
            // Load organization-specific domains
            const orgDomains = await domainService.getOrganizationDomains(user.organization_id)
            logger.info(`DomainContext: Loaded ${orgDomains.length} organization domains`, { 
              organization_id: user.organization_id,
              domains: orgDomains.map(d => ({ id: d.id, name: d.name, type: d.type }))
            })
            setDomains(orgDomains)
            
            // Restore from localStorage or select first organization domain
            const savedDomainId = localStorage.getItem('selectedDomainId')
            if (savedDomainId) {
              const saved = orgDomains.find(d => d.id === Number(savedDomainId))
              if (saved) {
                setSelectedDomain(saved)
                setLoading(false)
                return
              }
            }
            
            // Default to first organization domain
            if (orgDomains.length > 0) {
              setSelectedDomain(orgDomains[0])
            }
            setLoading(false)
            return
          } catch (err) {
            logger.warn('Failed to load organization domains, falling back to active domains', err)
          }
        }
        
        // Final fallback: Load only the 4 integrated domains (for non-logged-in users)
        const allDomains = await domainService.getActive()
        const allowedDomainTypes = ['construction', 'manufacturing', 'mining', 'warehouse']
        const domainList = allDomains.filter(domain => allowedDomainTypes.includes(domain.type))
        setDomains(domainList)
        
        // Restore from localStorage or select first active domain
        const savedDomainId = localStorage.getItem('selectedDomainId')
        if (savedDomainId) {
          const saved = domainList.find(d => d.id === Number(savedDomainId))
          if (saved) {
            setSelectedDomain(saved)
            setLoading(false)
            return
          }
        }
        
        // Default to first active domain (don't hardcode 'construction' type)
        if (domainList.length > 0) {
          setSelectedDomain(domainList[0])
        }
      } catch (err) {
        logger.error('Failed to load domains', err)
      } finally {
        setLoading(false)
      }
    }
    loadDomains()
  }, [user, token])

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

