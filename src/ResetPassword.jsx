import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let active = true

    async function prepareRecoverySession() {
      try {
        // Supabase may send a PKCE authorization code in the URL.
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            throw error
          }

          // Remove the recovery code from the browser address bar.
          window.history.replaceState(
            {},
            document.title,
            '/reset-password'
          )
        }

        // Wait for Supabase to establish the recovery session.
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (!active) return

        if (data.session) {
          setSessionReady(true)
        } else {
          setMessage(
            'This password-reset link is invalid or has expired. Please return to sign in and request a new reset link.'
          )
          setMessageType('error')
        }
      } catch (error) {
        if (!active) return

        console.error('Password recovery session error:', error)

        setMessage(
          'We could not verify your reset link. It may have expired. Please return to sign in and request a new reset link.'
        )
        setMessageType('error')
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }

    // Listen for Supabase recovery events as well.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (
        event === 'PASSWORD_RECOVERY' ||
        (event === 'SIGNED_IN' && session)
      ) {
        setSessionReady(true)
        setMessage('')
        setMessageType('')
      }
    })

    prepareRecoverySession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setMessageType('')

    if (!sessionReady) {
      setMessage(
        'Your recovery session is not ready. Please open the latest password-reset email link again.'
      )
      setMessageType('error')
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long.')
      setMessageType('error')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      setMessageType('error')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      setMessage(
        'Password updated successfully! You can now return to sign in with your new password.'
      )
      setMessageType('success')
      setPassword('')
      setConfirmPassword('')
      setSessionReady(false)
    } catch (error) {
      console.error('Password update error:', error)

      setMessage(
        error.message ||
          'Unable to reset your password. Please request a new reset link.'
      )
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-form-panel">
          <div className="auth-form-inner">
            <div className="auth-mobile-brand">
              <div className="auth-brand-icon">✓</div>
              <span>TaskFlow</span>
            </div>

            <div className="auth-heading">
              <span className="auth-form-eyebrow">
                ACCOUNT RECOVERY
              </span>
              <h2>Create a new password</h2>
              <p>Choose a new password for your TaskFlow account.</p>
            </div>

            {checkingSession ? (
              <p role="status">Verifying your reset link...</p>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                {sessionReady && (
                  <>
                    <div className="auth-field">
                      <label htmlFor="new-password">
                        New password
                      </label>
                      <div className="auth-input-wrap">
                        <input
                          id="new-password"
                          type="password"
                          value={password}
                          onChange={(e) =>
                            setPassword(e.target.value)
                          }
                          placeholder="At least 6 characters"
                          minLength={6}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                    </div>

                    <div className="auth-field">
                      <label htmlFor="confirm-password">
                        Confirm new password
                      </label>
                      <div className="auth-input-wrap">
                        <input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) =>
                            setConfirmPassword(e.target.value)
                          }
                          placeholder="Enter your password again"
                          minLength={6}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                    </div>

                    <button
                      className="auth-submit"
                      type="submit"
                      disabled={loading}
                    >
                      {loading
                        ? 'Updating...'
                        : 'Update Password'}
                    </button>
                  </>
                )}

                {message && (
                  <div
                    className={`auth-message ${messageType}`}
                    role="status"
                    aria-live="polite"
                  >
                    {message}
                  </div>
                )}
              </form>
            )}

            <p className="auth-switch">
              Remember your password?
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                Back to sign in
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}