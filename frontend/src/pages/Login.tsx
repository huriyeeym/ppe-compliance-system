import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { authService } from '../lib/api/services/authService'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('admin@safevision.io')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await authService.login(email, password)
      login(response.access_token, response.user)
      navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0); opacity: 0.3; }
          25% { transform: translate(10px, -15px); opacity: 0.5; }
          50% { transform: translate(-10px, -25px); opacity: 0.4; }
          75% { transform: translate(15px, -10px); opacity: 0.6; }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); opacity: 0.4; }
          25% { transform: translate(-15px, 10px); opacity: 0.6; }
          50% { transform: translate(15px, 20px); opacity: 0.3; }
          75% { transform: translate(-10px, 15px); opacity: 0.5; }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); opacity: 0.5; }
          25% { transform: translate(20px, 10px); opacity: 0.3; }
          50% { transform: translate(-20px, -10px); opacity: 0.6; }
          75% { transform: translate(10px, -20px); opacity: 0.4; }
        }
        .floating-dots {
          animation: float 20s ease-in-out infinite;
        }
        .floating-dots-2 {
          animation: float2 25s ease-in-out infinite;
        }
        .floating-dots-3 {
          animation: float3 30s ease-in-out infinite;
        }
      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff' }}>
      {/* Top Hero Section - Velzon Exact Style */}
      <div style={{ position: 'relative', height: '40vh', backgroundColor: '#405189', overflow: 'hidden' }}>
        {/* Floating Dots Effect - Velzon Style (animated, scattered) */}
        <div className="floating-dots" style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 15% 25%, rgba(255,255,255,0.7) 1.5px, transparent 1.5px),
            radial-gradient(circle at 35% 15%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 55% 35%, rgba(255,255,255,0.6) 1.5px, transparent 1.5px),
            radial-gradient(circle at 75% 20%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(circle at 85% 45%, rgba(255,255,255,0.7) 1.5px, transparent 1.5px),
            radial-gradient(circle at 25% 55%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 45% 65%, rgba(255,255,255,0.6) 1.5px, transparent 1.5px),
            radial-gradient(circle at 65% 75%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(circle at 90% 60%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 10% 70%, rgba(255,255,255,0.6) 1.5px, transparent 1.5px)
          `,
          backgroundSize: '100% 100%',
          opacity: 0.35
        }}></div>
        <div className="floating-dots-2" style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 30% 85%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(circle at 50% 10%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 70% 50%, rgba(255,255,255,0.7) 1.5px, transparent 1.5px),
            radial-gradient(circle at 20% 40%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 60% 90%, rgba(255,255,255,0.6) 1.5px, transparent 1.5px),
            radial-gradient(circle at 80% 30%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 95% 15%, rgba(255,255,255,0.6) 1.5px, transparent 1.5px),
            radial-gradient(circle at 5% 50%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(circle at 50% 5%, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%',
          opacity: 0.35
        }}></div>

        {/* Brand Text - Top Center (Velzon Exact Position and Size) */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10 }}>
          <h1 style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSize: '3.25rem',
            lineHeight: '1.2',
            fontWeight: '600',
            color: '#ffffff',
            margin: 0,
            padding: 0,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            textShadow: 'none'
          }}>
            SAFEVISION
          </h1>
          <p style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: '400',
            marginTop: '0.375rem',
            marginBottom: 0,
            padding: 0,
            letterSpacing: '0.01em'
          }}>
            PPE & Industrial Safety Monitoring
          </p>
        </div>

        {/* Additional decorative blur elements */}
        <div style={{ position: 'absolute', top: '2.5rem', right: '2.5rem', width: '16rem', height: '16rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%', filter: 'blur(60px)' }}></div>
        <div style={{ position: 'absolute', bottom: '2.5rem', left: '2.5rem', width: '20rem', height: '20rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%', filter: 'blur(60px)' }}></div>
      </div>

      {/* Wave Transition - Velzon Exact */}
      <div style={{ position: 'relative', marginTop: '-1px' }}>
        <svg
          style={{ width: '100%', height: '5rem' }}
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 40C840 50 960 70 1080 80C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="#405189"
          />
        </svg>
      </div>

      {/* Bottom Light Area - Velzon Exact */}
      <div style={{ flex: 1, backgroundColor: '#ffffff', position: 'relative' }}>
        {/* Centered Login Card - Velzon Exact Dimensions and Position */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -33.333%)', width: '100%', maxWidth: '420px', paddingLeft: '1.5rem', paddingRight: '1.5rem', zIndex: 20 }}>
          <div style={{ 
            backgroundColor: '#ffffff',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {/* Card Header - SafeVision Branding */}
            <div style={{ textAlign: 'center', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              <h1 style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '1.75rem',
                lineHeight: '1.2',
                color: '#212529',
                fontWeight: '600',
                margin: 0,
                marginBottom: '0.25rem',
                letterSpacing: '-0.01em'
              }}>
                SafeVision
              </h1>
              <p style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: '#6c757d',
                fontWeight: '400',
                margin: 0,
                marginBottom: '0.75rem'
              }}>
                Industrial Safety Management
              </p>
              <p style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: '#878A99',
                fontWeight: '400',
                margin: 0
              }}>
                Sign in to access the admin panel
              </p>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', marginTop: '1rem' }} onSubmit={handleSubmit}>
              {/* Email Field - Velzon Exact Style */}
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
                      e.target.style.borderColor = '#0AB39C';
                      e.target.style.boxShadow = '0 0 0 0.25rem rgba(10, 179, 156, 0.25)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#ced4da';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <style>{`
                    input::placeholder {
                      color: #878A99;
                    }
                  `}</style>
                </div>
              </div>

              {/* Password Field - Velzon Exact Style */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ 
                    display: 'block',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: '400',
                    color: '#212529'
                  }}>
                    Password
                  </label>
                  <button
                    type="button"
                    style={{ 
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontSize: '0.875rem',
                      color: '#6c757d',
                      lineHeight: '1.5',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'none',
                      float: 'right'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Forgot password?
                  </button>
                </div>
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
                      e.target.style.borderColor = '#0AB39C';
                      e.target.style.boxShadow = '0 0 0 0.25rem rgba(10, 179, 156, 0.25)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#ced4da';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              </div>

              {/* Remember Me Checkbox - Velzon Exact Style */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: '1rem',
                    height: '1rem',
                    marginTop: '0',
                    marginRight: '0.5rem',
                    cursor: 'pointer',
                    accentColor: '#0d6efd'
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
                  padding: '1rem',
                  backgroundColor: 'rgba(240, 101, 72, 0.1)',
                  border: '1px solid rgba(240, 101, 72, 0.3)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
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

              {/* Sign In Button - Velzon Exact Style (btn-success = teal in Velzon) */}
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ 
                    width: '100%',
                    backgroundColor: '#0AB39C',
                    color: '#ffffff',
                    paddingTop: '0.625rem',
                    paddingBottom: '0.625rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: '400',
                    lineHeight: '1.5',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease-in-out',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#099382';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#0AB39C';
                    }
                  }}
                >
                {loading ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
                </button>
              </div>
            </form>

            {/* Divider - Velzon Exact Style (NO "Sign In with" text) */}
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <p style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.875rem',
                fontWeight: '400',
                color: '#6c757d',
                lineHeight: '1.5',
                margin: 0,
                marginBottom: 0
              }}>
                Don't have an account? Please contact your system administrator to create one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

