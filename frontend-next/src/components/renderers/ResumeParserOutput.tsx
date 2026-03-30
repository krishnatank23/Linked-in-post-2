"use client";

import { InfoItem, TagSection } from "./InfoItem";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ResumeParserOutput({ output }: { output: any }) {
  const profile = output.parsed_profile || {};
  const personal = profile.personal_info || {};
  const skills = profile.skills || {};
  const experience: any[] = profile.experience || [];
  const education: any[] = profile.education || [];

  return (
    <>
      {/* Personal Info */}
      <div className="output-section">
        <div className="output-section-title">Personal Information</div>
        <div className="output-grid">
          <InfoItem label="Full Name" value={personal.full_name} />
          <InfoItem label="Email" value={personal.email} />
          <InfoItem label="Phone" value={personal.phone} />
          <InfoItem label="Location" value={personal.location} />
          <InfoItem label="LinkedIn" value={personal.linkedin_url} />
          <InfoItem label="Portfolio" value={personal.portfolio_url} />
        </div>
      </div>

      {/* Professional Summary */}
      {profile.professional_summary && (
        <div className="output-section">
          <div className="output-section-title">Professional Summary</div>
          <div className="text-block highlight">{profile.professional_summary}</div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="output-section">
        <div className="output-section-title">Quick Overview</div>
        <div className="output-grid">
          <InfoItem label="Current Role" value={profile.current_role} />
          <InfoItem label="Industry" value={profile.industry} />
          <InfoItem label="Experience" value={profile.total_years_of_experience} />
          <InfoItem label="Text Analyzed" value={`${output.raw_text_length || 0} chars`} />
        </div>
      </div>

      {/* Skills */}
      {Object.keys(skills).length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Skills & Technologies</div>
          <TagSection label="Technical Skills" items={skills.technical_skills} />
          <TagSection label="Soft Skills" items={skills.soft_skills} tagClass="tag-cyan" />
          <TagSection label="Tools & Technologies" items={skills.tools_and_technologies} tagClass="tag-purple" />
          <TagSection label="Languages" items={skills.languages} tagClass="tag-amber" />
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Experience</div>
          <div className="experience-list">
            {experience.map((exp: any, i: number) => (
              <div key={i} className="experience-item">
                <h4>{exp.role || "N/A"}</h4>
                <span className="exp-company">{exp.company || ""}</span>
                <span className="exp-duration"> · {exp.duration || ""}</span>
                {exp.description && <p className="exp-desc">{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Education</div>
          <div className="experience-list">
            {education.map((edu: any, i: number) => (
              <div key={i} className="experience-item">
                <h4>{edu.degree || ""} {edu.field_of_study ? `in ${edu.field_of_study}` : ""}</h4>
                <span className="exp-company">{edu.institution || ""}</span>
                {edu.year && <span className="exp-duration"> · {edu.year}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expertise */}
      {profile.expertise_areas?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Expertise Areas</div>
          <TagSection items={profile.expertise_areas} tagClass="tag-emerald" />
        </div>
      )}

      {/* Certifications */}
      {profile.certifications?.length > 0 && (
        <div className="output-section">
          <div className="output-section-title">Certifications</div>
          <TagSection items={profile.certifications} tagClass="tag-amber" />
        </div>
      )}
    </>
  );
}
