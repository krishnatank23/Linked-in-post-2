export const pageShell = 'relative min-h-screen overflow-hidden';
export const pageInner = 'relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

export const glassBase =
  'bg-white/70 backdrop-blur-xl border border-[rgba(180,160,140,0.3)] rounded-2xl shadow-[0_4px_24px_rgba(50,40,30,0.08)]';

export const glassCard =
  `${glassBase} transition-all duration-300 hover:border-[rgba(201,113,79,0.4)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(50,40,30,0.12)]`;

export const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-full font-medium text-white bg-[#1c1a17] transition-all duration-200 hover:bg-[#c9714f] hover:-translate-y-0.5 active:scale-[0.98] shadow-[0_4px_14px_rgba(50,40,30,0.1)]';

export const btnSecondary =
  'inline-flex items-center justify-center px-5 py-3 rounded-full font-medium text-[#1c1a17] bg-transparent border border-[#1c1a17]/20 transition-all duration-200 hover:text-[#c9714f] hover:border-[#c9714f] hover:-translate-y-0.5 active:scale-[0.98]';

export const inputField =
  'w-full bg-white border border-[rgba(180,160,140,0.3)] rounded-2xl px-4 py-3.5 text-[#1c1a17] placeholder:text-[#9e9790] focus:outline-none focus:border-[#c9714f] focus:ring-4 focus:ring-[#c9714f]/10 transition-all';
