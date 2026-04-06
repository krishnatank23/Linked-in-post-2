import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Rocket, ShieldCheck, TrendingUp, Layers3, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { btnPrimary, btnSecondary, glassCard, pageInner, pageShell } from '../styles/classes';

const features = [
  {
    icon: Rocket,
    title: 'Resume Analysis',
    text: 'Turn a resume into structured professional intelligence with a single upload.',
  },
  {
    icon: Layers3,
    title: 'Brand Voice AI',
    text: 'Build a clear identity, tone, and positioning strategy from your experience.',
  },
  {
    icon: TrendingUp,
    title: 'Influencer Benchmarking',
    text: 'Compare yourself with selected LinkedIn leaders and identify actionable gaps.',
  },
];

const stats = [
  { value: '500+', label: 'Professionals branded' },
  { value: '3x', label: 'Faster strategy creation' },
  { value: '24/7', label: 'Agentic pipeline availability' },
];

const steps = [
  'Upload resume and create account',
  'Log in and run the AI pipeline',
  'Select influencers from the list',
  'Run gap analysis and generate posts',
];

export default function LandingPage() {
  return (
    <div className={pageShell}>
      <div className="fixed inset-0 pointer-events-none hero-grid opacity-30" />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-[120px] animate-aurora" />
        <div className="absolute top-[20%] right-[-6rem] h-80 w-80 rounded-full bg-accent/20 blur-[120px] animate-aurora" style={{ animationDelay: '-6s' }} />
        <div className="absolute bottom-[-5rem] left-[15%] h-72 w-72 rounded-full bg-white/10 blur-[130px] animate-float" />
      </div>

      <div className={pageInner}>
        <header className="flex items-center justify-between py-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="font-heading text-xl font-bold leading-none">BrandForge AI</div>
              <div className="text-xs text-white/40">Deep-ocean studio for personal branding</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-3">
            <a href="#features" className={btnSecondary}>Features</a>
            <a href="#workflow" className={btnSecondary}>Workflow</a>
            <Link to="/login" className={btnSecondary}>Sign in</Link>
            <Link to="/signup" className={btnPrimary}>Get Started</Link>
          </div>
        </header>

        <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center pt-10 pb-20">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/75 mb-6">
              <ShieldCheck size={16} className="text-accent" />
              Production-level React frontend, built for a separate dev server
            </div>
            <h1 className="font-heading text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02]">
              Build your LinkedIn brand with an <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI studio</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl text-white/65 leading-8">
              Upload a resume, run the pipeline, select influencer benchmarks, review gap analysis, and generate trend-aware posts from one elegant workspace.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/signup" className={`${btnPrimary} text-lg gap-2`}>
                Start free <ArrowRight size={18} />
              </Link>
              <Link to="/login" className={`${btnSecondary} text-lg`}>Open studio</Link>
            </div>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className={`${glassCard} p-5`}>
                  <div className="text-3xl font-bold font-heading">{stat.value}</div>
                  <div className="text-sm text-white/50 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className={`${glassCard} p-6 md:p-8`}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-sm text-white/40 uppercase tracking-[0.24em]">Studio Preview</div>
                <div className="font-heading text-2xl font-bold mt-1">Agentic pipeline flow</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
                <Layers3 size={24} />
              </div>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{step}</div>
                    <div className="text-sm text-white/45 mt-1">
                      {index === 0 && 'Signup with drag-and-drop resume upload.'}
                      {index === 1 && 'Run the backend pipeline and track live progress.'}
                      {index === 2 && 'Choose specific influencers before analysis.'}
                      {index === 3 && 'Review recommendations and generate posts manually.'}
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="text-accent mt-1" />
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section id="features" className="py-10 md:py-16">
          <div className="max-w-3xl mb-10">
            <div className="text-sm uppercase tracking-[0.3em] text-white/35 mb-3">Key Features</div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold leading-tight">
              A premium UI for the complete brand-building workflow.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className={`${glassCard} p-6`}
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-5">
                  <feature.icon size={24} />
                </div>
                <div className="font-heading text-xl font-semibold mb-2">{feature.title}</div>
                <p className="text-white/55 leading-7">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="workflow" className="py-14 md:py-20">
          <div className={`${glassCard} p-8 md:p-10`}>
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
              <div>
                <div className="text-sm uppercase tracking-[0.3em] text-white/35 mb-3">How it works</div>
                <h2 className="font-heading text-3xl md:text-5xl font-bold leading-tight">
                  A clear step-by-step path from resume to posts.
                </h2>
                <p className="mt-4 text-white/55 leading-7">
                  Every action is separated, reviewable, and human-in-the-loop. That keeps the workflow predictable and production-friendly.
                </p>
              </div>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-semibold">{index + 1}</div>
                    <div>
                      <div className="font-semibold">{step}</div>
                      <div className="text-sm text-white/45">{index === 0 ? 'Signup and resume upload.' : index === 1 ? 'Run the AI pipeline.' : index === 2 ? 'Select the right influencers.' : 'Generate posts from your strategy.'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-20">
          <div className={`${glassCard} p-8 md:p-10 flex flex-col lg:flex-row items-center justify-between gap-8`}>
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-white/35 mb-3">Ready to start</div>
              <h2 className="font-heading text-3xl md:text-5xl font-bold leading-tight">
                Launch the separate React frontend with the FastAPI backend.
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup" className={`${btnPrimary} text-lg`}>Create account</Link>
              <Link to="/login" className={`${btnSecondary} text-lg`}>Sign in</Link>
            </div>
          </div>
        </section>

        <footer className="py-10 pb-14 text-center text-sm text-white/30">
          BrandForge AI. Deep Ocean UI. Production-ready separation of concerns.
        </footer>
      </div>
    </div>
  );
}
