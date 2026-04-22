import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { ArrowRight, CheckCircle2, Lock, Mail, Upload, User } from 'lucide-react';
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

export default function SignupPage() {
  const [formData, setFormData] = useState({ email: '', username: '', password: '' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0] || null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const handleNext = () => {
    if (!formData.email || !formData.username || !formData.password) {
      toast.error('Please complete all account details first.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { toast.error('Please upload your resume.'); return; }

    const payload = new FormData();
    payload.append('email', formData.email);
    payload.append('username', formData.username);
    payload.append('password', formData.password);
    payload.append('resume', file);

    try {
      setLoading(true);
      const registerResponse = await api.post('/register', payload);
      const email = formData.email.trim().toLowerCase();
      const loginResponse = await api.post('/login', { email, password: formData.password });
      const { access_token, user_id, unique_id, username } = loginResponse.data;
      login(access_token, { id: user_id, unique_id, username, email });
      toast.success(registerResponse.data?.message || 'Account created!');
      navigate('/studio');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : typeof detail === 'object' ? JSON.stringify(detail)
        : (error.message || 'Registration failed.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Account', icon: User },
    { num: 2, label: 'Resume', icon: Upload },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2.5rem 1rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '520px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: '24px', textDecoration: 'none' }}>
            <span className="heading-fraunces" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-dark)' }}>
              Post<span className="text-terracotta">Pilot</span> AI
            </span>
          </Link>
          <h1 className="heading-fraunces" style={{ fontSize: 'clamp(26px,5vw,34px)', fontWeight: 700, margin: '0 0 8px' }}>
            Create your account
          </h1>
          <p style={{ color: 'var(--text-mid)', margin: 0, fontSize: '16px' }}>
            Upload your resume and launch the AI pipeline.
          </p>
        </div>

        <div className="glass" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            {steps.map((s, i) => {
              const StepIcon = s.icon;
              const active = step >= s.num;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: active ? 'var(--terracotta-light)' : 'rgba(180,160,140,0.1)',
                    border: `1px solid ${active ? 'var(--terracotta)' : 'rgba(180,160,140,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                  }}>
                    {step > s.num
                      ? <CheckCircle2 size={16} color="var(--terracotta)" />
                      : <StepIcon size={14} color={active ? 'var(--terracotta)' : 'var(--text-light)'} />
                    }
                  </div>
                  <span style={{
                    fontSize: '13px', fontWeight: 600,
                    color: active ? 'var(--text-dark)' : 'var(--text-light)',
                    transition: 'color 0.3s',
                  }}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && (
                    <div style={{
                      flex: 1, height: '2px', marginLeft: '4px',
                      background: step > s.num ? 'var(--terracotta)' : 'rgba(180,160,140,0.15)',
                      transition: 'background 0.5s',
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="account"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><User size={18} color="var(--text-light)" /></div>
                    <input
                      placeholder="johndoe"
                      value={formData.username}
                      onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Email address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><Mail size={18} color="var(--text-light)" /></div>
                    <input
                      type="email"
                      placeholder="john@company.com"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><Lock size={18} color="var(--text-light)" /></div>
                    <input
                      type="password"
                      placeholder="Create a secure password"
                      value={formData.password}
                      onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '12px', padding: '14px' }}
                >
                  Continue <ArrowRight size={17} />
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="resume"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div
                  {...getRootProps()}
                  style={{
                    borderRadius: '18px',
                    border: `2px dashed ${isDragActive ? 'var(--terracotta)' : 'rgba(180,160,140,0.3)'}`,
                    background: isDragActive ? 'var(--terracotta-light)' : 'var(--warm-white)',
                    padding: '3rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                >
                  <input {...getInputProps()} />
                  <div style={{
                    width: '60px', height: '60px', borderRadius: '16px',
                    background: 'var(--terracotta-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <Upload size={26} color="var(--terracotta)" />
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '8px' }}>
                    Drop your resume here
                  </div>
                  <p style={{ color: 'var(--text-mid)', fontSize: '14px', margin: 0 }}>
                    PDF, DOC, or DOCX — the AI will parse your experience.
                  </p>
                </div>

                {file && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '14px',
                      background: 'var(--sage-light)',
                      border: '1px solid var(--sage)', borderRadius: '12px',
                    }}
                  >
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <CheckCircle2 size={20} color="var(--sage)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '2px' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <button type="button" onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)', fontSize: '13px', fontWeight: 600 }}>
                      Remove
                    </button>
                  </motion.div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '14px' }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !file}
                    className="btn-primary"
                    style={{ flex: 2, padding: '14px' }}
                  >
                    {loading ? 'Creating account…' : 'Initialize account →'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-mid)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--terracotta)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
