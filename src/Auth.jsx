import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)

  async function handleForgotPassword(e) {
    e.preventDefault()
    setMessage('')
    setMessageType('')

    if (!email.trim()) {
      setMessage('Please enter your email address first.')
      setMessageType('error')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      )

      if (error) throw error

      setMessage('If an account exists for this email, a password reset link will be sent. Please check your inbox.')
      setMessageType('success')
    } catch (error) {
      setMessage(error.message || 'Could not send the reset email. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    setMessageType('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (error) throw error

        setMessage(
          data.session
            ? 'Your account has been created successfully!'
            : 'Account created! Please check your email to confirm your account.'
        )
        setMessageType('success')
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      {forgotPassword ? (
        <div className="auth-shell">
          <section className="auth-form-panel">
            <div className="auth-form-inner">
              <div className="auth-mobile-brand">
                <div className="auth-brand-icon">✓</div>
                <span>TaskFlow</span>
              </div>

              <div className="auth-heading">
                <span className="auth-form-eyebrow">ACCOUNT RECOVERY</span>
                <h2>Reset your password</h2>
                <p>
                  Forgot your password? Enter your email and we'll send you
                  instructions to reset it.
                </p>
              </div>

              <form
                className="auth-form"
                onSubmit={handleForgotPassword}
              >
                <div className="auth-field">
                  <label htmlFor="reset-email">Email address</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      ✉
                    </span>

                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {message && (
                  <div
                    className={`auth-message ${messageType}`}
                    role="status"
                    aria-live="polite"
                  >
                    {message}
                  </div>
                )}

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <p className="auth-switch">
                Remember your password?

                <button
                  type="button"
                  onClick={() => {
                    setForgotPassword(false)
                    setMessage('')
                    setMessageType('')
                  }}
                >
                  Back to sign in
                </button>
              </p>

              <p className="auth-security-note">
                <span aria-hidden="true">🔒</span>
                Your account security matters.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <div className="auth-shell">
          {/* Left welcome panel */}
          <section className="auth-visual">
            <div className="auth-brand">
              <div className="auth-brand-icon">✓</div>
              <span>TaskFlow</span>
            </div>

            <div className="auth-visual-content">
              <span className="auth-eyebrow">
                YOUR DAY, ORGANIZED
              </span>

              <h1>
                Make room for
                <br />
                <span>what matters.</span>
              </h1>

              <p>
                Plan your day, track your progress, and turn your goals
                into accomplishments.
              </p>

              <div className="auth-feature-list">
                <div className="auth-feature">
                  <span className="auth-feature-icon">✓</span>
                  <span>Stay organized and focused</span>
                </div>

                <div className="auth-feature">
                  <span className="auth-feature-icon">◷</span>
                  <span>Keep track of important deadlines</span>
                </div>

                <div className="auth-feature">
                  <span className="auth-feature-icon">↗</span>
                  <span>Celebrate your daily progress</span>
                </div>
              </div>
            </div>

            <div className="auth-visual-footer">
              A little progress every day adds up.
            </div>

            <div className="auth-decoration auth-decoration-one" />
            <div className="auth-decoration auth-decoration-two" />
          </section>

          {/* Right login/signup panel */}
          <section className="auth-form-panel">
            <div className="auth-form-inner">
              <div className="auth-mobile-brand">
                <div className="auth-brand-icon">✓</div>
                <span>TaskFlow</span>
              </div>

              <div className="auth-heading">
                <span className="auth-form-eyebrow">
                  {isLogin ? 'WELCOME BACK' : 'GET STARTED'}
                </span>

                <h2>
                  {isLogin ? 'Sign in to TaskFlow' : 'Create your account'}
                </h2>

                <p>
                  {isLogin
                    ? 'Welcome back! Enter your details to continue.'
                    : 'Create an account and start organizing your day.'}
                </p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="auth-email">Email address</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      ✉
                    </span>

                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-password">Password</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      ◈
                    </span>

                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        isLogin ? 'Enter your password' : 'At least 6 characters'
                      }
                      autoComplete={
                        isLogin ? 'current-password' : 'new-password'
                      }
                      minLength={6}
                      required
                    />

                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="auth-forgot-row">
                    <button
                      type="button"
                      className="auth-forgot-button"
                      onClick={() => {
                        setForgotPassword(true)
                        setMessage('')
                        setMessageType('')
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
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

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? 'Please wait...'
                    : isLogin
                      ? 'Sign In'
                      : 'Create Account'}

                  {!loading && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <div className="auth-divider">
                <span>YOUR PRODUCTIVITY JOURNEY</span>
              </div>

              <p className="auth-switch">
                {isLogin
                  ? "Don't have an account yet?"
                  : 'Already have an account?'}

                <button
                  type="button"
                  onClick={() => {
                    setIsLogin((value) => !value)
                    setMessage('')
                    setMessageType('')
                    setPassword('')
                    setShowPassword(false)
                  }}
                >
                  {isLogin ? 'Create account' : 'Sign in'}
                </button>
              </p>

              <p className="auth-security-note">
                <span aria-hidden="true">🔒</span>
                Your tasks. Your space. Your progress.
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

