"use client";

import { InfoItem, TagSection } from "./InfoItem";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function GapAnalysisOutput({ output }: { output: any }) {
  const gap = output.gap_analysis || {};
  const strategy = output.content_strategy || {};
  const actions: string[] = output.action_plan || [];

  return (
    <div className="output-section">
      <div className="output-section-title">Gap Summary</div>
      <div className="output-grid">
        <InfoItem label="Profile Gap" value={gap.profile_completeness_gap} />
        <InfoItem label="Authority Gap" value={gap.content_authority_gap} />
        <InfoItem label="Engagement Gap" value={gap.engagement_gap} />
      </div>
      <TagSection label="Missing Elements" items={gap.key_missing_elements} tagClass="tag-rose" />
      <TagSection label="Content Pillars" items={strategy.content_pillars} tagClass="tag-purple" />
      {strategy.tone_adjustment && (
        <div className="text-block" style={{ marginTop: "0.75rem" }}>
          <strong>Tone Adjustment:</strong> {strategy.tone_adjustment}
        </div>
      )}
      {actions.length > 0 && (
        <div className="text-block" style={{ marginTop: "0.75rem" }}>
          <strong>Action Plan:</strong>
          <br />
          {actions.map((a, i) => (
            <span key={i}>{i + 1}. {a}<br /></span>
          ))}
        </div>
      )}
    </div>
  );
}
