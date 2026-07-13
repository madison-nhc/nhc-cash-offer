import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const GOLD = '#B8892A'
const CHARCOAL = '#2C2C2C'
const RED = '#B22020'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// unauthorized: true when a Google sign-in succeeded but the email isn't on
// the cashoffer_users allowlist — this app allows any Google account to
// attempt sign-in (no @nhcnow.com domain restriction) since outside parties
// like the lender need access too, so the allowlist table is the real gate.
export default function LoginPage({ unauthorized, email, onSignOut }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#EDEAE3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '48px 44px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        border: '0.5px solid #D6D2CA',
      }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px' }}>
          <img
            src="/nhc-logo.svg"
            width={72}
            height={72}
            alt="NHC"
            style={{ objectFit: 'contain', display: 'block' }}
          />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: CHARCOAL, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Cash Offer Hub
            </div>
          </div>
        </div>

        {unauthorized ? (
          <>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: CHARCOAL, marginBottom: '6px' }}>
                Access not set up yet
              </div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                {email} isn't on the access list for this app.
              </div>
            </div>
            <div style={{ marginBottom: '20px', padding: '12px', background: '#FEF2F2', borderRadius: '8px', border: `1px solid ${RED}33` }}>
              <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.6, textAlign: 'center' }}>
                Ask Madison, Bob, Eric, or Blaire to add your email.
              </div>
            </div>
            <button
              onClick={onSignOut}
              style={{
                width: '100%', padding: '12px 16px',
                background: '#fff', border: '1px solid #D6D2CA', borderRadius: '8px',
                cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: CHARCOAL, fontFamily: 'inherit',
              }}
            >
              Sign out and try a different account
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: CHARCOAL, marginBottom: '6px' }}>
                Sign in to continue
              </div>
              <div style={{ fontSize: '13px', color: '#888' }}>
                Access is limited to approved accounts
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '12px', color: RED, marginBottom: '16px', padding: '10px 12px', background: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: '100%', padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                background: loading ? '#f5f5f5' : '#fff',
                border: '1px solid #D6D2CA',
                borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600, color: CHARCOAL,
                fontFamily: 'inherit', transition: 'all 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)' }}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
            >
              <GoogleIcon />
              {loading ? 'Redirecting...' : 'Sign in with Google'}
            </button>

            <div style={{ marginTop: '20px', padding: '12px', background: '#FAF6EF', borderRadius: '8px', border: `1px solid ${GOLD}33` }}>
              <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.6, textAlign: 'center' }}>
                Access restricted to <strong style={{ color: GOLD }}>approved</strong> accounts only.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
