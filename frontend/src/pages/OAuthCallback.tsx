import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi , setAccessToken } from '../lib/api'

export default function OAuthCallback() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    const error = params.get('error')

    if (error) {
      navigate('/login?error=oauth_failed', { replace: true })
      return
    }

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setAccessToken(token)
    authApi.me()
      .then(user => {
        login({ accessToken: token, user })
        navigate('/dashboard', { replace: true })
      })
      .catch(() => navigate('/login?error=oauth_failed', { replace: true }))
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0f1117', color: '#9d8ff9',
      fontFamily: 'monospace', fontSize: 14, gap: 10,
    }}>
      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⬡</span>
      Signing you in...
    </div>
  )
}