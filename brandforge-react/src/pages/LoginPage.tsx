import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, glassCard, inputField, pageShell } from '../styles/classes';

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
      login(access_token, { id: user_id, unique_id, username, email: email.trim().toLowerCase() });
      toast.success(`Welcome back, ${username}`);
      navigate('/studio');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${pageShell} flex items-center justify-center px-4 py-10`}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[12%] left-[8%] h-80 w-80 rounded-full bg-primary/20 blur-[130px] animate-aurora" />
        <div className="absolute bottom-[8%] right-[12%] h-72 w-72 rounded-full bg-accent/20 blur-[130px] animate-aurora" style={{ animationDelay: '-4s' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={22} />
            </div>
            <span className="font-heading text-2xl font-bold">BrandForge AI</span>
          </Link>
          <h1 className="font-heading text-4xl md:text-5xl font-bold">Sign in to your studio</h1>
          <p className="text-white/50 mt-3">Continue where your pipeline left off.</p>
        </div>

        <div className={`${glassCard} p-6 md:p-8`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="text-sm text-white/60">Email address</span>
              <div className="relative mt-2">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className={`${inputField} pl-12`}
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm text-white/60">Password</span>
              <div className="relative mt-2">
                <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className={`${inputField} pl-12`}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </label>

            <button type="submit" disabled={loading} className={`${btnPrimary} w-full text-lg`}>
              {loading ? 'Signing in...' : 'Enter Studio'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/40">
            Need an account? <Link to="/signup" className="text-accent font-medium">Create one</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
