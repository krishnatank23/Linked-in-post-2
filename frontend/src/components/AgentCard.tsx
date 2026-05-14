import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Cpu, ExternalLink, Globe, UserCheck, BarChart3, Sparkles, Clock3, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { glassCard } from '../styles/classes';

interface AgentCardProps {
  data: any;
  index: number;
  onRunAgain?: () => void;
  isRunning?: boolean;
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (typeof value === 'object') return Object.values(value).flatMap((item) => asArray(item));
  return [value];
}

function extractSkills(profile: any): string[] {
  const rawSkills = profile?.skills;
  if (Array.isArray(rawSkills)) {
    return rawSkills.map((item) => String(item)).filter(Boolean);
  }

  if (rawSkills && typeof rawSkills === 'object') {
    return Object.values(rawSkills)
      .flatMap((item) => asArray(item))
      .map((item) => String(item))
      .filter(Boolean);
  }

  return [];
}

function asObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function fieldValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string') return value.trim() || 'N/A';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => fieldValue(item)).join(', ') : 'N/A';
  return JSON.stringify(value);
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35 mb-1">{title}</div>
      {subtitle ? <div className="text-sm text-[#1c1a17]/50 leading-6">{subtitle}</div> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#1c1a17]/35 mb-2">{label}</div>
      <div className="text-sm text-[#1c1a17]/80 leading-6 break-words">{fieldValue(value)}</div>
    </div>
  );
}

function renderList(items: any[], fallback: string) {
  if (!items || !items.length) {
    return <p className="text-sm text-[#1c1a17]/45">{fallback}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className="px-3 py-1 rounded-full bg-black/10 border border-black/10 text-[11px] font-semibold text-[#1c1a17]/75">
          {typeof item === 'string' ? item : JSON.stringify(item)}
        </span>
      ))}
    </div>
  );
}

function ScheduleCalendar({ scheduledDays }: { scheduledDays: string[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortDayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  
  const days = Array.from({ length: firstDay }, () => null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  
  return (
    <div className="p-5 rounded-2xl bg-black/5 border border-black/10">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-[#1c1a17] text-lg">{monthNames[month]} {year}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-accent font-bold px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full flex items-center gap-1.5">
          <Clock3 size={12} />
          Content Schedule
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2 mb-2">
        {shortDayNames.map((day) => (
          <div key={day} className="text-center text-[11px] font-bold tracking-wider text-[#1c1a17]/40 py-1 uppercase">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, idx) => {
          if (date === null) return <div key={`empty-${idx}`} className="p-2"></div>;
          
          const currentDate = new Date(year, month, date as number);
          const dayName = dayNames[currentDate.getDay()];
          const isScheduled = scheduledDays.includes(dayName);
          const isToday = date === today.getDate();
          
          return (
            <div 
              key={date} 
              className={`
                flex items-center justify-center h-10 w-full rounded-xl text-sm transition-all duration-300
                ${isScheduled ? 'bg-accent text-white font-bold shadow-lg shadow-accent/25 scale-105 ring-2 ring-accent/20 ring-offset-1 ring-offset-transparent' : 'text-[#1c1a17]/70 hover:bg-black/10 hover:text-[#1c1a17]'}
                ${isToday && !isScheduled ? 'border-2 border-accent/40 text-accent font-bold' : ''}
              `}
              title={isScheduled ? `Scheduled Post Day (${dayName})` : dayName}
            >
              {date}
            </div>
          );
        })}
      </div>
    </div>
  );
}


const AgentCard = ({ data, index, onRunAgain, isRunning }: AgentCardProps) => {
  const isSuccess = data.status === 'success';
  const agentName = String(data.agent_name || 'Agent');
  const output = data.output || {};
  const errorMessage = String(data.error || '').trim();

  const renderContent = () => {
    if (agentName.includes('Resume')) {
      const profile = asObject(output.parsed_profile || output.profile || {});
      const personalInfo = asObject(profile.personal_info);
      const experience = asArray(profile.experience);
      const education = asArray(profile.education);
      const certifications = asArray(profile.certifications);
      const projects = asArray(profile.projects);
      const achievements = asArray(profile.achievements_and_awards);
      const interests = asArray(profile.interests);
      const expertiseAreas = asArray(profile.expertise_areas);
      const skills = extractSkills(profile);
      return (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
            <SectionHeader title="Profile Summary" subtitle="A concise overview extracted from the resume." />
            <p className="text-sm text-[#1c1a17]/75 leading-7">{profile.professional_summary || profile.summary || profile.overview || 'Resume parsed successfully.'}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <DetailRow label="Full Name" value={personalInfo.full_name} />
            <DetailRow label="Email" value={personalInfo.email} />
            <DetailRow label="Phone" value={personalInfo.phone} />
            <DetailRow label="Location" value={personalInfo.location} />
            <DetailRow label="LinkedIn URL" value={personalInfo.linkedin_url} />
            <DetailRow label="Portfolio URL" value={personalInfo.portfolio_url} />
            <DetailRow label="Total Years of Experience" value={profile.total_years_of_experience} />
            <DetailRow label="Current Role" value={profile.current_role} />
            <DetailRow label="Industry" value={profile.industry} />
          </div>

          <div className="space-y-3">
            <SectionHeader title="Experience" subtitle="Work history and key achievements." />
            {experience.length ? experience.map((item: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-2">
                <div className="font-semibold text-[#1c1a17]/90">{fieldValue(item.role)}{item.company ? ` at ${fieldValue(item.company)}` : ''}</div>
                <div className="text-xs text-[#1c1a17]/45">{fieldValue(item.duration)}</div>
                <div className="text-sm text-[#1c1a17]/70 leading-7">{fieldValue(item.description)}</div>
                {asArray(item.key_achievements).length ? (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#1c1a17]/35">Key Achievements</div>
                    {renderList(asArray(item.key_achievements), 'No achievements listed.')}
                  </div>
                ) : null}
              </div>
            )) : <p className="text-sm text-[#1c1a17]/45">No experience entries found.</p>}
          </div>

          <div className="space-y-3">
            <SectionHeader title="Education" />
            {education.length ? education.map((item: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-1">
                <div className="font-semibold text-[#1c1a17]/90">{fieldValue(item.institution)}</div>
                <div className="text-sm text-[#1c1a17]/70">{fieldValue(item.degree)}{item.field_of_study ? `, ${fieldValue(item.field_of_study)}` : ''}</div>
                <div className="text-xs text-[#1c1a17]/45">{fieldValue(item.year)}</div>
              </div>
            )) : <p className="text-sm text-[#1c1a17]/45">No education entries found.</p>}
          </div>

          <div className="space-y-3">
            <SectionHeader title="Skills" subtitle="Technical, soft, tools, and languages." />
            <div className="space-y-3">
              {renderList(skills, 'Skills will appear here.')}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <DetailRow label="Expertise Areas" value={expertiseAreas} />
            <DetailRow label="Certifications" value={certifications} />
            <DetailRow label="Achievements and Awards" value={achievements} />
            <DetailRow label="Interests" value={interests} />
          </div>

          <div className="space-y-3">
            <SectionHeader title="Projects" />
            {projects.length ? projects.map((item: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-1">
                <div className="font-semibold text-[#1c1a17]/90">{fieldValue(item.name)}</div>
                <div className="text-sm text-[#1c1a17]/70 leading-7">{fieldValue(item.description)}</div>
                {asArray(item.technologies_used).length ? (
                  <div className="pt-1">{renderList(asArray(item.technologies_used), 'No technologies listed.')}</div>
                ) : null}
              </div>
            )) : <p className="text-sm text-[#1c1a17]/45">No projects found.</p>}
          </div>
        </div>
      );
    }

    if (agentName.includes('Brand Voice')) {
      const brand = asObject(output.brand_voice || output.brand_analysis || {});
      const userPersona = asObject(brand.user_persona);
      const voice = asObject(brand.brand_voice);
      const summary = asObject(brand.professional_summary);
      return (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
            <SectionHeader title="Professional Identity" subtitle="Who the model says this person is professionally." />
            <p className="text-sm text-[#1c1a17]/75 leading-7">{fieldValue(userPersona.professional_identity)}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <DetailRow label="Target Audience" value={userPersona.target_audience} />
            <DetailRow label="Career Trajectory" value={userPersona.career_trajectory} />
            <DetailRow label="Unique Value Proposition" value={userPersona.unique_value_proposition} />
            <DetailRow label="Personality Traits" value={asArray(userPersona.personality_traits)} />
            <DetailRow label="Professional Identity" value={userPersona.professional_identity} />
            <DetailRow label="Core Strengths" value={asArray(userPersona.core_strengths)} />
            <DetailRow label="Expertise Areas" value={asArray(userPersona.expertise_areas)} />
          </div>

          <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-4">
            <SectionHeader title="Brand Voice" subtitle="Writing tone, style, do's, don'ts, and communication pillars." />
            <div className="grid md:grid-cols-2 gap-3">
              <DetailRow label="Tone" value={voice.tone} />
              <DetailRow label="Style" value={voice.style} />
              <DetailRow label="Vocabulary Level" value={voice.vocabulary_level} />
              <DetailRow label="Communication Pillars" value={asArray(voice.communication_pillars)} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <DetailRow label="Content Themes" value={asArray(voice.content_themes)} />
              <DetailRow label="Sample Taglines" value={asArray(voice.sample_taglines)} />
              <DetailRow label="Do List" value={asArray(voice.do_list)} />
              <DetailRow label="Don't List" value={asArray(voice.dont_list)} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-3">
            <SectionHeader title="Professional Summary" subtitle="Useful copy for LinkedIn About and profile positioning." />
            <DetailRow label="Short Bio" value={summary.short_bio} />
            <DetailRow label="Elevator Pitch" value={summary.elevator_pitch} />
            <DetailRow label="LinkedIn About" value={summary.linkedin_about} />
            <DetailRow label="Key Hashtags" value={asArray(summary.key_hashtags)} />
          </div>

          {output.industry_context_used ? (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <SectionHeader title="Industry Context Used" subtitle="Search context used by the agent while generating the brand voice." />
              <p className="text-sm text-[#1c1a17]/70 leading-7 whitespace-pre-wrap">{fieldValue(output.industry_context_used)}</p>
            </div>
          ) : null}
        </div>
      );
    }

    if (agentName.includes('Influence') || agentName.includes('Idol Scout')) {
      const influencers = asArray(output.influencers);
      return (
        <div className="space-y-3">
          {output.warning ? (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100/80 leading-6">
              {String(output.warning)}
            </div>
          ) : null}
          <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 text-sm text-[#1c1a17]/75">
            Select one or more influencers in the workflow panel after this run completes.
          </div>
          {influencers.slice(0, 3).map((inf: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-black/5 border border-black/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                  <UserCheck size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{inf.title || inf.name || 'Influencer'}</div>
                  <div className="text-xs text-[#1c1a17]/45 truncate">{inf.snippet || inf.summary || 'LinkedIn benchmark candidate'}</div>
                </div>
              </div>
              {inf.link ? (
                <a href={inf.link} target="_blank" rel="noreferrer" className="text-[#1c1a17]/35 hover:text-accent">
                  <ExternalLink size={16} />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      );
    }

    if (agentName.includes('Posting Frequency Recommendation')) {
      const recommendedDays = asArray(output.recommended_days);
      const recommendedTypes = asArray(output.recommended_post_types);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Posts / Week" value={String(output.recommended_posts_per_week ?? output.posting_frequency ?? 'N/A')} icon={Clock3} />
            <StatCard label="Days" value={recommendedDays.length ? String(recommendedDays.length) : 'N/A'} icon={Sparkles} />
            <StatCard label="UTC Time" value={output.recommended_time_utc || '14:00'} icon={Globe} />
          </div>
          {renderList(recommendedTypes, 'Recommended post types will show here.')}
          {output.day_selection_rationale ? (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35 mb-2">Day Selection Logic</div>
              <p className="text-sm text-[#1c1a17]/70 leading-7">{output.day_selection_rationale}</p>
            </div>
          ) : null}
          <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
            <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35 mb-2">Cadence Rationale</div>
            <p className="text-sm text-[#1c1a17]/70 leading-7">{output.rationale || 'Weekly cadence computed from gap depth and selected influencer count.'}</p>
          </div>
        </div>
      );
    }

    if (agentName.includes('Gap Analysis')) {
      const overall = output.overall_gap_analysis || output.gap_analysis || {};
      const overallScores = output.overall_gap_scores || output.gap_scores || {};
      const strategy = output.overall_content_strategy || output.content_strategy || {};
      const actionPlan = asArray(output.overall_action_plan || output.action_plan);
      const perInfluencers = asArray(output.per_influencer_analysis);
      const contentPillars = asArray(strategy.content_pillars);
      const recommendedDays = asArray(strategy.recommended_days);

      return (
        <div className="space-y-5">
          {perInfluencers.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35">Selected Influencers</div>
              {perInfluencers.map((entry: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl bg-black/5 border border-black/10">
                  <div className="font-semibold mb-2">{entry.influencer?.title || `Influencer ${idx + 1}`}</div>
                  {entry.influencer?.link ? (
                    <a
                      href={entry.influencer.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent underline underline-offset-2 break-all"
                    >
                      {entry.influencer.link}
                    </a>
                  ) : null}
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    <DetailRow label="Profile Gap" value={entry.analysis?.gap_analysis?.profile_completeness_gap} />
                    <DetailRow label="Authority Gap" value={entry.analysis?.gap_analysis?.content_authority_gap} />
                    <DetailRow label="Engagement Gap" value={entry.analysis?.gap_analysis?.engagement_gap} />
                    <DetailRow label="Consistency Gap" value={entry.analysis?.gap_analysis?.posting_consistency_gap} />
                  </div>
                  <div className="grid md:grid-cols-3 gap-3 mt-3">
                    <DetailRow label="Profile Match" value={entry.analysis?.gap_scores?.profile_gap_score !== undefined ? `${entry.analysis.gap_scores.profile_gap_score}%` : 'N/A'} />
                    <DetailRow label="Authority Match" value={entry.analysis?.gap_scores?.authority_gap_score !== undefined ? `${entry.analysis.gap_scores.authority_gap_score}%` : 'N/A'} />
                    <DetailRow label="Engagement Match" value={entry.analysis?.gap_scores?.engagement_gap_score !== undefined ? `${entry.analysis.gap_scores.engagement_gap_score}%` : 'N/A'} />
                  </div>
                  {asArray(entry.analysis?.gap_analysis?.key_missing_elements).length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35 mb-2">Missing Elements</div>
                      {renderList(asArray(entry.analysis?.gap_analysis?.key_missing_elements), 'No missing elements listed.')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {asArray(output.analysis_errors).length > 0 && (
            <div className="space-y-3 mt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-red-500/60 font-bold">Analysis Failures</div>
              {asArray(output.analysis_errors).map((err: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                  <div className="font-semibold text-red-400 mb-1">{err.influencer?.title || `Influencer ${idx + 1}`}</div>
                  <p className="text-xs text-red-300/80 leading-5">{String(err.error).split('\n')[0]}</p>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
            <div className="text-xs uppercase tracking-[0.2em] text-accent mb-2">Overall Gap</div>
            <p className="text-sm text-[#1c1a17]/85 leading-7 font-medium">{overall.content_authority_gap || 'Combined gap summary generated.'}</p>
          </div>
          
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-900/80 leading-5">
              <strong>💡 How to read these metrics:</strong> A score of <strong>100%</strong> means your profile is a perfect match with the influencer's level of quality and engagement. A lower score (like <strong>20%</strong>) means you have a massive gap in that area and need to heavily improve your content to catch up to them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Overall Match" value={overallScores.overall_gap_score !== undefined ? `${overallScores.overall_gap_score}%` : 'N/A'} icon={BarChart3} />
            <StatCard label="Authority Match" value={overallScores.authority_gap_score !== undefined ? `${overallScores.authority_gap_score}%` : 'N/A'} icon={Sparkles} />
            <StatCard label="Engagement Match" value={overallScores.engagement_gap_score !== undefined ? `${overallScores.engagement_gap_score}%` : 'N/A'} icon={UserCheck} />
          </div>
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35">Content Pillars</div>
            {renderList(contentPillars, 'Content pillars will appear here.')}
          </div>
          {recommendedDays.length > 0 ? (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35 mb-2">Recommended Posting Days</div>
              {renderList(recommendedDays, 'No day recommendations.')}
              <p className="text-sm text-[#1c1a17]/75 leading-7 mt-3 font-medium">{strategy.day_selection_rationale || 'Day recommendation is based on consistency and engagement gap.'}</p>
            </div>
          ) : null}
          {actionPlan.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35">Action Plan</div>
              {actionPlan.map((step: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-black/5 border border-black/10">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                  <div className="text-sm text-[#1c1a17]/80 leading-7 font-medium">{step}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    if (agentName.includes('Prompt Generator') || agentName.includes('Post Generator')) {
      const scheduledDays = asArray(output.posting_schedule_days).map((day) => String(day));
      const prompt = output.post_generation_prompt || '';
      const topics = asArray(output.suggested_post_topics);
      const triggers = asArray(output.engagement_triggers);
      const trends = asArray(output.current_domain_trends);
      const dosList = output.dos_and_donts?.do_list || [];
      const dontsList = output.dos_and_donts?.dont_list || [];
      
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard label="Posting Frequency" value={output.posting_frequency || 'N/A'} icon={BarChart3} />
            <StatCard label="Scheduled Days" value={scheduledDays.join(', ') || 'N/A'} icon={Clock3} />
          </div>

          {/* Calendar Schedule */}
          {scheduledDays.length > 0 && (
            <ScheduleCalendar scheduledDays={scheduledDays} />
          )}
          
          {/* Main Prompt Section */}
          {prompt && (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-semibold text-[#1c1a17]">Post Generation Prompt</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(prompt);
                    toast.success('Prompt copied to clipboard');
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-black/10 border border-black/10 text-[#1c1a17]/70 hover:bg-black/20"
                >
                  Copy Prompt
                </button>
              </div>
              <p className="text-sm text-[#1c1a17]/70 leading-7 whitespace-pre-wrap max-h-64 overflow-y-auto">{prompt}</p>
            </div>
          )}
          
          {/* Suggested Topics */}
          {topics.length > 0 && (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="font-semibold text-[#1c1a17] mb-3">Suggested Post Topics</div>
              <ul className="space-y-2">
                {topics.map((topic: any, idx: number) => (
                  <li key={idx} className="text-sm text-[#1c1a17]/70 flex items-start gap-2">
                    <span className="text-[#1c1a17]/50 mt-1">•</span>
                    <span>{String(topic)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Domain Trends */}
          {trends.length > 0 && (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="font-semibold text-[#1c1a17] mb-3">Current Domain Trends</div>
              <ul className="space-y-2">
                {trends.map((trend: any, idx: number) => (
                  <li key={idx} className="text-sm text-[#1c1a17]/70 flex items-start gap-2">
                    <span className="text-[#1c1a17]/50 mt-1">•</span>
                    <span>{String(trend)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Do's and Don'ts */}
          {(dosList.length > 0 || dontsList.length > 0) && (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="font-semibold text-[#1c1a17] mb-3">Do's and Don'ts</div>
              <div className="space-y-3">
                {dosList.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-green-700 mb-2">✓ DO:</div>
                    <ul className="space-y-1">
                      {dosList.map((item: any, idx: number) => (
                        <li key={idx} className="text-sm text-[#1c1a17]/70 ml-3">• {String(item)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {dontsList.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-red-700 mb-2">✗ DON'T:</div>
                    <ul className="space-y-1">
                      {dontsList.map((item: any, idx: number) => (
                        <li key={idx} className="text-sm text-[#1c1a17]/70 ml-3">• {String(item)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Engagement Triggers */}
          {triggers.length > 0 && (
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
              <div className="font-semibold text-[#1c1a17] mb-3">Engagement Triggers</div>
              <ul className="space-y-2">
                {triggers.map((trigger: any, idx: number) => (
                  <li key={idx} className="text-sm text-[#1c1a17]/70 flex items-start gap-2">
                    <span className="text-[#1c1a17]/50 mt-1">•</span>
                    <span>{String(trigger)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (agentName.includes('Prompt Delivery') || agentName.includes('Post Delivery') || agentName.includes('Email Reminder')) {
      const recipient = output.recipient || output.to || 'registered user email';
      const postsCount = output.posts_count ?? asArray(output.posts).length;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard label="Delivery Status" value={output.email_sent ? 'Sent' : 'Queued'} icon={Mail} />
            <StatCard label="Posts Sent" value={String(postsCount || 'N/A')} icon={Sparkles} />
          </div>
          <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35">Recipient</div>
            <div className="text-sm text-[#1c1a17]/80 font-semibold break-words">{fieldValue(recipient)}</div>
            <div className="text-sm text-[#1c1a17]/65 leading-7">
              {output.message || 'Generated posts were delivered to the registered Outlook inbox.'}
            </div>
          </div>
          {output.reminder_message ? (
            <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
              <div className="text-xs uppercase tracking-[0.2em] text-accent mb-2">Email Message</div>
              <p className="text-sm text-[#1c1a17]/75 leading-7">{output.reminder_message}</p>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
        <pre className="text-[11px] text-[#1c1a17]/35 overflow-auto max-h-64 whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`${glassCard} flex flex-col h-full`}
    >
      <div className="p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSuccess ? 'bg-primary/15 text-primary' : 'bg-black/5 text-[#1c1a17]/25'}`}>
              <Cpu size={24} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-black/15 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1c1a17]/65 mb-2">
                Agent {index + 1} {agentName}
              </div>
              <div className="font-heading text-xl font-semibold truncate text-[#1c1a17]">{agentName.replace(' Agent', '')}</div>
              <div className="text-xs text-[#1c1a17]/35">Autonomous graph output</div>
            </div>
          </div>
          {isSuccess ? <CheckCircle2 size={18} className="text-accent shrink-0" /> : null}
        </div>

        {!isSuccess && errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-red-200/75 mb-2">Agent Error</div>
            <p className="text-sm text-red-50/90 leading-6 whitespace-pre-wrap break-words">{errorMessage}</p>
          </div>
        ) : null}

        <div className="min-h-[180px]">{renderContent()}</div>
      </div>

      <div className="mt-auto px-6 pb-6 pt-0 flex items-center justify-between border-t border-black/10">
        <div className="text-[10px] uppercase tracking-[0.24em] text-[#1c1a17]/30 flex items-center gap-2">
          <Globe size={12} /> Live pipeline result
        </div>
        {onRunAgain ? (
          <button
            type="button"
            onClick={onRunAgain}
            disabled={Boolean(isRunning)}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-4 py-2 text-xs font-semibold text-[#1c1a17]/75 transition-colors hover:border-accent/30 hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run again
            <ChevronRight size={16} />
          </button>
        ) : (
          <button className="text-[#1c1a17]/45 hover:text-accent transition-colors">
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="p-4 rounded-2xl bg-black/5 border border-black/10">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="text-xs uppercase tracking-[0.18em] text-[#1c1a17]/35">{label}</div>
        <Icon size={16} className="text-accent" />
      </div>
      <div className="text-sm text-[#1c1a17]/80 font-semibold leading-6 break-words">{value}</div>
    </div>
  );
}

export default AgentCard;
