import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { ArrowRight, CheckCircle2, FileText, Mail, Sparkles, Upload, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, btnSecondary, glassBase, glassCard, inputField, pageShell } from '../styles/classes';

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
    if (!file) {
      toast.error('Please upload your resume.');
      return;
    }

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

      toast.success(registerResponse.data?.message || 'Account created and signed in.');
      navigate('/studio');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMessage = typeof detail === 'string' 
        ? detail 
        : (typeof detail === 'object' ? JSON.stringify(detail) : (error.message || 'Registration failed.'));
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${pageShell} flex items-center justify-center px-4 py-10`}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-24 left-[10%] h-96 w-96 rounded-full bg-primary/15 blur-[130px] animate-aurora" />
        <div className="absolute bottom-[-5rem] right-[12%] h-80 w-80 rounded-full bg-accent/15 blur-[130px] animate-aurora" style={{ animationDelay: '-7s' }} />
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={22} />
            </div>
            <span className="font-heading text-2xl font-bold">BrandForge AI</span>
          </Link>
          <h1 className="font-heading text-4xl md:text-5xl font-bold">Create your account</h1>
          <p className="text-white/50 mt-3">Upload your resume and launch the pipeline.</p>
        </div>

        <div className={`${glassCard} p-6 md:p-8`}>
          <div className="flex items-center justify-between mb-6 text-sm text-white/45">
            <span>Step {step} of 2</span>
            <span>Glassmorphic onboarding</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-8">
            <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="account"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm text-white/60">Username</span>
                    <div className="relative mt-2">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input className={`${inputField} pl-12`} placeholder="johndoe" value={formData.username} onChange={(event) => setFormData((prev) => ({ ...prev, username: event.target.value }))} />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-sm text-white/60">Email address</span>
                    <div className="relative mt-2">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input className={`${inputField} pl-12`} placeholder="john@company.com" type="email" value={formData.email} onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))} />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm text-white/60">Password</span>
                  <div className="relative mt-2">
                    <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input className={`${inputField} pl-12`} placeholder="Create a secure password" type="password" value={formData.password} onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))} />
                  </div>
                </label>

                <button type="button" onClick={handleNext} className={`${btnPrimary} w-full text-lg gap-2`}>
                  Continue <ArrowRight size={18} />
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="resume"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div
                  {...getRootProps()}
                  className={`rounded-3xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${isDragActive ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-4">
                    <Upload size={30} />
                  </div>
                  <div className="font-heading text-2xl font-semibold">Drop your resume here</div>
                  <p className="text-white/45 mt-2">PDF, DOC, or DOCX. The backend will parse your experience and build the first agent outputs.</p>
                </div>

                {file && (
                  <div className={`${glassBase} p-4 flex items-center gap-4`}>
                    <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{file.name}</div>
                      <div className="text-sm text-white/40">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <button type="button" onClick={() => setFile(null)} className="text-white/35 hover:text-white">Remove</button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className={`${btnSecondary} flex-1`}>Back</button>
                  <button type="submit" disabled={loading || !file} className={`${btnPrimary} flex-1`}>
                    {loading ? 'Creating account...' : 'Initialize account'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mt-6 text-sm text-white/40">
          Already have an account? <Link to="/login" className="text-accent font-medium">Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
}
