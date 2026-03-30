"use client";

import { InfoItem, TagSection } from "./InfoItem";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function BrandVoiceOutput({ output }: { output: any }) {
  const brand = output.brand_analysis || {};
  const persona = brand.user_persona || {};
  const voice = brand.brand_voice || {};
  const summary = brand.professional_summary || {};

  return (
    <>
      {persona.professional_identity && (
        <div className="output-section">
          <div className="output-section-title">Professional Identity</div>
          <div className="text-block highlight">{persona.professional_identity}</div>
        </div>
      )}

      {persona.unique_value_proposition && (
        <div className="output-section">
          <div className="output-section-title">Unique Value Proposition</div>
          <div className="text-block highlight">{persona.unique_value_proposition}</div>
        </div>
      )}

      {persona.core_strengths?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Core Strengths</div>
          <TagSection items={persona.core_strengths} tagClass="tag-emerald" />
        </div>
      )}

      <div className="output-section">
        <div className="output-section-title">Profile Attributes</div>
        <div className="output-grid">
          <InfoItem label="Target Audience" value={persona.target_audience} />
          <InfoItem label="Career Trajectory" value={persona.career_trajectory} />
        </div>
        {persona.personality_traits && (
          <TagSection label="Personality Traits" items={persona.personality_traits} tagClass="tag-purple" />
        )}
      </div>

      <div className="output-section">
        <div className="output-section-title">Brand Voice</div>
        <div className="output-grid">
          <InfoItem label="Tone" value={voice.tone} />
          <InfoItem label="Style" value={voice.style} />
          <InfoItem label="Vocabulary" value={voice.vocabulary_level} />
        </div>
      </div>

      {voice.content_themes?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Content Themes</div>
          <TagSection items={voice.content_themes} tagClass="tag-cyan" />
        </div>
      )}

      {(voice.do_list || voice.dont_list) && (
        <div className="output-section">
          <div className="output-section-title">Branding Guidelines</div>
          <div className="output-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="output-item" style={{ borderLeft: "3px solid var(--accent-emerald)" }}>
              <div className="output-item-label" style={{ color: "var(--accent-emerald)" }}>Do</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {(voice.do_list || []).map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)", padding: "0.2rem 0" }}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="output-item" style={{ borderLeft: "3px solid var(--accent-rose)" }}>
              <div className="output-item-label" style={{ color: "var(--accent-rose)" }}>Don&apos;t</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {(voice.dont_list || []).map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)", padding: "0.2rem 0" }}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {voice.sample_taglines?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Suggested Taglines</div>
          <div className="experience-list">
            {voice.sample_taglines.map((tag: string, i: number) => (
              <div key={i} className="text-block" style={{ borderLeft: "3px solid var(--accent-indigo)", padding: "0.75rem 1rem", fontStyle: "italic" }}>
                &ldquo;{tag}&rdquo;
              </div>
            ))}
          </div>
        </div>
      )}

      {voice.communication_pillars?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Communication Pillars</div>
          <TagSection items={voice.communication_pillars} />
        </div>
      )}

      {summary.short_bio && (
        <div className="output-section">
          <div className="output-section-title">Professional Bio</div>
          <div className="text-block highlight">{summary.short_bio}</div>
        </div>
      )}

      {summary.elevator_pitch && (
        <div className="output-section">
          <div className="output-section-title">Elevator Pitch</div>
          <div className="text-block">{summary.elevator_pitch}</div>
        </div>
      )}

      {summary.linkedin_about && (
        <div className="output-section">
          <div className="output-section-title">Recommended LinkedIn About</div>
          <div className="text-block" style={{ whiteSpace: "pre-line" }}>{summary.linkedin_about}</div>
        </div>
      )}

      {summary.key_hashtags?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title"># Recommended Hashtags</div>
          <TagSection items={summary.key_hashtags} tagClass="tag-cyan" />
        </div>
      )}
    </>
  );
}
