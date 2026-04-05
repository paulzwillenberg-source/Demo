import { useState } from 'react';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useStore } from '../../stores/useStore';

export default function AuthPage() {
  const { login } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const body = mode === 'login' ? { email, password } : { email, name, password };
      const { data } = await api.post(endpoint, body);
      login(data.user, data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full pl-9 pr-3 py-2.5 text-[13px] rounded-lg border outline-none transition-colors";
  const inputStyle = {
    background: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'var(--color-brand)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            PMIP
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Personal Media Intelligence Platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border p-6 shadow-sm"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

          {/* Tab toggle */}
          <div className="flex rounded-lg p-0.5 mb-5"
            style={{ background: 'var(--color-bg)' }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-1.5 text-[12px] font-semibold rounded-md transition-all"
                style={{
                  background: mode === m ? 'var(--color-surface)' : 'transparent',
                  color: mode === m ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Name field — signup only */}
            {mode === 'signup' && (
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className={inputClass}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-brand)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputClass}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--color-brand)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Password (min. 8 characters)' : 'Password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={`${inputClass} pr-9`}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--color-brand)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: 'var(--color-text-muted)' }}>
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg"
                style={{ background: 'rgba(232,64,64,0.08)', color: 'var(--color-alert)' }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold mt-1 flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
              style={{ background: 'var(--color-brand)', color: '#fff' }}>
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                : mode === 'login' ? 'Sign in' : 'Create account'
              }
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] mt-5" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'login'
            ? <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }}
                  className="font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                  Sign up
                </button></>
            : <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }}
                  className="font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                  Sign in
                </button></>
          }
        </p>
      </div>
    </div>
  );
}
