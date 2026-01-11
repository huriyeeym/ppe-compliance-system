import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, User, Building2, Check } from 'lucide-react'
import { authService, domainService, type Domain } from '../lib/api/services'
import { useAuth } from '../context/AuthContext'
import zxcvbn from 'zxcvbn'
import Balatro from '../components/Balatro'
import FuzzyText from '../components/FuzzyText'
import workerIcon from '../assets/worker.png'
import powerPlantIcon from '../assets/power-plant.png'
import mineIcon from '../assets/mine.png'
import warehouseIcon from '../assets/warehouse.png'

type ViewMode = 'login' | 'signup' | 'domain-select' | 'forgot-password' | 'forgot-password-code'

export default function Login() {
  const [viewMode, setViewMode] = useState<ViewMode>('login')
  const [email, setEmail] = useState('admin@safevision.io')
  const [password, setPassword] = useState('admin123')
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [selectedDomains, setSelectedDomains] = useState<number[]>([])
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [tempUser, setTempUser] = useState<any>(null)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordCode, setForgotPasswordCode] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  // Sync viewMode with URL on mount and when URL changes (browser back/forward)
  useEffect(() => {
    const path = location.pathname
    if (path === '/signup') {
      if (viewMode !== 'signup') {
        // Clear form fields when switching to signup
        setEmail('')
        setPassword('')
        setFullName('')
        setOrganizationName('')
        setConfirmPassword('')
        setViewMode('signup')
      }
    } else if (path === '/forgot-password') {
      if (viewMode !== 'forgot-password' && viewMode !== 'forgot-password-code') {
        setViewMode('forgot-password')
      }
    } else if (path === '/sign-in') {
      if (viewMode !== 'login' && viewMode !== 'domain-select') {
        setViewMode('login')
      }
    }
  }, [location.pathname]) // Only depend on pathname, not viewMode to avoid loops

  // Update URL when viewMode changes programmatically (except for domain-select and forgot-password-code)
  useEffect(() => {
    // Only update URL if it's different to avoid loops
    if (viewMode === 'signup' && location.pathname !== '/signup') {
      navigate('/signup', { replace: true })
    } else if (viewMode === 'forgot-password' && location.pathname !== '/forgot-password') {
      navigate('/forgot-password', { replace: true })
    } else if (viewMode === 'login' && location.pathname !== '/sign-in' && location.pathname !== '/signup' && location.pathname !== '/forgot-password') {
      navigate('/sign-in', { replace: true })
    }
    // Note: domain-select and forgot-password-code don't change URL
  }, [viewMode]) // Only depend on viewMode, not location.pathname to avoid loops

  // Load domains for domain selection
  useEffect(() => {
    if (viewMode === 'domain-select') {
      loadDomains()
    }
  }, [viewMode])

  const loadDomains = async () => {
    try {
      const domainList = await domainService.getAll()
      // Filter to show only the 4 integrated domains: Construction, Manufacturing, Mining, Warehouse
      const allowedDomainTypes = ['construction', 'manufacturing', 'mining', 'warehouse']
      const filteredDomains = domainList.filter(domain => 
        allowedDomainTypes.includes(domain.type)
      )
      setDomains(filteredDomains)
      // Don't auto-select - let user choose
    } catch (err) {
      console.error('Failed to load domains:', err)
      setError('Failed to load domains. Please try again.')
    }
  }

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await authService.login(email, password)
      // Direct login without domain selection
      login(response.access_token, response.user)
      navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const validateEmail = (email: string): { valid: boolean; message: string } => {
    // Disposable email domains to block
    const disposableEmailDomains = [
      'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'throwaway.email', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
      'yopmail.com', 'getnada.com', 'maildrop.cc', 'sharklasers.com'
    ]

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address' }
    }

    const domain = email.split('@')[1]?.toLowerCase()

    if (!domain) {
      return { valid: false, message: 'Invalid email format' }
    }

    if (disposableEmailDomains.includes(domain)) {
      return { valid: false, message: 'Disposable email addresses are not allowed. Please use a permanent email' }
    }

    // Check for common typos in popular domains
    const commonTypos: { [key: string]: string } = {
      'gmial.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'gmil.com': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'outllook.com': 'outlook.com',
      'hotmial.com': 'hotmail.com'
    }

    if (commonTypos[domain]) {
      return { valid: false, message: `Did you mean ${email.split('@')[0]}@${commonTypos[domain]}?` }
    }

    return { valid: true, message: '' }
  }

  const validatePassword = (pwd: string): { valid: boolean; message: string; score?: number } => {
    // Minimum length check
    if (pwd.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long', score: 0 }
    }

    // Use zxcvbn for professional password strength analysis
    const result = zxcvbn(pwd, [email, fullName]) // Include user inputs to prevent using personal info in password

    // Require score of at least 3 (out of 4) for a strong password
    // 0 = too guessable, 1 = very guessable, 2 = somewhat guessable, 3 = safely unguessable, 4 = very unguessable
    if (result.score < 3) {
      // Get the most helpful feedback message
      const warning = result.feedback.warning || 'Password is too weak'
      const suggestion = result.feedback.suggestions[0] || 'Try a longer password with mixed characters'
      return {
        valid: false,
        message: `${warning}. ${suggestion}`,
        score: result.score
      }
    }

    return { valid: true, message: '', score: result.score }
  }

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    // Email validation
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      setError(emailValidation.message)
      setLoading(false)
      return
    }

    // Name validation
    if (fullName.trim().length < 2) {
      setError('Please enter your full name')
      setLoading(false)
      return
    }

    if (!fullName.includes(' ')) {
      setError('Please enter both first and last name')
      setLoading(false)
      return
    }

    // Password validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      setError(passwordValidation.message)
      setLoading(false)
      return
    }

    try {
      const response = await authService.register(email, password, fullName, organizationName)
      
      // Check if user is ADMIN (first user) - they need to select domains
      if (response.user.role === 'admin' || response.user.role === 'super_admin') {
        // First user (ADMIN) - show domain selection
        setTempToken(response.access_token)
        setTempUser(response.user)
        setViewMode('domain-select')
      } else {
        // Regular user (VIEWER/OPERATOR) - no domain selection, direct login
        // Save token to localStorage
        localStorage.setItem('auth_token', response.access_token)
        
        // Complete login
        login(response.access_token, response.user)
        
        // Navigate to dashboard
        navigate('/')
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDomainSelection = async () => {
    if (selectedDomains.length === 0) {
      setError('Please select at least one domain')
      return
    }

    if (selectedDomains.length > 4) {
      setError('You can select maximum 4 domains')
      return
    }

    setError(null)
    setLoading(true)

    try {
      // Save token to localStorage temporarily so httpClient can use it
      if (tempToken) {
        localStorage.setItem('auth_token', tempToken)
      }

      // Save domain selection to backend
      await authService.selectDomains(selectedDomains)
      
      // Save to localStorage
      localStorage.setItem('selectedDomainIds', JSON.stringify(selectedDomains))
      localStorage.setItem('selectedDomain', selectedDomains[0].toString())

      // Refresh user data to get updated domains
      try {
        const updatedUser = await authService.me()
        // Complete login with updated user data (includes domains)
        if (tempToken) {
          login(tempToken, updatedUser)
        }
      } catch (err) {
        // If me() fails, still login with original user data
        if (tempToken && tempUser) {
          login(tempToken, tempUser)
        }
      }
      navigate('/')
    } catch (err: any) {
      // Handle network errors more gracefully
      console.error('Domain selection error:', err)
      if (err?.type === 'NETWORK_ERROR' || !err?.response) {
        setError('Connection error. Please check if the backend server is running at http://localhost:8000 and try again.')
      } else if (err?.type === 'UNAUTHORIZED') {
        setError('Authentication failed. Please try signing up again.')
      } else {
        setError(err?.message || 'Failed to save domain selection. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleDomainSelection = (domainId: number) => {
    setSelectedDomains(prev => {
      if (prev.includes(domainId)) {
        return prev.filter(id => id !== domainId)
      } else {
        if (prev.length >= 4) {
          setError('You can select maximum 4 domains')
          return prev
        }
        setError(null)
        return [...prev, domainId]
      }
    })
  }

  const renderLoginForm = () => (
    <>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleLogin} noValidate>
        {/* Login Field */}
        <div>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Email
          </label>
          <div style={{ position: 'relative' }}>
            <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6c757d', zIndex: 1 }} />
            <input
              type="email"
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9375rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{
              display: 'block',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#212529',
              margin: 0
            }}>
              Password
            </label>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setViewMode('forgot-password')
                setForgotPasswordEmail(email)
                setForgotPasswordMessage(null)
              }}
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.875rem',
                color: '#405189',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              Forgot password?
            </a>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6c757d', zIndex: 1 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '2.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9375rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6c757d',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
                zIndex: 1
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#212529'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6c757d'}
            >
              {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(240, 101, 72, 0.1)',
            border: '1px solid rgba(240, 101, 72, 0.3)',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <AlertCircle style={{ width: '20px', height: '20px', color: '#F06548', flexShrink: 0, marginTop: '2px' }} />
            <p style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '0.875rem',
              color: '#F06548',
              lineHeight: '1.5',
              margin: 0
            }}>{error}</p>
          </div>
        )}

        {/* Remember Me Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{
              width: '1.125rem',
              height: '1.125rem',
              marginRight: '0.5rem',
              cursor: 'pointer',
              accentColor: '#405189'
            }}
          />
          <label htmlFor="remember" style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '400',
            color: '#212529',
            lineHeight: '1.5',
            cursor: 'pointer',
            margin: 0
          }}>
            Remember me
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '0.875rem',
            backgroundColor: 'rgba(240, 101, 72, 0.1)',
            border: '1px solid rgba(240, 101, 72, 0.3)',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <AlertCircle style={{ width: '18px', height: '18px', color: '#F06548', flexShrink: 0, marginTop: '2px' }} />
            <p style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '0.875rem',
              color: '#F06548',
              lineHeight: '1.5',
              margin: 0
            }}>{error}</p>
          </div>
        )}

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: '#495057',
            color: '#ffffff',
            paddingTop: '0.875rem',
            paddingBottom: '0.875rem',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.9375rem',
            fontWeight: '600',
            lineHeight: '1.5',
            borderRadius: '0.75rem',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.65 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#343a40';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#495057';
            }
          }}
        >
          {loading ? (
            <>
              <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>

        {/* Sign Up Link */}
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem',
          color: '#6c757d'
        }}>
          Don't have an account?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // Clear form fields when switching to signup
              setEmail('')
              setPassword('')
              setFullName('')
              setOrganizationName('')
              setConfirmPassword('')
              setError(null)
              setViewMode('signup')
            }}
            style={{
              color: '#405189',
              textDecoration: 'none',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Sign Up
          </a>
        </div>
      </form>

    </>
  )

  const renderSignupForm = () => (
    <>
      <p style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '1rem',
        lineHeight: '1.5',
        color: '#212529',
        fontWeight: '400',
        margin: 0,
        marginBottom: '1.5rem'
      }}>
        Create your account to get started!
      </p>

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleSignup} noValidate>
        {/* Full Name Field */}
        <div>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Full Name
          </label>
          <div style={{ position: 'relative' }}>
            <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6c757d', zIndex: 1 }} />
            <input
              type="text"
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9375rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                if (error) setError(null)
              }}
              required
            />
          </div>
        </div>

        {/* Organization Name Field */}
        <div>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Company/Organization Name
          </label>
          <div style={{ position: 'relative' }}>
            <Building2 style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6c757d', zIndex: 1 }} />
            <input
              type="text"
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9375rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your company name"
              value={organizationName}
              onChange={(e) => {
                setOrganizationName(e.target.value)
                if (error) setError(null)
              }}
              required
            />
          </div>
        </div>

        {/* Email Field */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '400',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6c757d', zIndex: 1 }} />
            <input
              type="email"
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.625rem',
                paddingBottom: '0.625rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.875rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #ced4da',
                borderRadius: '0.375rem',
                outline: 'none',
                transition: 'all 0.15s ease-in-out',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 0.25rem rgba(64, 81, 137, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#ced4da';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null) // Clear error when user types
              }}
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '400',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6c757d', zIndex: 1 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '2.75rem',
                paddingTop: '0.625rem',
                paddingBottom: '0.625rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.875rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #ced4da',
                borderRadius: '0.375rem',
                outline: 'none',
                transition: 'all 0.15s ease-in-out',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 0.25rem rgba(64, 81, 137, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#ced4da';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null) // Clear error when user types
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6c757d',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
                zIndex: 1
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#212529'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6c757d'}
            >
              {showPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
            </button>
          </div>

          {/* Password Strength Indicator (zxcvbn-powered) */}
          {password.length > 0 && (() => {
            const passwordCheck = password.length >= 8 ? zxcvbn(password, [email, fullName]) : null
            const score = passwordCheck?.score ?? 0
            const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
            const strengthColors = ['#F06548', '#F1734F', '#F7B84B', '#405189', '#405189']
            const barWidths = ['20%', '40%', '60%', '80%', '100%']

            return (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                lineHeight: '1.5'
              }}>
                {/* Minimum length check */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.75rem'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: password.length >= 8 ? '#405189' : '#e9ecef',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {password.length >= 8 && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ color: password.length >= 8 ? '#405189' : '#6c757d', fontWeight: '500' }}>
                    At least 8 characters
                  </span>
                </div>

                {/* Password strength bar and label (only show if 8+ chars) */}
                {password.length >= 8 && (
                  <>
                    <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '500', color: '#495057' }}>Password Strength:</span>
                        <span style={{ fontWeight: '600', color: strengthColors[score] }}>{strengthLabels[score]}</span>
                      </div>
                      <div style={{
                        height: '4px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: barWidths[score],
                          backgroundColor: strengthColors[score],
                          transition: 'all 0.3s ease'
                        }}></div>
                      </div>
                    </div>

                    {/* zxcvbn feedback */}
                    {passwordCheck?.feedback && (passwordCheck.feedback.warning || passwordCheck.feedback.suggestions.length > 0) && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: score < 2 ? 'rgba(240, 101, 72, 0.05)' : 'rgba(241, 180, 76, 0.05)',
                        border: `1px solid ${score < 2 ? 'rgba(240, 101, 72, 0.2)' : 'rgba(241, 180, 76, 0.2)'}`,
                        borderRadius: '0.375rem'
                      }}>
                        {passwordCheck.feedback.warning && (
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: '#495057',
                            marginBottom: passwordCheck.feedback.suggestions.length > 0 ? '0.5rem' : '0'
                          }}>
                            {passwordCheck.feedback.warning}
                          </div>
                        )}
                        {passwordCheck.feedback.suggestions.length > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#6c757d' }}>
                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Suggestions:</div>
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                              {passwordCheck.feedback.suggestions.map((suggestion, idx) => (
                                <li key={idx} style={{ marginBottom: '0.15rem' }}>{suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Confirm Password
          </label>
          <div style={{ position: 'relative' }}>
            <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6c757d', zIndex: 1 }} />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '2.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9375rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (error) setError(null)
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6c757d',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
                zIndex: 1
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#212529'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6c757d'}
            >
              {showConfirmPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '0.875rem',
            backgroundColor: 'rgba(240, 101, 72, 0.1)',
            border: '1px solid rgba(240, 101, 72, 0.3)',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <AlertCircle style={{ width: '18px', height: '18px', color: '#F06548', flexShrink: 0, marginTop: '2px' }} />
            <p style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '0.875rem',
              color: '#F06548',
              lineHeight: '1.5',
              margin: 0
            }}>{error}</p>
          </div>
        )}

        {/* Sign Up Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: '#495057',
            color: '#ffffff',
            paddingTop: '0.875rem',
            paddingBottom: '0.875rem',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.9375rem',
            fontWeight: '600',
            lineHeight: '1.5',
            borderRadius: '0.75rem',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.65 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#343a40';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#495057';
            }
          }}
        >
          {loading ? (
            <>
              <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Sign Up</span>
          )}
        </button>
      </form>

    </>
  )

  // Get professional icon for domain
  const getDomainIcon = (domainType: string, isSelected: boolean) => {
    const iconStyle: React.CSSProperties = {
      width: '48px',
      height: '48px',
      objectFit: 'contain',
      filter: isSelected ? 'brightness(0) invert(1)' : 'brightness(0) saturate(100%)',
      opacity: isSelected ? 1 : 0.6
    }
    
    const iconMap: Record<string, React.ReactElement> = {
      construction: <img src={workerIcon} alt="Construction" style={iconStyle} />,
      manufacturing: <img src={powerPlantIcon} alt="Manufacturing" style={iconStyle} />,
      warehouse: <img src={warehouseIcon} alt="Warehouse" style={iconStyle} />,
      mining: <img src={mineIcon} alt="Mining" style={iconStyle} />,
    }
    return iconMap[domainType] || <Building2 className={isSelected ? 'w-12 h-12 text-white' : 'w-12 h-12 text-[#6c757d]'} />
  }

  const renderForgotPasswordEmail = () => (
    <>
      <p style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '1rem',
        lineHeight: '1.5',
        color: '#212529',
        fontWeight: '400',
        margin: 0,
        marginBottom: '1.5rem'
      }}>
        Enter your email to reset your password
      </p>
      {forgotPasswordMessage && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          backgroundColor: forgotPasswordMessage.includes('success') ? '#d4edda' : '#f8d7da',
          color: forgotPasswordMessage.includes('success') ? '#155724' : '#721c24',
          fontSize: '0.875rem'
        }}>
          {forgotPasswordMessage}
        </div>
      )}
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={async (e) => {
        e.preventDefault()
        setForgotPasswordLoading(true)
        setForgotPasswordMessage(null)
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // TODO: Implement actual forgot password API call
        // For now, just proceed to code screen
        setViewMode('forgot-password-code')
        setForgotPasswordLoading(false)
      }} noValidate>
        <div>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Email
          </label>
          <div style={{ position: 'relative' }}>
            <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6c757d', zIndex: 1 }} />
            <input
              type="email"
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9375rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter your email"
              value={forgotPasswordEmail}
              onChange={(e) => {
                setForgotPasswordEmail(e.target.value)
                if (forgotPasswordMessage) setForgotPasswordMessage(null)
              }}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={forgotPasswordLoading}
          style={{
            width: '100%',
            backgroundColor: forgotPasswordLoading ? '#6c757d' : '#495057',
            color: '#ffffff',
            paddingTop: '0.875rem',
            paddingBottom: '0.875rem',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            border: 'none',
            borderRadius: '0.75rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.9375rem',
            fontWeight: '500',
            cursor: forgotPasswordLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            marginTop: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (!forgotPasswordLoading) {
              e.currentTarget.style.backgroundColor = '#343a40';
            }
          }}
          onMouseLeave={(e) => {
            if (!forgotPasswordLoading) {
              e.currentTarget.style.backgroundColor = '#495057';
            }
          }}
        >
          {forgotPasswordLoading ? (
            <>
              <Loader2 style={{ display: 'inline-block', marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
              <span>Sending...</span>
            </>
          ) : (
            <span>Continue</span>
          )}
        </button>
        <div style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem',
          color: '#6c757d'
        }}>
          Remember your password?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              setViewMode('login')
              setForgotPasswordMessage(null)
            }}
            style={{
              color: '#405189',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Sign In
          </a>
        </div>
      </form>
    </>
  )

  const renderForgotPasswordCode = () => (
    <>
      <p style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '1rem',
        lineHeight: '1.5',
        color: '#212529',
        fontWeight: '400',
        margin: 0,
        marginBottom: '1.5rem'
      }}>
        We've sent a verification code to {forgotPasswordEmail}
      </p>
      {forgotPasswordMessage && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          backgroundColor: forgotPasswordMessage.includes('success') ? '#d4edda' : '#f8d7da',
          color: forgotPasswordMessage.includes('success') ? '#155724' : '#721c24',
          fontSize: '0.875rem'
        }}>
          {forgotPasswordMessage}
        </div>
      )}
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={async (e) => {
        e.preventDefault()
        setForgotPasswordLoading(true)
        setForgotPasswordMessage(null)
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // TODO: Implement actual code verification API call
        setForgotPasswordMessage('Code verified successfully! Redirecting...')
        setForgotPasswordLoading(false)
        
        // TODO: Redirect to password reset page
        setTimeout(() => {
          setViewMode('login')
          setForgotPasswordMessage(null)
          setForgotPasswordCode('')
        }, 2000)
      }} noValidate>
        <div>
          <label style={{
            display: 'block',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Verification Code
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              maxLength={6}
              style={{
                width: '100%',
                paddingLeft: '0.75rem',
                paddingRight: '0.75rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '1.5rem',
                color: '#212529',
                lineHeight: '1.5',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '0.75rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                textAlign: 'center',
                letterSpacing: '0.5rem'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#405189';
                e.target.style.boxShadow = '0 0 0 3px rgba(64, 81, 137, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="000000"
              value={forgotPasswordCode}
              onChange={(e) => {
                setForgotPasswordCode(e.target.value.replace(/\D/g, ''))
                if (forgotPasswordMessage) setForgotPasswordMessage(null)
              }}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={forgotPasswordLoading}
          style={{
            width: '100%',
            backgroundColor: forgotPasswordLoading ? '#6c757d' : '#495057',
            color: '#ffffff',
            paddingTop: '0.875rem',
            paddingBottom: '0.875rem',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            border: 'none',
            borderRadius: '0.75rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.9375rem',
            fontWeight: '500',
            cursor: forgotPasswordLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            marginTop: '0.5rem'
          }}
          onMouseEnter={(e) => {
            if (!forgotPasswordLoading) {
              e.currentTarget.style.backgroundColor = '#343a40';
            }
          }}
          onMouseLeave={(e) => {
            if (!forgotPasswordLoading) {
              e.currentTarget.style.backgroundColor = '#495057';
            }
          }}
        >
          {forgotPasswordLoading ? (
            <>
              <Loader2 style={{ display: 'inline-block', marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Verify Code</span>
          )}
        </button>
        <div style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem',
          color: '#6c757d'
        }}>
          Didn't receive the code?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              setViewMode('forgot-password')
              setForgotPasswordCode('')
            }}
            style={{
              color: '#405189',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Resend
          </a>
        </div>
      </form>
    </>
  )

  const renderDomainSelect = () => (
    <>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '1.5rem',
          lineHeight: '1.3',
          color: '#212529',
          fontWeight: '600',
          margin: 0,
          marginBottom: '0.5rem',
          letterSpacing: '-0.01em'
        }}>
          Select everything you need to be customized
        </h2>
        <p style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          color: '#6c757d',
          fontWeight: '400',
          margin: 0
        }}>
          Select {selectedDomains.length > 0 ? `${selectedDomains.length} of up to 4` : '1-4'} industries to customize your safety monitoring experience
        </p>
      </div>

      {/* Domain Cards Grid - 2x2 layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
            {domains.map(domain => {
              const isSelected = selectedDomains.includes(domain.id)
              return (
                <div
                  key={domain.id}
                  onClick={() => toggleDomainSelection(domain.id)}
                  style={{
                    padding: '1.5rem 1rem',
                    backgroundColor: isSelected ? '#10B981' : '#ffffff',
                    border: isSelected ? 'none' : '1px solid #e9ecef',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    position: 'relative',
                    boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.08)',
                    minHeight: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#10B981';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#e9ecef';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {/* Selected Checkmark */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      width: '24px',
                      height: '24px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      <Check className="w-4 h-4 text-[#10B981]" />
                    </div>
                  )}

                  {/* Domain Icon */}
                  <div style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}>
                    {getDomainIcon(domain.type, isSelected)}
                  </div>

                  {/* Domain Name */}
                  <div style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: isSelected ? '#ffffff' : '#212529',
                    lineHeight: '1.4',
                    transition: 'all 0.2s ease'
                  }}>
                    {domain.name}
                  </div>
                </div>
              )
            })}
          </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(240, 101, 72, 0.1)',
          border: '1px solid rgba(240, 101, 72, 0.3)',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle style={{ width: '20px', height: '20px', color: '#F06548', flexShrink: 0, marginTop: '2px' }} />
          <p style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            color: '#F06548',
            lineHeight: '1.5',
            margin: 0
          }}>{error}</p>
        </div>
      )}

      {/* Footer with Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.75rem',
        marginTop: '1.5rem'
      }}>
        <button
          type="button"
          onClick={() => {
            setViewMode('signup')
            setSelectedDomains([])
            setError(null)
          }}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: '#ffffff',
            color: '#6c757d',
            border: '1px solid #e9ecef',
            borderRadius: '0.75rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleDomainSelection}
          disabled={selectedDomains.length === 0 || loading}
          style={{
            padding: '0.625rem 1.5rem',
            backgroundColor: selectedDomains.length === 0 ? '#e9ecef' : '#495057',
            color: selectedDomains.length === 0 ? '#6c757d' : '#ffffff',
            border: 'none',
            borderRadius: '0.75rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: selectedDomains.length === 0 || loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (selectedDomains.length > 0 && !loading) {
              e.currentTarget.style.backgroundColor = '#343a40';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedDomains.length > 0 && !loading) {
              e.currentTarget.style.backgroundColor = '#495057';
            }
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Continue
            </>
          )}
        </button>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        .glitch {
          color: #fff;
          font-size: clamp(2rem, 10vw, 8rem);
          white-space: nowrap;
          font-weight: 900;
          position: relative;
          margin: 0 auto;
          user-select: none;
          cursor: pointer;
        }

        .glitch::after,
        .glitch::before {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          color: #fff;
          background-color: transparent;
          overflow: hidden;
          clip-path: inset(0 0 0 0);
          width: 100%;
          height: 100%;
        }

        .glitch:not(.enable-on-hover)::after {
          left: 10px;
          text-shadow: var(--after-shadow, -10px 0 red);
          animation: animate-glitch var(--after-duration, 3s) infinite linear alternate-reverse;
        }
        .glitch:not(.enable-on-hover)::before {
          left: -10px;
          text-shadow: var(--before-shadow, 10px 0 cyan);
          animation: animate-glitch var(--before-duration, 2s) infinite linear alternate-reverse;
        }

        .glitch.enable-on-hover::after,
        .glitch.enable-on-hover::before {
          content: '';
          opacity: 0;
          animation: none;
        }

        .glitch.enable-on-hover:hover::after {
          content: attr(data-text);
          opacity: 1;
          left: 10px;
          text-shadow: var(--after-shadow, -10px 0 red);
          animation: animate-glitch var(--after-duration, 3s) infinite linear alternate-reverse;
        }
        .glitch.enable-on-hover:hover::before {
          content: attr(data-text);
          opacity: 1;
          left: -10px;
          text-shadow: var(--before-shadow, 10px 0 cyan);
          animation: animate-glitch var(--before-duration, 2s) infinite linear alternate-reverse;
        }

        @keyframes animate-glitch {
          0% {
            clip-path: inset(20% 0 50% 0);
          }
          5% {
            clip-path: inset(10% 0 60% 0);
          }
          10% {
            clip-path: inset(15% 0 55% 0);
          }
          15% {
            clip-path: inset(25% 0 35% 0);
          }
          20% {
            clip-path: inset(30% 0 40% 0);
          }
          25% {
            clip-path: inset(40% 0 20% 0);
          }
          30% {
            clip-path: inset(10% 0 60% 0);
          }
          35% {
            clip-path: inset(15% 0 55% 0);
          }
          40% {
            clip-path: inset(25% 0 35% 0);
          }
          45% {
            clip-path: inset(30% 0 40% 0);
          }
          50% {
            clip-path: inset(20% 0 50% 0);
          }
          55% {
            clip-path: inset(10% 0 60% 0);
          }
          60% {
            clip-path: inset(15% 0 55% 0);
          }
          65% {
            clip-path: inset(25% 0 35% 0);
          }
          70% {
            clip-path: inset(30% 0 40% 0);
          }
          75% {
            clip-path: inset(40% 0 20% 0);
          }
          80% {
            clip-path: inset(20% 0 50% 0);
          }
          85% {
            clip-path: inset(10% 0 60% 0);
          }
          90% {
            clip-path: inset(15% 0 55% 0);
          }
          95% {
            clip-path: inset(25% 0 35% 0);
          }
          100% {
            clip-path: inset(30% 0 40% 0);
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: #878A99;
        }
      `}</style>
      
      <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f8f9fa' }}>
          {/* Left Side - Green Background with Balatro effect */}
          <div style={{
            flex: '0 0 60%',
            backgroundColor: (viewMode === 'login' || viewMode === 'forgot-password' || viewMode === 'forgot-password-code') ? '#a7d2a0' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Balatro Background Effect - Different colors for login, signup, and forgot password */}
            {(viewMode === 'login' || viewMode === 'forgot-password' || viewMode === 'forgot-password-code') && (
              <Balatro
                spinRotation={-2.0}
                spinSpeed={7.0}
                offset={[0.0, 0.0]}
                color1="#4CAF50"
                color2="#000000"
                color3="#162325"
                contrast={3.5}
                lighting={0.4}
                spinAmount={0.25}
                pixelFilter={745.0}
                spinEase={1.0}
                isRotate={false}
                mouseInteraction={true}
              />
            )}
            {(viewMode === 'signup' || viewMode === 'domain-select') && (
              <Balatro
                spinRotation={-2.0}
                spinSpeed={7.0}
                offset={[0.0, 0.0]}
                color1="#DE443B"
                color2="#000000"
                color3="#162325"
                contrast={3.5}
                lighting={0.4}
                spinAmount={0.25}
                pixelFilter={745.0}
                spinEase={1.0}
                isRotate={false}
                mouseInteraction={true}
              />
            )}
            {/* SafeVision Logo - Centered with FuzzyText */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              textAlign: 'center',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                display: 'inline-block'
              }}>
                <FuzzyText
                  fontSize="clamp(3rem, 8vw, 6rem)"
                  fontWeight={900}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  color="#fff"
                  enableHover={true}
                  baseIntensity={(viewMode === 'login' || viewMode === 'forgot-password' || viewMode === 'forgot-password-code') ? 0.08 : 0.25}
                  hoverIntensity={(viewMode === 'login' || viewMode === 'forgot-password' || viewMode === 'forgot-password-code') ? 0.25 : 0.7}
                  fuzzRange={30}
                  direction="horizontal"
                  letterSpacing={-2}
                >
                  {viewMode === 'login' && 'Welcome back'}
                  {viewMode === 'signup' && 'Create your account'}
                  {viewMode === 'domain-select' && 'Select your industries'}
                  {(viewMode === 'forgot-password' || viewMode === 'forgot-password-code') && 'Reset your password'}
                </FuzzyText>
              </div>
            </div>
          </div>

          {/* Right Side - White Modal Form */}
          <div style={{
            flex: '0 0 40%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: '#f8f9fa',
            position: 'relative',
            zIndex: 2
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: '700px',
              padding: '3.5rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              position: 'relative'
            }}>
              {/* Close Button (only show if needed) */}
              
              {/* Form Content */}
              {viewMode === 'login' && (
                <>
                  <p style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '1rem',
                    lineHeight: '1.5',
                    color: '#212529',
                    fontWeight: '400',
                    margin: 0,
                    marginBottom: '1.5rem'
                  }}>
                    Welcome back! Please sign in to continue
                  </p>
                  {renderLoginForm()}
                </>
              )}
              {viewMode === 'signup' && renderSignupForm()}
              {viewMode === 'domain-select' && renderDomainSelect()}
              {(viewMode === 'forgot-password' || viewMode === 'forgot-password-code') && (
                <>
                  {viewMode === 'forgot-password' && renderForgotPasswordEmail()}
                  {viewMode === 'forgot-password-code' && renderForgotPasswordCode()}
                </>
              )}
            </div>
          </div>

        </div>
    </>
  )
}
