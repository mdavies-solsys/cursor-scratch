import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Guestbook = () => {
  const sectionRef = useRef(null);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState("0");
  const [status, setStatus] = useState({ message: "", tone: "" });
  const [note, setNote] = useState("Handles must be 1-15 characters. Entries appear after approval.");
  const [handle, setHandle] = useState("");
  const [company, setCompany] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [adminItems, setAdminItems] = useState([]);
  const [adminStatus, setAdminStatus] = useState({ message: "", tone: "" });
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const guestbookEndpoint = useMemo(() => {
    const queryApi = new URLSearchParams(window.location.search).get("guestbookApi");
    const metaApi = document.querySelector('meta[name="guestbook-api"]')?.content;
    const rawApi = (queryApi || metaApi || "").trim();
    const apiBase = rawApi.replace(/\/+$/, "");
    if (!apiBase) return "";
    return apiBase.endsWith("/guestbook") ? apiBase : `${apiBase}/guestbook`;
  }, []);

  const guestbookAdminEndpoint = useMemo(() => {
    if (!guestbookEndpoint) return "";
    return guestbookEndpoint.replace(/\/guestbook$/, "/guestbook/admin");
  }, [guestbookEndpoint]);

  const setStatusMessage = (message, tone) => {
    setStatus({ message: message || "", tone: tone || "" });
  };

  const setAdminStatusMessage = (message, tone) => {
    setAdminStatus({ message: message || "", tone: tone || "" });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const enabled = params.get("guestbookAdmin") === "1";
    if (enabled) {
      window.localStorage.setItem("guestbookAdmin", "1");
      setAdminMode(true);
    } else if (window.localStorage.getItem("guestbookAdmin") === "1") {
      setAdminMode(true);
    }
    const savedToken = window.localStorage.getItem("guestbookAdminToken");
    if (savedToken) {
      setAdminToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleAdminEnable = () => {
      try {
        window.localStorage.setItem("guestbookAdmin", "1");
      } catch (error) {
        // Local storage unavailable.
      }
      setAdminMode(true);
      setAdminStatusMessage("Admin mode enabled.", "success");
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("guestbook-admin-enable", handleAdminEnable);
    return () => window.removeEventListener("guestbook-admin-enable", handleAdminEnable);
  }, []);

  useEffect(() => {
    if (!adminMode || typeof window === "undefined") return;
    if (adminToken) {
      window.localStorage.setItem("guestbookAdminToken", adminToken);
    } else {
      window.localStorage.removeItem("guestbookAdminToken");
    }
  }, [adminMode, adminToken]);

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

  const loadAdminEntries = useCallback(
    async ({ silent } = {}) => {
      if (!guestbookAdminEndpoint) {
        if (!silent) {
          setAdminStatusMessage("Guestbook API is not configured yet.", "error");
        }
        return;
      }
      if (!adminToken) {
        if (!silent) {
          setAdminStatusMessage("Add your admin token to load entries.", "error");
        }
        return;
      }

      setIsAdminLoading(true);
      if (!silent) {
        setAdminStatusMessage("Loading entries...", "");
      }

      try {
        const response = await fetch(guestbookAdminEndpoint, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Unable to load admin entries.");
        }
        const nextItems = Array.isArray(data.items) ? data.items : [];
        setAdminItems(nextItems);
        if (!silent) {
          setAdminStatusMessage(`Loaded ${data.total || nextItems.length} entries.`, "success");
        }
      } catch (error) {
        if (!silent) {
          setAdminStatusMessage(error?.message || "Unable to load admin entries.", "error");
        }
      } finally {
        setIsAdminLoading(false);
      }
    },
    [adminToken, guestbookAdminEndpoint]
  );

  useEffect(() => {
    if (!adminMode || !adminToken) return;
    loadAdminEntries();
  }, [adminMode, adminToken, loadAdminEntries]);

  const updateEntryApproval = async (entryHandle, approved) => {
    if (!guestbookEndpoint || !adminToken) return;
    setIsAdminLoading(true);
    setAdminStatusMessage(approved ? "Approving entry..." : "Hiding entry...", "");
    try {
      const response = await fetch(`${guestbookEndpoint}/${encodeURIComponent(entryHandle)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ approved }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to update entry.");
      }
      await loadAdminEntries({ silent: true });
      await loadGuestbook();
      setAdminStatusMessage(approved ? "Entry approved." : "Entry hidden.", "success");
    } catch (error) {
      setAdminStatusMessage(error?.message || "Unable to update entry.", "error");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const deleteEntry = async (entryHandle) => {
    if (!guestbookEndpoint || !adminToken) return;
    if (!window.confirm(`Remove @${entryHandle} from the guestbook?`)) {
      return;
    }
    setIsAdminLoading(true);
    setAdminStatusMessage("Removing entry...", "");
    try {
      const response = await fetch(`${guestbookEndpoint}/${encodeURIComponent(entryHandle)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to remove entry.");
      }
      await loadAdminEntries({ silent: true });
      await loadGuestbook();
      setAdminStatusMessage("Entry removed.", "success");
    } catch (error) {
      setAdminStatusMessage(error?.message || "Unable to remove entry.", "error");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const clearAdminToken = () => {
    setAdminToken("");
    setAdminItems([]);
    setAdminStatusMessage("Admin token cleared.", "");
  };

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
      if (data.deduped) {
        setStatusMessage("You are already on the list.", "success");
      } else if (data.pending || data.approved === false) {
        setStatusMessage("Thanks! Your entry is pending approval.", "success");
      } else {
        setStatusMessage("Added to the guestbook.", "success");
      }
      setHandle("");
      setCompany("");
      await loadGuestbook();
    } catch (error) {
      setStatusMessage(error?.message || "Unable to submit right now.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = adminItems.filter((item) => item.approved === false).length;

  return (
    <section className="glass guestbook" data-guestbook ref={sectionRef}>
      <h2>Guestbook</h2>
      <p>Drop your X handle to join the guestbook. Entries appear after approval.</p>
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
      {adminMode ? (
        <div className="guestbook-admin">
          <div className="guestbook-admin-header">
            <div>
              <p className="guestbook-admin-title">Guestbook admin</p>
              <p className="guestbook-admin-subtitle">
                {pendingCount ? `${pendingCount} pending` : "No pending entries"}
              </p>
            </div>
            <button
              className="guestbook-admin-button guestbook-admin-refresh"
              type="button"
              onClick={() => loadAdminEntries()}
              disabled={!adminToken || isAdminLoading}
            >
              Refresh
            </button>
          </div>
          <label className="guestbook-field guestbook-admin-field">
            <span className="guestbook-label">Admin token</span>
            <input
              className="guestbook-input guestbook-admin-input"
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Paste admin token"
              autoComplete="off"
            />
          </label>
          <div className="guestbook-actions guestbook-admin-actions">
            <button
              className="guestbook-button guestbook-admin-button"
              type="button"
              onClick={() => loadAdminEntries()}
              disabled={!adminToken || isAdminLoading}
            >
              Load entries
            </button>
            <button
              className="guestbook-admin-button ghost"
              type="button"
              onClick={clearAdminToken}
              disabled={isAdminLoading}
            >
              Clear token
            </button>
          </div>
          <div className="guestbook-status" data-tone={adminStatus.tone} aria-live="polite">
            {adminStatus.message}
          </div>
          <ul className="guestbook-admin-list">
            {!adminItems.length ? (
              <li className="guestbook-empty">No entries yet.</li>
            ) : (
              adminItems.map((item) => {
                const isApproved = item.approved !== false;
                return (
                  <li key={`${item.handle}-${item.submittedAt}`} className="guestbook-admin-item">
                    <div className="guestbook-admin-meta">
                      <span className="guestbook-admin-handle">@{item.handle}</span>
                      <span className="guestbook-admin-time">{formatDate(item.submittedAt)}</span>
                    </div>
                    <span className={`guestbook-admin-pill ${isApproved ? "approved" : "pending"}`}>
                      {isApproved ? "Approved" : "Pending"}
                    </span>
                    <div className="guestbook-admin-entry-actions">
                      <button
                        className="guestbook-admin-button ghost"
                        type="button"
                        onClick={() => updateEntryApproval(item.handle, !isApproved)}
                        disabled={isAdminLoading}
                      >
                        {isApproved ? "Hide" : "Approve"}
                      </button>
                      <button
                        className="guestbook-admin-button danger"
                        type="button"
                        onClick={() => deleteEntry(item.handle)}
                        disabled={isAdminLoading}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

export default Guestbook;
