"use client";

import { useToast } from "@/context/ToastContext";
import { InfoItem, TagSection } from "./InfoItem";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function PostGeneratorOutput({ output }: { output: any }) {
  const posts: any[] = output.posts || [];
  const { showToast } = useToast();

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
  };

  const extractHook = (content: string) => {
    const lines = String(content || "").split("\n").map((l) => l.trim()).filter(Boolean);
    return lines[0] || "Here is your highlighted post idea.";
  };

  const highlightHashtags = (content: string) => {
    return String(content || "")
      .split("\n")
      .map((line, i) => {
        const parts = line.split(/(#[A-Za-z0-9_]+)/g);
        return (
          <span key={i}>
            {parts.map((part, j) =>
              part.startsWith("#") ? (
                <span key={j} className="post-hashtag">{part}</span>
              ) : (
                part
              )
            )}
            <br />
          </span>
        );
      });
  };

  return (
    <div className="output-section">
      <div className="output-section-title">LinkedIn Post Plan</div>
      <div className="output-grid">
        <InfoItem label="Posting Frequency" value={output.posting_frequency} />
        <InfoItem label="Strategy Summary" value={output.content_strategy_summary} />
      </div>
      <TagSection label="Recommended Post Types" items={output.recommended_post_types} tagClass="tag-cyan" />

      <div className="interactive-post-list">
        {posts.map((post, i) => (
          <article key={i} className="interactive-post-card">
            <div className="post-card-top">
              <span className="badge-post-type">{post.type || "N/A"}</span>
              <span className="post-index">Post {i + 1}</span>
            </div>

            <p className="post-hook">{extractHook(post.content)}</p>

            <details className="post-details" open={i === 0}>
              <summary>Read full post</summary>
              <div className="post-content-readable">{highlightHashtags(post.content)}</div>
            </details>

            <div className="post-action-row">
              <button className="btn btn-ghost post-action-btn" onClick={() => copyText(post.content || "")}>
                Copy Post
              </button>
              {post.image_search_query && (
                <button className="btn btn-ghost post-action-btn" onClick={() => copyText(post.image_search_query)}>
                  Copy Image Query
                </button>
              )}
            </div>

            <div className="post-meta-grid">
              <InfoItem label="Goal" value={post.goal} />
              <InfoItem label="Image Prompt" value={post.image_prompt} />
            </div>

            {post.image_search_query && (
              <p className="exp-desc"><strong>Image Search Query:</strong> {post.image_search_query}</p>
            )}

            {post.reference_images?.length > 0 ? (
              <div className="post-image-section">
                <p className="exp-desc" style={{ marginBottom: "0.5rem" }}><strong>Suggested Real Images:</strong></p>
                <div className="image-suggestions-grid">
                  {post.reference_images.map((img: any, idx: number) => (
                    <a
                      key={idx}
                      href={img.page_url || img.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="image-suggestion-card"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.image_url} alt={`Suggested image ${idx + 1}`} className="image-suggestion-preview" loading="lazy" />
                      <div className="image-suggestion-caption">{img.title || img.source || "Open source"}</div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="exp-desc"><strong>Suggested Real Images:</strong> No web images found for this post yet.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
