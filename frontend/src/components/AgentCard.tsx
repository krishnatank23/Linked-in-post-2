import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Cpu, ExternalLink, Globe, UserCheck, BarChart3, Sparkles, Clock3, Mail, Calendar, Edit3, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { glassCard } from '../styles/classes';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

export function ScheduleCalendar({ scheduledDays }: { scheduledDays: string[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  const days: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];
  
  return (
    <div className="p-6 rounded-2xl bg-white border border-black/[0.08] shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold mb-1">Content Calendar</div>
          <div className="font-bold text-[#1c1a17] text-xl tracking-tight">{monthNames[month]} {year}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/40">
          <Calendar size={20} />
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {shortDayNames.map((day) => (
          <div key={day} className="text-center text-[10px] font-bold tracking-widest text-black/30 py-2 uppercase">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          if (date === null) return <div key={`empty-${idx}`} className="h-10"></div>;
          
          const currentDate = new Date(year, month, date);
          const dayName = dayNames[currentDate.getDay()];
          const isScheduled = scheduledDays.includes(dayName);
          const isToday = date === today.getDate();
          
          return (
            <div 
              key={date} 
              className={`
                relative flex flex-col items-center justify-center h-10 w-full rounded-lg text-sm transition-all
                ${isToday ? 'bg-[#c9714f] text-white font-bold shadow-md shadow-[#c9714f]/20' : 'text-black/60 hover:bg-black/5'}
              `}
            >
              <span>{date}</span>
              {isScheduled && !isToday && (
                <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[#c9714f]/40" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-5 border-t border-black/[0.05] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-black/40">
            <div className="w-2 h-2 rounded-full bg-[#c9714f]" />
            <span className="font-medium">Today</span>
          </div>
          <div className="flex items-center gap-1.5 text-black/40">
            <div className="w-1.5 h-1.5 rounded-full bg-black/10" />
            <span className="font-medium">Posting Day</span>
          </div>
        </div>
        <div className="text-black/30 font-medium">
          {scheduledDays.length} posts scheduled
        </div>
      </div>
    </div>
  );
}


const AgentCard = ({ data, index, onRunAgain, isRunning }: AgentCardProps) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const isSuccess = data.status === 'success';
  const agentName = String(data.agent_name || 'Agent');
  const output = data.output || {};
  const errorMessage = String(data.error || '').trim();

  const setField = (path: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [path]: value }));
  };

  const getField = (path: string, fallback: any) => {
    return path in editedFields ? editedFields[path] : fallback;
  };

  const handleSaveBrandVoice = async (brand: any) => {
    try {
      setSaving(true);
      // Merge edited fields back into the brand object
      const up = (obj: any, path: string) => editedFields[path] !== undefined ? editedFields[path] : obj;
      const splitLines = (val: string) => val.split('\n').map(s => s.trim()).filter(Boolean);

      const updated = {
        ...brand,
        user_persona: {
          ...asObject(brand.user_persona),
          professional_identity: up(asObject(brand.user_persona).professional_identity, 'persona.professional_identity'),
          target_audience: up(asObject(brand.user_persona).target_audience, 'persona.target_audience'),
          career_trajectory: up(asObject(brand.user_persona).career_trajectory, 'persona.career_trajectory'),
          unique_value_proposition: up(asObject(brand.user_persona).unique_value_proposition, 'persona.unique_value_proposition'),
          personality_traits: editedFields['persona.personality_traits'] !== undefined
            ? splitLines(editedFields['persona.personality_traits'])
            : asArray(asObject(brand.user_persona).personality_traits),
          core_strengths: editedFields['persona.core_strengths'] !== undefined
            ? splitLines(editedFields['persona.core_strengths'])
            : asArray(asObject(brand.user_persona).core_strengths),
          expertise_areas: editedFields['persona.expertise_areas'] !== undefined
            ? splitLines(editedFields['persona.expertise_areas'])
            : asArray(asObject(brand.user_persona).expertise_areas),
        },
        brand_voice: {
          ...asObject(brand.brand_voice),
          tone: up(asObject(brand.brand_voice).tone, 'voice.tone'),
          style: up(asObject(brand.brand_voice).style, 'voice.style'),
          vocabulary_level: up(asObject(brand.brand_voice).vocabulary_level, 'voice.vocabulary_level'),
          communication_pillars: editedFields['voice.communication_pillars'] !== undefined
            ? splitLines(editedFields['voice.communication_pillars'])
            : asArray(asObject(brand.brand_voice).communication_pillars),
          content_themes: editedFields['voice.content_themes'] !== undefined
            ? splitLines(editedFields['voice.content_themes'])
            : asArray(asObject(brand.brand_voice).content_themes),
          sample_taglines: editedFields['voice.sample_taglines'] !== undefined
            ? splitLines(editedFields['voice.sample_taglines'])
            : asArray(asObject(brand.brand_voice).sample_taglines),
          do_list: editedFields['voice.do_list'] !== undefined
            ? splitLines(editedFields['voice.do_list'])
            : asArray(asObject(brand.brand_voice).do_list),
          dont_list: editedFields['voice.dont_list'] !== undefined
            ? splitLines(editedFields['voice.dont_list'])
            : asArray(asObject(brand.brand_voice).dont_list),
        },
        professional_summary: {
          ...asObject(brand.professional_summary),
          short_bio: up(asObject(brand.professional_summary).short_bio, 'summary.short_bio'),
          elevator_pitch: up(asObject(brand.professional_summary).elevator_pitch, 'summary.elevator_pitch'),
          linkedin_about: up(asObject(brand.professional_summary).linkedin_about, 'summary.linkedin_about'),
          key_hashtags: editedFields['summary.key_hashtags'] !== undefined
            ? splitLines(editedFields['summary.key_hashtags'])
            : asArray(asObject(brand.professional_summary).key_hashtags),
        },
      };

      await api.post('/pipeline/update-brand-voice', {
        user_id: user?.id,
        brand_voice_data: updated
      });
      toast.success('Brand voice updated successfully.');
      setIsEditing(false);
      setEditedFields({});

      // Update output in-place so the card reflects changes immediately
      if (output.brand_voice) output.brand_voice = updated;
      if (output.brand_analysis) output.brand_analysis = updated;
    } catch {
      toast.error('Failed to save brand voice.');
    } finally {
      setSaving(false);
    }
  };

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

      // Helper for editable textarea/input with same visual style as original
      const EditField = ({ path, label, value, multiline = false, hint }: { path: string; label: string; value: any; multiline?: boolean; hint?: string }) => {
        const rawVal = Array.isArray(value) ? value.join('\n') : (value || '');
        const current = getField(path, rawVal);
        const Tag = multiline ? 'textarea' : 'input';
        return (
          <div className="p-3 rounded-xl bg-white/60 border border-[#c9714f]/30">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#1c1a17]/40 font-bold mb-1.5">{label}</div>
            {hint && <div className="text-[11px] text-[#1c1a17]/35 mb-1.5">{hint}</div>}
            <Tag
              className={`w-full text-sm text-[#1c1a17]/80 bg-transparent border-none outline-none resize-none leading-6 ${multiline ? 'min-h-[80px]' : ''}`}
              value={current}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(path, e.target.value)}
              rows={multiline ? 4 : undefined}
            />
          </div>
        );
      };

      if (isEditing) {
        return (
          <div className="space-y-5">
            {/* Edit mode header */}
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[#1c1a17]">Edit Brand Voice</div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setIsEditing(false); setEditedFields({}); }} disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold text-[#1c1a17]/60 hover:text-[#1c1a17] bg-black/5 hover:bg-black/10 rounded-lg transition-colors flex items-center gap-1">
                  <X size={14} /> Cancel
                </button>
                <button onClick={() => handleSaveBrandVoice(brand)} disabled={saving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#c9714f] hover:bg-[#b05d3f] rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1">
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Professional Identity */}
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-3">
              <SectionHeader title="Professional Identity" subtitle="Who the model says this person is professionally." />
              <EditField path="persona.professional_identity" label="Professional Identity" value={userPersona.professional_identity} multiline />
            </div>

            {/* Persona grid */}
            <div className="grid md:grid-cols-2 gap-3">
              <EditField path="persona.target_audience" label="Target Audience" value={userPersona.target_audience} multiline />
              <EditField path="persona.career_trajectory" label="Career Trajectory" value={userPersona.career_trajectory} multiline />
              <EditField path="persona.unique_value_proposition" label="Unique Value Proposition" value={userPersona.unique_value_proposition} multiline />
              <EditField path="persona.personality_traits" label="Personality Traits" value={asArray(userPersona.personality_traits)} multiline hint="One per line" />
              <EditField path="persona.core_strengths" label="Core Strengths" value={asArray(userPersona.core_strengths)} multiline hint="One per line" />
              <EditField path="persona.expertise_areas" label="Expertise Areas" value={asArray(userPersona.expertise_areas)} multiline hint="One per line" />
            </div>

            {/* Brand Voice */}
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-3">
              <SectionHeader title="Brand Voice" subtitle="Writing tone, style, do's, don'ts, and communication pillars." />
              <div className="grid md:grid-cols-2 gap-3">
                <EditField path="voice.tone" label="Tone" value={voice.tone} />
                <EditField path="voice.style" label="Style" value={voice.style} />
                <EditField path="voice.vocabulary_level" label="Vocabulary Level" value={voice.vocabulary_level} />
                <EditField path="voice.communication_pillars" label="Communication Pillars" value={asArray(voice.communication_pillars)} multiline hint="One per line" />
                <EditField path="voice.content_themes" label="Content Themes" value={asArray(voice.content_themes)} multiline hint="One per line" />
                <EditField path="voice.sample_taglines" label="Sample Taglines" value={asArray(voice.sample_taglines)} multiline hint="One per line" />
                <EditField path="voice.do_list" label="Do List" value={asArray(voice.do_list)} multiline hint="One per line" />
                <EditField path="voice.dont_list" label="Don't List" value={asArray(voice.dont_list)} multiline hint="One per line" />
              </div>
            </div>

            {/* Professional Summary */}
            <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-3">
              <SectionHeader title="Professional Summary" subtitle="Useful copy for LinkedIn About and profile positioning." />
              <EditField path="summary.short_bio" label="Short Bio" value={summary.short_bio} multiline />
              <EditField path="summary.elevator_pitch" label="Elevator Pitch" value={summary.elevator_pitch} multiline />
              <EditField path="summary.linkedin_about" label="LinkedIn About" value={summary.linkedin_about} multiline />
              <EditField path="summary.key_hashtags" label="Key Hashtags" value={asArray(summary.key_hashtags)} multiline hint="One per line" />
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-5">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-xs font-semibold text-[#1c1a17]/70 hover:text-white bg-black/5 hover:bg-black rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Edit3 size={14} /> Edit Brand Voice
            </button>
          </div>
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
          {influencers.slice(0, 6).map((inf: any, i: number) => (
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
          {/* Calendar Schedule */}
          {scheduledDays.length > 0 && (
            <ScheduleCalendar scheduledDays={scheduledDays} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard label="Posting Frequency" value={output.posting_frequency || 'N/A'} icon={BarChart3} />
            <StatCard label="Scheduled Days" value={scheduledDays.join(', ') || 'N/A'} icon={Clock3} />
          </div>
          
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
