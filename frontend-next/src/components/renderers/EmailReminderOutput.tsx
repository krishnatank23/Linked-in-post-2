"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  status: string;
  output: any;
}

export default function EmailReminderOutput({ status, output }: Props) {
  if (status === "skipped") {
    return (
      <div className="output-section">
        <div className="output-section-title">Email Reminder</div>
        <div style={{ padding: "1rem", background: "rgba(100, 150, 255, 0.1)", borderLeft: "4px solid #0077b5", borderRadius: 4 }}>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Email reminder skipped. Complete all previous steps first.
          </p>
        </div>
      </div>
    );
  }

  if (!output) {
    return <p style={{ color: "var(--text-muted)" }}>No email reminder data available.</p>;
  }

  const success = output.email_sent === true;
  const recipient = output.recipient || "user";
  const message = output.message || "Email sent successfully";
  const postsCount = output.posts_count || 0;

  return (
    <div className="output-section">
      <div className="output-section-title">Email Reminder Sent</div>
      <div style={{
        padding: "1.5rem",
        background: success ? "rgba(76, 175, 80, 0.1)" : "rgba(100, 150, 255, 0.1)",
        borderLeft: `4px solid ${success ? "#4caf50" : "#0077b5"}`,
        borderRadius: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "1.5rem" }}>{success ? "\u2705" : "\u2139\uFE0F"}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
              {success ? "Reminder Email Sent!" : "Email Reminder Status"}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>
              {message}
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>Recipient</p>
            <p style={{ margin: "0.5rem 0 0", fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-sm)" }}>{recipient}</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>Posts Included</p>
            <p style={{ margin: "0.5rem 0 0", fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-sm)" }}>{postsCount} post{postsCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {success
              ? "Your LinkedIn posts with accompanying images and funny reminders have been sent to your Outlook inbox!"
              : "Make sure to configure your email settings in the backend .env file with your Outlook credentials."}
          </p>
        </div>
      </div>
    </div>
  );
}
