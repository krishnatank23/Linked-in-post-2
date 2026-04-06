export const pageShell = 'relative min-h-screen overflow-hidden';
export const pageInner = 'relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

export const glassBase =
  'bg-gradient-to-br from-white/14 via-[#f3e6d2]/8 to-white/5 backdrop-blur-xl border border-white/14 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.28)]';

export const glassCard =
  `${glassBase} transition-all duration-300 hover:border-accent/30 hover:-translate-y-0.5`;

export const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold text-[#f8f1e5] bg-gradient-to-r from-[#47624A] via-primary to-accent shadow-lg shadow-emerald-900/25 transition-all duration-300 hover:brightness-110 active:scale-[0.98]';

export const btnSecondary =
  'inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold text-[#f7efe4]/90 bg-gradient-to-r from-white/12 to-white/6 border border-white/15 backdrop-blur-md transition-all duration-300 hover:bg-white/18 hover:border-accent/30';

export const inputField =
  'w-full bg-white/[0.07] border border-white/[0.15] rounded-2xl px-4 py-3.5 text-white placeholder:text-white/35 focus:outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20 transition-all';
