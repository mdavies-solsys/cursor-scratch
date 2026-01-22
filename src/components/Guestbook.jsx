import React, { useEffect, useMemo, useState } from "react";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Guestbook = () => {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState("0");
  const [status, setStatus] = useState({ message: "", tone: "" });
  const [note, setNote] = useState("Handles must be 1-15 characters.");
  const [handle, setHandle] = useState("");
  const [company, setCompany] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  const guestbookEndpoint = useMemo(() => {
    const queryApi = new URLSearchParams(window.location.search).get("guestbookApi");
    const metaApi = document.querySelector('meta[name="guestbook-api"]')?.content;
    const rawApi = (queryApi || metaApi || "").trim();
    const apiBase = rawApi.replace(/\/+$/, "");
    if (!apiBase) return "";
    return apiBase.endsWith("/guestbook") ? apiBase : `${apiBase}/guestbook`;
  }, []);

  const setStatusMessage = (message, tone) => {
    setStatus({ message: message || "", tone: tone || "" });
  };

  const loadGuestbook = async () => {
    if (!guestbookEndpoint) {
      setStatusMessage("Guestbook API is not configured yet.", "error");
      setIsDisabled(true);
      setNote("Ask Matt for the guestbook API link.");
      setItems([]);
      setCount("0");
      return;
    }

    try {
      const response = await fetch(guestbookEndpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load guestbook.");
      }
      const data = await response.json();
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      setCount(String(data.total || nextItems.length || 0));
    } catch (error) {
      setStatusMessage("Guestbook unavailable right now.", "error");
    }
  };

  useEffect(() => {
    loadGuestbook();
  }, [guestbookEndpoint]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!guestbookEndpoint) return;
    setIsSubmitting(true);
    setStatusMessage("Submitting...", "");

    try {
      const response = await fetch(guestbookEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: handle.trim(), company: company.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to submit.");
      }
      setStatusMessage(data.deduped ? "You are already on the list." : "Added to the guestbook.", "success");
      setHandle("");
      setCompany("");
      await loadGuestbook();
    } catch (error) {
      setStatusMessage(error?.message || "Unable to submit right now.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="glass guestbook" data-guestbook>
      <h2>Guestbook</h2>
      <p>Drop your X handle to join the guestbook. No OAuth, no login, just a handle.</p>
      <form className="guestbook-form" data-guestbook-form onSubmit={handleSubmit}>
        <label className="guestbook-field">
          <span className="guestbook-label">X handle</span>
          <input
            className="guestbook-input"
            type="text"
            name="handle"
            placeholder="@yourhandle"
            autoComplete="off"
            spellCheck="false"
            required
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            disabled={isDisabled}
          />
        </label>
        <input
          className="guestbook-honeypot"
          type="text"
          name="company"
          tabIndex="-1"
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
        <div className="guestbook-actions">
          <button className="guestbook-button" type="submit" disabled={isDisabled || isSubmitting}>
            Sign guestbook
          </button>
          <span className="guestbook-time" data-guestbook-note>
            {note}
          </span>
        </div>
      </form>
      <div className="guestbook-status" data-guestbook-status data-tone={status.tone} aria-live="polite">
        {status.message}
      </div>
      <div className="guestbook-list-wrap">
        <div className="guestbook-list-header">
          <span>Recent signers</span>
          <span className="guestbook-count" data-guestbook-count>
            {count}
          </span>
        </div>
        <ul className="guestbook-list" data-guestbook-list>
          {!items.length ? (
            <li className="guestbook-empty">Be the first to sign.</li>
          ) : (
            items.map((item) => (
              <li key={`${item.handle}-${item.submittedAt}`}>
                <span
                  className="guestbook-avatar"
                  style={{
                    backgroundImage: `url("https://unavatar.io/twitter/${encodeURIComponent(item.handle)}")`,
                  }}
                  aria-hidden="true"
                ></span>
                <a className="guestbook-handle" href={`https://x.com/${item.handle}`} target="_blank" rel="noreferrer">
                  @{item.handle}
                </a>
                <span className="guestbook-time">{formatDate(item.submittedAt)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
};

export default Guestbook;
