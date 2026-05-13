import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  paddingTop: '13px',
  paddingBottom: '13px',
  paddingRight: '16px',
  paddingLeft: '44px',
};

const iconWrap: React.CSSProperties = {
  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
  zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/login', { email: email.trim().toLowerCase(), password });
      const { access_token, user_id, unique_id, username } = response.data;
      const userResponse = await api.get(`/user/${user_id}`);
      login(access_token, {
        id: user_id,
        unique_id,
        username,
        email: email.trim().toLowerCase(),
        resume_path: userResponse.data?.resume_path ?? null,
        resume_filename: userResponse.data?.resume_filename ?? null,
        parsed_profile_cache: userResponse.data?.parsed_profile_cache,
        brand_voice_cache: userResponse.data?.brand_voice_cache,
        influencer_scout_cache: userResponse.data?.influencer_scout_cache,
        selected_influencer_cache: userResponse.data?.selected_influencer_cache,
        created_at: userResponse.data?.created_at,
      });
      toast.success(`Welcome back, ${username}`);
      navigate('/studio');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2.5rem 1rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '460px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: '24px', textDecoration: 'none' }}>
            <span className="heading-fraunces" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-dark)' }}>
              Post<span className="text-terracotta">Pilot</span> AI
            </span>
          </Link>
          <h1 className="heading-fraunces" style={{ fontSize: 'clamp(26px,5vw,34px)', fontWeight: 700, margin: '0 0 8px' }}>
            Sign in to your studio
          </h1>
          <p style={{ color: 'var(--text-mid)', margin: 0, fontSize: '16px' }}>
            Continue where your pipeline left off.
          </p>
        </div>

        <div className="glass" style={{ padding: '40px' }}>
          <form autoComplete="off" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Dummy hidden field to discourage browser autofill managers */}
            <input
              type="text"
              name="prevent_autofill"
              autoComplete="off"
              tabIndex={-1}
              value={''}
              readOnly
              style={{ position: 'absolute', opacity: 0, height: 0, width: 0, border: 0, padding: 0, margin: 0 }}
            />
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Mail size={18} color="var(--text-light)" /></div>
                <input
                  id="login-email"
                  name="login_email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  style={fieldStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><KeyRound size={18} color="var(--text-light)" /></div>
                <input
                  id="login-password"
                  name="login_password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={fieldStyle}
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginTop: '12px', padding: '14px' }}
            >
              {loading ? 'Signing in…' : 'Enter Studio →'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-mid)' }}>
            Need an account?{' '}
            <Link to="/signup" style={{ color: 'var(--terracotta)', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
