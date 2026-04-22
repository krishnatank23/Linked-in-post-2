import { Link } from 'react-router-dom';
import { FileText, Bot, Users, Target, PenTool, Mail, Clock, TrendingUp } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="lumen-theme">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,500;0,600;0,700;1,300;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        .lumen-theme {
          --cream: #faf7f2;
          --warm-white: #ffffff;
          --sand: #f0ebe1;
          --terracotta: #c9714f;
          --terracotta-light: #f0d5c8;
          --sage: #7a9e87;
          --sage-light: #d4e4da;
          --indigo: #4a5b8c;
          --indigo-light: #d8ddf0;
          --amber: #d4a24b;
          --amber-light: #f5e8cc;
          --text-dark: #1c1a17;
          --text-mid: #5a5550;
          --text-light: #9e9790;
          --shadow-sm: 0 2px 8px rgba(50,40,30,0.07);
          --shadow-md: 0 8px 28px rgba(50,40,30,0.11);
          --shadow-lg: 0 20px 60px rgba(50,40,30,0.15);

          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          color: var(--text-dark);
          min-height: 100vh;
          overflow-x: hidden;
          position: absolute;
          inset: 0;
          z-index: 50; /* Above the global dark background */
        }

        /* ─── NAV ─── */
        .lumen-theme .nav-wrapper {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          background: rgba(250,247,242,0.85);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(180,160,140,0.15);
        }
        .lumen-theme .nav-logo {
          font-family: 'Fraunces', serif;
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-dark);
          letter-spacing: -0.02em;
          text-decoration: none;
        }
        .lumen-theme .nav-logo span { color: var(--terracotta); }
        .lumen-theme .nav-links { display: flex; gap: 32px; list-style: none; margin: 0; padding: 0; }
        .lumen-theme .nav-links a {
          font-size: 0.88rem; font-weight: 500;
          color: var(--text-mid); text-decoration: none;
          transition: color 0.2s;
        }
        .lumen-theme .nav-links a:hover { color: var(--terracotta); }
        .lumen-theme .nav-cta {
          background: var(--text-dark); color: white;
          padding: 9px 22px; border-radius: 100px;
          font-size: 0.85rem; font-weight: 500;
          cursor: pointer; border: none; text-decoration: none;
          transition: background 0.2s, transform 0.15s;
        }
        .lumen-theme .nav-cta:hover { background: var(--terracotta); transform: translateY(-1px); }

        /* ─── HERO ─── */
        .lumen-theme .hero {
          padding: 140px 48px 80px;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: center;
          max-width: 1200px; margin: 0 auto;
        }
        .lumen-theme .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--terracotta-light);
          color: var(--terracotta);
          padding: 6px 16px; border-radius: 100px;
          font-size: 0.78rem; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          margin-bottom: 24px;
        }
        .lumen-theme .hero-badge::before {
          content:''; width: 6px; height: 6px;
          background: var(--terracotta); border-radius: 50%;
        }
        .lumen-theme .hero h1 {
          font-family: 'Fraunces', serif;
          font-size: clamp(2.6rem, 4vw, 3.8rem);
          font-weight: 700; line-height: 1.1;
          letter-spacing: -0.03em;
          margin: 0;
        }
        .lumen-theme .hero h1 em { font-style: italic; color: var(--terracotta); }
        .lumen-theme .hero p {
          margin-top: 20px; font-size: 1.05rem;
          color: var(--text-mid); line-height: 1.7;
          max-width: 440px;
        }
        .lumen-theme .hero-btns {
          margin-top: 36px; display: flex; gap: 14px; flex-wrap: wrap;
        }
        .lumen-theme .btn-primary {
          background: var(--text-dark); color: white;
          padding: 14px 30px; border-radius: 100px;
          font-size: 0.92rem; font-weight: 500; border: none;
          cursor: pointer; transition: all 0.2s; text-decoration: none;
          display: flex; align-items: center; gap: 8px;
        }
        .lumen-theme .btn-primary:hover { background: var(--terracotta); transform: translateY(-2px); box-shadow: var(--shadow-md); color: white; }
        .lumen-theme .btn-secondary {
          background: transparent; color: var(--text-dark);
          padding: 14px 30px; border-radius: 100px;
          font-size: 0.92rem; font-weight: 500; text-decoration: none;
          border: 1.5px solid rgba(28,26,23,0.2); cursor: pointer;
          transition: all 0.2s;
        }
        .lumen-theme .btn-secondary:hover { border-color: var(--terracotta); color: var(--terracotta); transform: translateY(-2px); }

        .lumen-theme .hero-visual { position: relative; }
        .lumen-theme .hero-card-stack { position: relative; width: 100%; aspect-ratio: 1/0.85; }
        .lumen-theme .hcard {
          position: absolute; border-radius: 24px;
          background: var(--warm-white);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          transition: transform 0.4s ease;
        }
        .lumen-theme .hcard:nth-child(1) {
          width: 72%; height: 68%;
          bottom: 0; right: 0;
          background: linear-gradient(135deg, #ffffff 0%, #f7f2eb 100%);
          z-index: 3;
        }
        .lumen-theme .hcard:nth-child(2) {
          width: 58%; height: 55%;
          top: 10%; left: 4%;
          background: linear-gradient(135deg, var(--terracotta) 0%, #e8907a 100%);
          z-index: 2;
        }
        .lumen-theme .hcard:nth-child(3) {
          width: 45%; height: 42%;
          top: 5%; right: 5%;
          background: linear-gradient(135deg, var(--indigo) 0%, #6978b0 100%);
          z-index: 1;
        }
        .lumen-theme .hcard-inner { padding: 24px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
        .lumen-theme .hcard-chip { display: inline-block; background: rgba(255,255,255,0.25); border-radius: 100px; padding: 4px 12px; font-size: 0.7rem; font-weight: 600; color: white; width: max-content; }
        .lumen-theme .hcard-chip-dark { background: var(--sand); color: var(--text-mid); }
        .lumen-theme .hcard-title { font-family: 'Fraunces', serif; font-size: 1.4rem; font-weight: 600; color: white; line-height: 1.2; }
        .lumen-theme .hcard-title-dark { color: var(--text-dark); }
        .lumen-theme .hcard-val { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 700; color: white; }
        .lumen-theme .hcard-val-dark { color: var(--text-dark); }
        .lumen-theme .hcard-sub { font-size: 0.72rem; color: rgba(255,255,255,0.7); font-weight: 500; }
        .lumen-theme .hcard-sub-dark { color: var(--text-light); }
        .lumen-theme .mini-chart { display: flex; align-items: flex-end; gap: 4px; margin-top: 8px; }
        .lumen-theme .bar { width: 8px; border-radius: 4px 4px 0 0; background: rgba(255,255,255,0.5); }
        .lumen-theme .bar.active { background: white; }

        /* ─── SECTION ─── */
        .lumen-theme section { max-width: 1200px; margin: 0 auto; padding: 80px 48px; }
        .lumen-theme .section-header { text-align: center; margin-bottom: 56px; }
        .lumen-theme .section-tag {
          display: inline-block;
          font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--terracotta);
          margin-bottom: 12px;
        }
        .lumen-theme .section-title {
          font-family: 'Fraunces', serif;
          font-size: clamp(2rem, 3vw, 2.8rem);
          font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0;
        }
        .lumen-theme .section-title em { font-style: italic; color: var(--terracotta); }
        .lumen-theme .section-sub {
          margin-top: 14px; font-size: 1rem;
          color: var(--text-mid); line-height: 1.6; max-width: 500px; margin-inline: auto;
        }

        /* ─── STAT CARDS ─── */
        .lumen-theme .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .lumen-theme .stat-card {
          background: white; border-radius: 20px;
          padding: 28px 24px;
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(180,160,140,0.1);
          transition: all 0.3s ease;
          position: relative; overflow: hidden;
        }
        .lumen-theme .stat-card::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, var(--card-accent, #c9714f), transparent 70%);
          opacity: 0; transition: opacity 0.3s;
        }
        .lumen-theme .stat-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); }
        .lumen-theme .stat-card:hover::before { opacity: 0.06; }
        .lumen-theme .stat-card:nth-child(1) { --card-accent: var(--terracotta); }
        .lumen-theme .stat-card:nth-child(2) { --card-accent: var(--sage); }
        .lumen-theme .stat-card:nth-child(3) { --card-accent: var(--indigo); }
        
        .lumen-theme .stat-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem; margin-bottom: 18px;
        }
        .lumen-theme .stat-icon.terra { background: var(--terracotta-light); color: var(--terracotta); }
        .lumen-theme .stat-icon.sage { background: var(--sage-light); color: var(--sage); }
        .lumen-theme .stat-icon.indigo { background: var(--indigo-light); color: var(--indigo); }
        
        .lumen-theme .stat-num {
          font-family: 'Fraunces', serif;
          font-size: 2.1rem; font-weight: 700; line-height: 1;
          letter-spacing: -0.02em;
        }
        .lumen-theme .stat-label { font-size: 0.82rem; color: var(--text-mid); margin-top: 6px; font-weight: 500; }
        .lumen-theme .stat-change {
          margin-top: 12px; font-size: 0.75rem; font-weight: 600;
          display: flex; align-items: center; gap: 4px;
        }
        .lumen-theme .up { color: var(--sage); }

        /* ─── FEATURE CARDS ─── */
        .lumen-theme .feature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
        .lumen-theme .feat-card {
          background: white; border-radius: 24px;
          padding: 36px 32px;
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(180,160,140,0.1);
          transition: all 0.35s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .lumen-theme .feat-card:hover { transform: translateY(-8px) rotate(-0.3deg); box-shadow: var(--shadow-lg); }
        .lumen-theme .feat-card.accent-terra { background: linear-gradient(145deg, var(--terracotta), #e8907a); }
        .lumen-theme .feat-card.accent-terra * { color: white !important; }
        .lumen-theme .feat-card.accent-terra .feat-icon { background: rgba(255,255,255,0.2); }
        .lumen-theme .feat-icon {
          width: 52px; height: 52px; border-radius: 16px;
          background: var(--sand); display: flex;
          align-items: center; justify-content: center;
          font-size: 1.5rem; margin-bottom: 24px; color: var(--terracotta);
        }
        .lumen-theme .feat-card h3 {
          font-family: 'Fraunces', serif; font-size: 1.25rem;
          font-weight: 600; margin-bottom: 10px; margin-top: 0;
        }
        .lumen-theme .feat-card p { font-size: 0.9rem; color: var(--text-mid); line-height: 1.65; margin: 0; }

        /* ─── PIPELINE STEPS ─── */
        .lumen-theme .pipeline-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .lumen-theme .pipe-card {
          background: white; border-radius: 20px;
          padding: 24px;
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(180,160,140,0.1);
          transition: all 0.3s ease;
        }
        .lumen-theme .pipe-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); }
        .lumen-theme .pipe-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .lumen-theme .pipe-icon.c1 { background: var(--terracotta-light); color: var(--terracotta); }
        .lumen-theme .pipe-icon.c2 { background: var(--sage-light); color: var(--sage); }
        .lumen-theme .pipe-icon.c3 { background: var(--indigo-light); color: var(--indigo); }
        .lumen-theme .pipe-icon.c4 { background: var(--amber-light); color: var(--amber); }
        .lumen-theme .pipe-icon.c5 { background: var(--terracotta-light); color: var(--terracotta); }
        .lumen-theme .pipe-icon.c6 { background: var(--sage-light); color: var(--sage); }
        
        .lumen-theme .pipe-num { font-size: 0.75rem; font-weight: 700; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .lumen-theme .pipe-title { font-family: 'Fraunces', serif; font-size: 1.15rem; font-weight: 600; margin-bottom: 8px; }
        .lumen-theme .pipe-desc { font-size: 0.85rem; color: var(--text-mid); line-height: 1.6; }

        /* ─── FOOTER STRIP ─── */
        .lumen-theme .footer-strip {
          background: var(--text-dark); color: white;
          padding: 60px 48px;
          display: flex; align-items: center; justify-content: space-between;
          max-width: 100%;
        }
        .lumen-theme .footer-strip h2 {
          font-family: 'Fraunces', serif;
          font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; margin: 0;
        }
        .lumen-theme .footer-strip h2 em { font-style: italic; color: var(--terracotta); }
        .lumen-theme .footer-strip p { color: rgba(255,255,255,0.55); margin-top: 8px; font-size: 0.9rem; }

        /* ─── DIVIDER ─── */
        .lumen-theme .divider {
          max-width: 1200px; margin: 0 auto;
          border: none; border-top: 1px solid rgba(180,160,140,0.15);
        }

        @media (max-width: 900px) {
          .lumen-theme .hero { grid-template-columns: 1fr; }
          .lumen-theme .hero-visual { display: none; }
          .lumen-theme .stats-grid { grid-template-columns: repeat(1,1fr); }
          .lumen-theme .feature-grid { grid-template-columns: 1fr; }
          .lumen-theme .pipeline-grid { grid-template-columns: 1fr; }
          .lumen-theme .nav-wrapper { padding: 16px 24px; }
          .lumen-theme section, .lumen-theme .hero { padding-left: 24px; padding-right: 24px; }
          .lumen-theme .footer-strip { flex-direction: column; text-align: center; gap: 24px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav-wrapper">
        <Link to="/" className="nav-logo">Post<span>Pilot</span> AI</Link>
        <ul className="nav-links">
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#why">Why PostPilot</a></li>
          <li><Link to="/login">Sign in</Link></li>
        </ul>
        <Link to="/signup" className="nav-cta">Start free →</Link>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-left">
          <div className="hero-badge">Multi-Agent AI Pipeline</div>
          <h1>Turn your resume into <em>LinkedIn posts</em> that land.</h1>
          <p>A warm, intelligent design language crafted for modern professionals. Clean outputs, refined tone, and thoughtful content gaps filled.</p>
          <div className="hero-btns">
            <Link to="/signup" className="btn-primary">Create free account ↗</Link>
            <a href="#how-it-works" className="btn-secondary">See how it works</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card-stack">
            {/* Card 3 (back) */}
            <div className="hcard" style={{ width: '45%', height: '42%', top: '5%', right: '5%', zIndex: 1 }}>
              <div className="hcard-inner">
                <div className="hcard-chip">Agent 3</div>
                <div>
                  <div className="hcard-val" style={{ fontSize: '1.4rem' }}>Idol Scout</div>
                  <div className="hcard-sub">Finds relevant influencers</div>
                </div>
              </div>
            </div>
            {/* Card 2 (mid) */}
            <div className="hcard" style={{ width: '58%', height: '52%', top: '8%', left: '4%', zIndex: 2, background: 'linear-gradient(135deg,var(--terracotta) 0%,#e8907a 100%)' }}>
              <div className="hcard-inner">
                <div className="hcard-chip">Agent 2</div>
                <div>
                  <div className="hcard-title">Brand Voice<br />Definition</div>
                  <div className="mini-chart">
                    <div className="bar" style={{ height: '20px' }}></div>
                    <div className="bar" style={{ height: '30px' }}></div>
                    <div className="bar" style={{ height: '22px' }}></div>
                    <div className="bar active" style={{ height: '38px' }}></div>
                    <div className="bar" style={{ height: '28px' }}></div>
                  </div>
                </div>
              </div>
            </div>
            {/* Card 1 (front) */}
            <div className="hcard" style={{ width: '72%', height: '58%', bottom: 0, right: 0, zIndex: 3, background: 'linear-gradient(135deg,#fff 0%,#f7f2eb 100%)' }}>
              <div className="hcard-inner">
                <div className="hcard-chip hcard-chip-dark">Agent 1</div>
                <div>
                  <div className="hcard-val hcard-val-dark">Resume Parser</div>
                  <div className="hcard-sub hcard-sub-dark">Extracts skills & industry context</div>
                  <div className="mini-chart" style={{ marginTop: '12px' }}>
                    <div className="bar" style={{ height: '16px', background: 'var(--sage-light)' }}></div>
                    <div className="bar" style={{ height: '24px', background: 'var(--sage-light)' }}></div>
                    <div className="bar" style={{ height: '18px', background: 'var(--sage-light)' }}></div>
                    <div className="bar" style={{ height: '32px', background: 'var(--sage)' }}></div>
                    <div className="bar" style={{ height: '26px', background: 'var(--sage-light)' }}></div>
                    <div className="bar" style={{ height: '36px', background: 'var(--sage)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="divider" />

      {/* STAT CARDS */}
      <section>
        <div className="section-header">
          <div className="section-tag">Overview</div>
          <h2 className="section-title">Pipeline <em>performance</em> at a glance</h2>
          <p className="section-sub">Compact, reliable automation working to amplify your personal brand.</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon terra"><Clock size={24} /></div>
            <div className="stat-num">10 min</div>
            <div className="stat-label">From resume to posts</div>
            <div className="stat-change up">↑ Hours of manual work saved</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon sage"><TrendingUp size={24} /></div>
            <div className="stat-num">6 Agents</div>
            <div className="stat-label">Working in sequence</div>
            <div className="stat-change up">↑ Specialised AI tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon indigo"><Target size={24} /></div>
            <div className="stat-num">100%</div>
            <div className="stat-label">Personalised to you</div>
            <div className="stat-change up">↑ No generic templates</div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* HOW IT WORKS */}
      <section id="how-it-works">
        <div className="section-header">
          <div className="section-tag">Process</div>
          <h2 className="section-title">Six AI agents, <em>zero</em> effort</h2>
          <p className="section-sub">Each step is handled by a dedicated agent. You stay in control — review outputs, pick influencers, approve posts.</p>
        </div>
        <div className="pipeline-grid">
          <div className="pipe-card">
            <div className="pipe-icon c1"><FileText size={20} /></div>
            <div className="pipe-num">Step 1</div>
            <div className="pipe-title">Upload your resume</div>
            <div className="pipe-desc">Drop your PDF or DOCX — our parser extracts skills, roles, and industry context automatically.</div>
          </div>
          <div className="pipe-card">
            <div className="pipe-icon c2"><Bot size={20} /></div>
            <div className="pipe-num">Step 2</div>
            <div className="pipe-title">AI defines your voice</div>
            <div className="pipe-desc">A dedicated agent builds your professional tone, positioning, and content pillars.</div>
          </div>
          <div className="pipe-card">
            <div className="pipe-icon c3"><Users size={20} /></div>
            <div className="pipe-num">Step 3</div>
            <div className="pipe-title">Benchmark creators</div>
            <div className="pipe-desc">We surface LinkedIn influencers in your niche so you can learn what resonates.</div>
          </div>
          <div className="pipe-card">
            <div className="pipe-icon c4"><Target size={20} /></div>
            <div className="pipe-num">Step 4</div>
            <div className="pipe-title">Gap analysis</div>
            <div className="pipe-desc">Compare your profile against benchmarks to find content opportunities others miss.</div>
          </div>
          <div className="pipe-card">
            <div className="pipe-icon c5"><PenTool size={20} /></div>
            <div className="pipe-num">Step 5</div>
            <div className="pipe-title">Generate content</div>
            <div className="pipe-desc">Get polished LinkedIn posts tailored to your expertise, voice, and audience gaps.</div>
          </div>
          <div className="pipe-card">
            <div className="pipe-icon c6"><Mail size={20} /></div>
            <div className="pipe-num">Step 6</div>
            <div className="pipe-title">Deliver to inbox</div>
            <div className="pipe-desc">Posts arrive in your email — review, tweak, and publish on your schedule.</div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* WHY POSTPILOT */}
      <section id="why">
        <div className="section-header">
          <div className="section-tag">Why PostPilot</div>
          <h2 className="section-title">Built for <em>professionals</em></h2>
          <p className="section-sub">Most people know LinkedIn matters. Few have time to write. PostPilot bridges that gap with AI that actually understands your career.</p>
        </div>
        <div className="feature-grid">
          <div className="feat-card accent-terra">
            <div className="feat-icon"><Bot size={24} /></div>
            <h3>Not another chatbot</h3>
            <p>This isn't "write me a LinkedIn post." It's a structured pipeline that reads your resume, studies your market, and generates posts grounded in your real experience.</p>
            <div className="feat-tags">
              <span className="feat-tag">Structured AI</span>
              <span className="feat-tag">Resume-driven</span>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-icon"><Users size={24} /></div>
            <h3>You pick influencers</h3>
            <p>After the AI finds relevant LinkedIn creators, you choose which ones to benchmark against. The gap analysis and posts reflect your choices, not ours.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon"><PenTool size={24} /></div>
            <h3>Posts, not fluff</h3>
            <p>Every generated post has a hook, a narrative, and a takeaway. They're designed to perform on LinkedIn — not just fill a content calendar.</p>
          </div>
        </div>
      </section>

      {/* FOOTER STRIP */}
      <div className="footer-strip">
        <div>
          <h2>Ready to let your resume do the <em>writing?</em></h2>
          <p>Upload once. Get posts you can publish this week.</p>
        </div>
        <Link to="/signup" className="nav-cta" style={{ fontSize: '0.95rem', padding: '14px 30px' }}>Start Building →</Link>
      </div>

    </div>
  );
}
