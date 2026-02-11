import { useState, useMemo, useEffect, useCallback } from "react";

const USD_TO_CAD = 1.3567;
const CAD_TO_USD = 1 / USD_TO_CAD;

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const fmtCurrency = (n, currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

// Monetary keys that need converting when switching currency
const MONEY_KEYS = ["revenueTarget", "currentRevenue", "avgDealSize"];

// Defaults are in USD
const DEFAULTS_USD = {
  revenueTarget: 100000,
  currentRevenue: 30000,
  avgDealSize: 3000,
  replyRate: 2.5,
  positiveReplyRate: 20,
  interestedToBooked: 40,
  showRate: 80,
  closeRate: 20,
  churnRate: 10,
  workingDays: 20,
  timeframeMonths: 3,
};

const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const Slider = ({ label, value, min, max, step = 1, onChange, suffix = "", format = (v) => v }) => (
  <div style={{ marginBottom: "1.2rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
      <span style={{ fontSize: "0.73rem", color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e3a5f", fontFamily: "'DM Mono', monospace" }}>
        {format(value)}{suffix}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: "#2563eb", cursor: "pointer" }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.15rem" }}>
      <span style={{ fontSize: "0.63rem", color: "#94a3b8" }}>{format(min)}{suffix}</span>
      <span style={{ fontSize: "0.63rem", color: "#94a3b8" }}>{format(max)}{suffix}</span>
    </div>
  </div>
);

const MetricCard = ({ label, value, sub }) => (
  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.85rem 1rem" }}>
    <div style={{ fontSize: "0.65rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem", fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e3a5f", fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.25rem" }}>{sub}</div>}
  </div>
);

const FunnelStep = ({ label, value, pct, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
    <div style={{ width: "148px", fontSize: "0.7rem", color: "#64748b", textAlign: "right", flexShrink: 0, fontWeight: 500 }}>{label}</div>
    <div style={{ flex: 1, background: "#f1f5f9", borderRadius: "5px", height: "28px", overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        height: "100%", background: color, borderRadius: "5px",
        display: "flex", alignItems: "center", paddingLeft: "10px",
        transition: "width 0.4s ease", minWidth: pct > 0 ? "50px" : "0",
      }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }}>{fmt(value)}</span>
      </div>
    </div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: "0.65rem", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.85rem", fontWeight: 700 }}>{children}</div>
);

const NumberInput = ({ label, value, onChange, symbol }) => (
  <div style={{ marginBottom: "0.9rem" }}>
    <div style={{ fontSize: "0.73rem", color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.38rem", fontWeight: 600 }}>{label}</div>
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>{symbol}</span>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "8px",
          color: "#1e3a5f", fontFamily: "'DM Mono', monospace", fontSize: "0.95rem",
          padding: "0.48rem 0.75rem 0.48rem 1.9rem", width: "100%", outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => e.target.style.borderColor = "#2563eb"}
        onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
      />
    </div>
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "14px",
    padding: "1.3rem", marginBottom: "1rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)", ...style
  }}>
    {children}
  </div>
);

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [currency, setCurrency] = useState("USD");
  // Values stored directly in the DISPLAY currency — no hidden conversion
  const [v, setV] = useState({ ...DEFAULTS_USD });

  const width = useWindowWidth();
  const isMobile = width < 768;

  const symbol = currency === "CAD" ? "CA$" : "$";

  // When switching currency, convert all monetary stored values
  const switchCurrency = useCallback((newCurrency) => {
    if (newCurrency === currency) return;
    const rate = newCurrency === "CAD" ? USD_TO_CAD : CAD_TO_USD;
    setV((prev) => {
      const updated = { ...prev };
      MONEY_KEYS.forEach((k) => {
        updated[k] = prev[k] * rate;
      });
      return updated;
    });
    setCurrency(newCurrency);
  }, [currency]);

  const [provider, setProvider] = useState("Google");

  const PROVIDERS = {
    Google:    { emailsPerInbox: 30, inboxCostUSD: 3.50, label: "Google Workspace" },
    Microsoft: { emailsPerInbox: 25, inboxCostUSD: 3.50, label: "Microsoft 365"    },
    SMTP:      { emailsPerInbox: 30, inboxCostUSD: 5.00, label: "SMTP"             },
  };
  const DOMAIN_COST_USD = 11;
  const INBOXES_PER_DOMAIN = 3;

  const set = (key) => (val) => setV((prev) => ({ ...prev, [key]: val }));

  const calc = useMemo(() => {
    const revenueGap = Math.max(v.revenueTarget - v.currentRevenue, 0);
    const totalClientsNeeded = Math.ceil(revenueGap / (v.avgDealSize || 1));

    // Clients needed per month to close gap over timeframe
    const clientsToCloseGap = Math.ceil(totalClientsNeeded / (v.timeframeMonths || 1));

    // Current client base churning each month
    const currentClients = Math.round(v.currentRevenue / (v.avgDealSize || 1));
    const churnedPerMonth = Math.ceil(currentClients * (v.churnRate / 100));

    // Total new clients needed per month = close gap + replace churn
    const clientsPerMonth = clientsToCloseGap + churnedPerMonth;

    const callsShownNeeded = Math.ceil(clientsPerMonth / (v.closeRate / 100));
    const meetingsBookedNeeded = Math.ceil(callsShownNeeded / (v.showRate / 100));
    const interestedNeeded = Math.ceil(meetingsBookedNeeded / (v.interestedToBooked / 100));
    const totalReplies = Math.ceil(interestedNeeded / (v.positiveReplyRate / 100));
    const emailsPerMonth = Math.ceil(totalReplies / (v.replyRate / 100));
    const emailsPerDay = Math.ceil(emailsPerMonth / (v.workingDays || 1));
    const totalEmailsOverPeriod = emailsPerMonth * v.timeframeMonths;

    return {
      revenueGap, totalClientsNeeded, clientsPerMonth,
      clientsToCloseGap, churnedPerMonth, currentClients,
      callsShownNeeded, meetingsBookedNeeded, interestedNeeded,
      totalReplies, emailsPerMonth, emailsPerDay, totalEmailsOverPeriod,
    };
  }, [v]);

  const infra = useMemo(() => {
    const p = PROVIDERS[provider];
    const inboxes = Math.ceil(calc.emailsPerDay / p.emailsPerInbox);
    const domains = Math.ceil(inboxes / INBOXES_PER_DOMAIN);
    const inboxCostMonthlyUSD = inboxes * p.inboxCostUSD;
    const domainCostAnnualUSD = domains * DOMAIN_COST_USD;
    const rate = currency === "CAD" ? USD_TO_CAD : 1;
    return {
      inboxes, domains,
      inboxCostMonthly: inboxCostMonthlyUSD * rate,
      domainCostAnnual: domainCostAnnualUSD * rate,
      totalMonthly: inboxCostMonthlyUSD * rate,
      emailsPerInbox: p.emailsPerInbox,
    };
  }, [calc.emailsPerDay, provider, currency]);

  // ── Domain Suggester ──
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [domainSuggestions, setDomainSuggestions] = useState([]);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [copiedDomain, setCopiedDomain] = useState("");

  const suggestDomains = async () => {
    const input = primaryDomain.trim();
    if (!input) return;
    setDomainLoading(true);
    setDomainError("");
    setDomainSuggestions([]);
    try {
      const res = await fetch("/api/suggest-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ primaryDomain: input, numDomains: infra.domains })
});
      const data = await res.json();
      const text = data || "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setDomainSuggestions(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setDomainError("Something went wrong generating suggestions. Please try again.");
    } finally {
      setDomainLoading(false);
    }
  };

  const copyDomain = (d) => {
    navigator.clipboard.writeText(d).then(() => {
      setCopiedDomain(d);
      setTimeout(() => setCopiedDomain(""), 1500);
    });
  };

  const copyAll = () => {
    navigator.clipboard.writeText(domainSuggestions.join("\n")).then(() => {
      setCopiedDomain("__all__");
      setTimeout(() => setCopiedDomain(""), 1500);
    });
  };

  const timeframeOptions = [1, 2, 3, 6, 12];

  const btnBase = {
    borderRadius: "8px", padding: "0.5rem 0.3rem", fontSize: "0.78rem",
    fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
    fontFamily: "'DM Mono', monospace", textAlign: "center", flex: 1,
  };

  const fc = (n) => fmtCurrency(n, currency);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Sora', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 5px; background: #dbeafe; border-radius: 99px; outline: none; width: 100%; display: block; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #2563eb; border: 2px solid #fff; cursor: pointer; box-shadow: 0 0 6px rgba(37,99,235,0.35); }
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #f0f4f8; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1.5px solid #e2e8f0", padding: isMobile ? "1rem 1.1rem" : "1.1rem 1.8rem", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <img src="https://storage.googleapis.com/msgsndr/bEBJSFPZH9POL2qVaxN0/media/698b97feca717c1fa4c8e2c7.png" alt="Logo" style={{ height: "34px", width: "auto", objectFit: "contain", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: isMobile ? "0.95rem" : "1.1rem", fontWeight: 800, color: "#1e3a5f", letterSpacing: "-0.02em" }}>The Cold Calculator by Volenté</div>
              {!isMobile && <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Work backwards from revenue targets to daily send volume</div>}
            </div>
          </div>

          {/* Currency toggle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "0.3rem", background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "0.25rem" }}>
              {["USD", "CAD"].map((c) => (
                <button key={c} onClick={() => switchCurrency(c)} style={{
                  ...btnBase, flex: "none",
                  padding: "0.35rem 0.75rem",
                  background: currency === c ? "#2563eb" : "transparent",
                  border: "none",
                  color: currency === c ? "#fff" : "#64748b",
                  borderRadius: "7px",
                }}>{c}</button>
              ))}
            </div>
            {currency === "CAD" && (
              <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>1 USD = 1.3567 CAD</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "100%", margin: "0 auto", padding: isMobile ? "1.1rem" : "1.8rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0" : "1.8rem" }}>

          {/* ── LEFT: Inputs ── */}
          <div>
            <SectionLabel>🎯 Revenue Setup</SectionLabel>
            <Card>
              <NumberInput
                label="Current Monthly Revenue"
                value={v.currentRevenue}
                onChange={set("currentRevenue")}
                symbol={symbol}
              />
              <NumberInput
                label="Target Monthly Revenue"
                value={v.revenueTarget}
                onChange={set("revenueTarget")}
                symbol={symbol}
              />
              <NumberInput
                label="Average Deal Size"
                value={v.avgDealSize}
                onChange={set("avgDealSize")}
                symbol={symbol}
              />
              {/* Gap callout */}
              <div style={{
                background: calc.revenueGap > 0 ? "#f0fdf4" : "#eff6ff",
                border: `1.5px solid ${calc.revenueGap > 0 ? "#bbf7d0" : "#bfdbfe"}`,
                borderRadius: "9px", padding: "0.75rem 1rem", marginTop: "0.2rem"
              }}>
                <div style={{ fontSize: "0.63rem", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem", fontWeight: 700 }}>Monthly Revenue Gap</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#15803d", fontFamily: "'DM Mono', monospace" }}>{fc(calc.revenueGap)}</div>
                <div style={{ fontSize: "0.68rem", color: "#16a34a", marginTop: "0.15rem" }}>{fmt(calc.totalClientsNeeded)} total clients needed to close the gap</div>
              </div>
            </Card>

            <SectionLabel>⏱ Achievement Timeframe</SectionLabel>
            <Card>
              <div style={{ fontSize: "0.73rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.7rem", fontWeight: 600 }}>Reach target within</div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {timeframeOptions.map((m) => (
                  <button key={m} onClick={() => set("timeframeMonths")(m)} style={{
                    ...btnBase,
                    background: v.timeframeMonths === m ? "#2563eb" : "#f8fafc",
                    border: v.timeframeMonths === m ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                    color: v.timeframeMonths === m ? "#fff" : "#64748b",
                  }}>
                    {m === 1 ? "1 mo" : m === 12 ? "1 yr" : `${m} mo`}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.8rem", background: "#eff6ff", borderRadius: "7px", fontSize: "0.75rem", color: "#3b82f6" }}>
                Spread over {v.timeframeMonths} month{v.timeframeMonths > 1 ? "s" : ""}: close{" "}
                <strong style={{ color: "#1d4ed8", fontFamily: "'DM Mono', monospace" }}>{fmt(calc.clientsPerMonth)}</strong> clients/month
                {" "}→ longer runway = fewer emails/day
              </div>
            </Card>

            <SectionLabel>📊 Conversion Rates</SectionLabel>
            <Card>
              <Slider label="Reply Rate" value={v.replyRate} min={0.5} max={15} step={0.5} onChange={set("replyRate")} suffix="%" format={(x) => x.toFixed(1)} />
              <Slider label="Positive Reply Rate" value={v.positiveReplyRate} min={5} max={60} step={1} onChange={set("positiveReplyRate")} suffix="%" />
              <Slider label="Interested → Booked Meeting" value={v.interestedToBooked} min={10} max={100} step={5} onChange={set("interestedToBooked")} suffix="%" />
              <Slider label="Show Rate (booked → shows)" value={v.showRate} min={20} max={100} step={5} onChange={set("showRate")} suffix="%" />
              <Slider label="Close Rate (showed → closed)" value={v.closeRate} min={5} max={80} step={5} onChange={set("closeRate")} suffix="%" />
              <Slider label="Monthly Churn Rate" value={v.churnRate} min={0} max={50} step={1} onChange={set("churnRate")} suffix="%" />
              <Slider label="Working Days / Month" value={v.workingDays} min={10} max={30} step={1} onChange={set("workingDays")} />
            </Card>

            {/* Benchmarks */}
            <Card style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe" }}>
              <div style={{ fontSize: "0.65rem", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.7rem", fontWeight: 700 }}>Industry Benchmarks</div>
              {[
                ["Reply Rate", "2–5%", "Top performers: 8–15%"],
                ["Positive Reply Rate", "15–25%", "Of replies showing interest"],
                ["Interested → Booked", "40–70%", "Of interested leads who book"],
                ["Show Rate", "60–80%", "Of booked calls that show"],
                ["Close Rate", "20–40%", "Of calls shown that convert"],
                ["Monthly Churn", "2–8%", "Avg B2B SaaS; 10%+ is high"],
              ].map(([k, val, note]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.73rem", color: "#64748b" }}>{k}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563eb", fontFamily: "'DM Mono', monospace" }}>{val}</span>
                    <div style={{ fontSize: "0.62rem", color: "#93c5fd" }}>{note}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* ── RIGHT: Results ── */}
          <div style={{ marginTop: isMobile ? "1rem" : "0" }}>
            <SectionLabel>⚡ Your Daily Target</SectionLabel>

            {/* Hero */}
            <div style={{
              background: "linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%)",
              borderRadius: "16px", padding: "1.6rem", marginBottom: "1rem",
              boxShadow: "0 4px 20px rgba(37,99,235,0.25)",
            }}>
              <div style={{ fontSize: "0.7rem", color: "#bfdbfe", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.3rem", fontWeight: 600 }}>Emails to send per day</div>
              <div style={{ fontSize: isMobile ? "3.2rem" : "4rem", fontWeight: 800, color: "#fff", fontFamily: "'DM Mono', monospace", lineHeight: 1, marginBottom: "0.4rem" }}>
                {fmt(calc.emailsPerDay)}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#93c5fd" }}>
                {fmt(calc.emailsPerMonth)}/month · {fmt(calc.totalEmailsOverPeriod)} total over {v.timeframeMonths} month{v.timeframeMonths > 1 ? "s" : ""}
              </div>
            </div>

            {/* Metric grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <MetricCard label="Monthly Replies" value={fmt(calc.totalReplies)} sub={`${v.replyRate}% reply rate`} />
              <MetricCard label="Interested" value={fmt(calc.interestedNeeded)} sub={`${v.positiveReplyRate}% positive`} />
              <MetricCard label="Meetings Booked" value={fmt(calc.meetingsBookedNeeded)} sub={`${v.interestedToBooked}% book rate`} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1.2rem" }}>
              <MetricCard label="Meetings Shown" value={fmt(calc.callsShownNeeded)} sub={`${v.showRate}% show rate`} />
              <MetricCard label="New Clients / Month" value={fmt(calc.clientsPerMonth)} sub={`${fmt(calc.clientsToCloseGap)} growth + ${fmt(calc.churnedPerMonth)} churn`} />
            </div>

            {/* Funnel */}
            <SectionLabel>🔻 Monthly Conversion Funnel</SectionLabel>
            <Card>
              {[
                { label: "Emails Sent", value: calc.emailsPerMonth, color: "#2563eb" },
                { label: "Total Replies", value: calc.totalReplies, color: "#0891b2" },
                { label: "Interested", value: calc.interestedNeeded, color: "#16a34a" },
                { label: "Meetings Booked", value: calc.meetingsBookedNeeded, color: "#0369a1" },
                { label: "Meetings Shown", value: calc.callsShownNeeded, color: "#ca8a04" },
                { label: "Clients Won", value: calc.clientsPerMonth, color: "#dc2626" },
              ].map((item) => (
                <FunnelStep key={item.label} label={item.label} value={item.value}
                  pct={(item.value / calc.emailsPerMonth) * 100} color={item.color} />
              ))}
            </Card>

            {/* Summary */}
            <Card style={{ background: "#f8fafc" }}>
              <div style={{ fontSize: "0.65rem", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.65rem", fontWeight: 700 }}>Summary</div>
              <div style={{ fontSize: "0.84rem", color: "#64748b", lineHeight: 1.85 }}>
                You currently generate{" "}
                <span style={{ color: "#1e3a5f", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fc(v.currentRevenue)}</span>/month.
                {" "}To reach{" "}
                <span style={{ color: "#1e3a5f", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fc(v.revenueTarget)}</span>/month
                {" "}within <span style={{ color: "#2563eb", fontWeight: 700 }}>{v.timeframeMonths} month{v.timeframeMonths > 1 ? "s" : ""}</span>,
                {" "}you need <span style={{ color: "#15803d", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(calc.clientsPerMonth)} new clients/month</span> —{" "}
                {fmt(calc.clientsToCloseGap)} to close the gap and {fmt(calc.churnedPerMonth)} to replace {v.churnRate}% monthly churn
                {" "}({fmt(calc.currentClients)} current clients × {v.churnRate}%).
                {" "}At a <span style={{ color: "#1e3a5f", fontWeight: 700 }}>{v.replyRate}%</span> reply rate,{" "}
                <span style={{ color: "#1e3a5f", fontWeight: 700 }}>{v.positiveReplyRate}%</span> positive,
                {" "}&amp; <span style={{ color: "#1e3a5f", fontWeight: 700 }}>{v.interestedToBooked}%</span> booking rate —
                {" "}send{" "}
                <span style={{ color: "#2563eb", fontWeight: 800, fontFamily: "'DM Mono', monospace", fontSize: "1rem" }}>{fmt(calc.emailsPerDay)} emails/day</span>.
              </div>
            </Card>
          </div>
        </div>

        {/* ── Infrastructure Section ── */}
        <div style={{ marginTop: "2rem" }}>
          <SectionLabel>🖥 Sending Infrastructure</SectionLabel>

          {/* Provider tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <button key={key} onClick={() => setProvider(key)} style={{
                padding: "0.55rem 1.2rem", borderRadius: "9px", fontSize: "0.82rem",
                fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'DM Mono', monospace",
                background: provider === key ? "#2563eb" : "#fff",
                border: provider === key ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                color: provider === key ? "#fff" : "#64748b",
                boxShadow: provider === key ? "0 2px 8px rgba(37,99,235,0.2)" : "none",
              }}>{p.label}</button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "1.1rem 1.2rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "0.63rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem", fontWeight: 600 }}>Inboxes Needed</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#1e3a5f", fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>{fmt(infra.inboxes)}</div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.25rem" }}>{infra.emailsPerInbox} emails/inbox/day</div>
            </div>
            <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "1.1rem 1.2rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "0.63rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem", fontWeight: 600 }}>Domains Needed</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#1e3a5f", fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>{fmt(infra.domains)}</div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.25rem" }}>3 inboxes per domain</div>
            </div>
            <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "1.1rem 1.2rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "0.63rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem", fontWeight: 600 }}>Inbox Cost / mo</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#1e3a5f", fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>{fc(infra.inboxCostMonthly)}</div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.25rem" }}>{fc(PROVIDERS[provider].inboxCostUSD * (currency === "CAD" ? USD_TO_CAD : 1))}/inbox · recurring</div>
            </div>
            <div style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", border: "1.5px solid #2563eb", borderRadius: "12px", padding: "1.1rem 1.2rem", boxShadow: "0 2px 12px rgba(37,99,235,0.2)" }}>
              <div style={{ fontSize: "0.63rem", color: "#bfdbfe", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem", fontWeight: 600 }}>Domain Cost / yr</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }}>{fc(infra.domainCostAnnual)}</div>
              <div style={{ fontSize: "0.68rem", color: "#93c5fd", marginTop: "0.25rem" }}>One-time upfront · {fc((currency === "CAD" ? DOMAIN_COST_USD * USD_TO_CAD : DOMAIN_COST_USD))}/domain/yr</div>
            </div>
          </div>

          {/* Trusted Partner Banner */}
          {provider !== "SMTP" && (() => {
            const partners = {
              Google: {
                name: "Premium Inboxes",
                desc: "Our recommended Google Workspace inbox provider — set up and optimised for cold email deliverability.",
                url: "https://premiuminboxes.com?fpr=matt51",
                accent: "#ea4335",
                bg: "#fff8f7",
                border: "#fecaca",
                labelColor: "#dc2626",
                btnBg: "#ea4335",
              },
              Microsoft: {
                name: "Inbox Kit",
                desc: "Our recommended provider for Microsoft 365 and Azure inboxes — fast setup, cold-email ready.",
                url: "https://www.inboxkit.com/?aff=MARlDBXVYKRw",
                accent: "#0078d4",
                bg: "#f0f7ff",
                border: "#bfdbfe",
                labelColor: "#1d4ed8",
                btnBg: "#0078d4",
              },
            };
            const p = partners[provider];
            return (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "1rem", flexWrap: isMobile ? "wrap" : "nowrap",
                background: p.bg, border: `1.5px solid ${p.border}`,
                borderRadius: "12px", padding: "1rem 1.2rem", marginBottom: "1rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "8px",
                    background: p.btnBg, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "1.1rem", flexShrink: 0,
                  }}>🤝</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.15rem" }}>
                      <span style={{ fontSize: "0.63rem", color: p.labelColor, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Trusted Partner</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#1e3a5f" }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>{p.desc}</div>
                  </div>
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block", padding: "0.5rem 1.1rem", borderRadius: "8px",
                    background: p.btnBg, color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                    textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                    boxShadow: `0 2px 8px ${p.btnBg}55`, fontFamily: "'Sora', sans-serif",
                    transition: "opacity 0.15s",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
                  onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Get Started →
                </a>
              </div>
            );
          })()}

          {/* Breakdown card */}
          <Card style={{ background: "#f8fafc" }}>
            <div style={{ fontSize: "0.65rem", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem", fontWeight: 700 }}>Cost Breakdown</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "0.5rem 2rem" }}>
              {[
                ["Provider", PROVIDERS[provider].label],
                ["Emails / day", fmt(calc.emailsPerDay)],
                ["Emails / inbox / day", `${infra.emailsPerInbox}`],
                ["Inboxes required", fmt(infra.inboxes)],
                ["Domains required", `${fmt(infra.domains)} × ${fc(DOMAIN_COST_USD * (currency === "CAD" ? USD_TO_CAD : 1))}/yr = ${fc(infra.domainCostAnnual)}/yr upfront`],
                ["Inbox cost", `${fmt(infra.inboxes)} × ${fc(PROVIDERS[provider].inboxCostUSD * (currency === "CAD" ? USD_TO_CAD : 1))}/mo = ${fc(infra.inboxCostMonthly)}/mo recurring`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "0.2rem" }}>{label}</span>
                  <span style={{ fontSize: "0.82rem", color: "#1e3a5f", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ── AI Domain Suggester ── */}
          <div style={{ marginTop: "1.5rem" }}>
            <SectionLabel>✨ AI Domain Name Suggester</SectionLabel>
            <Card>
              <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem", lineHeight: 1.6 }}>
                Enter your primary domain and we'll suggest <strong style={{ color: "#1e3a5f" }}>{infra.domains} sending domain{infra.domains !== 1 ? "s" : ""}</strong> (one per domain needed) to protect your main domain's reputation.
              </div>

              {/* Input row */}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: "#94a3b8" }}>🌐</span>
                  <input
                    type="text"
                    placeholder="e.g. volentemedia.com"
                    value={primaryDomain}
                    onChange={(e) => setPrimaryDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && suggestDomains()}
                    style={{
                      width: "100%", background: "#fff", border: "1.5px solid #e2e8f0",
                      borderRadius: "8px", color: "#1e3a5f", fontFamily: "'DM Mono', monospace",
                      fontSize: "0.92rem", padding: "0.52rem 0.75rem 0.52rem 2.1rem", outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#2563eb"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                </div>
                <button
                  onClick={suggestDomains}
                  disabled={domainLoading || !primaryDomain.trim()}
                  style={{
                    padding: "0.52rem 1.3rem", borderRadius: "8px", fontSize: "0.82rem",
                    fontWeight: 700, cursor: domainLoading || !primaryDomain.trim() ? "not-allowed" : "pointer",
                    background: domainLoading || !primaryDomain.trim() ? "#e2e8f0" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
                    border: "none", color: domainLoading || !primaryDomain.trim() ? "#94a3b8" : "#fff",
                    boxShadow: domainLoading || !primaryDomain.trim() ? "none" : "0 2px 8px rgba(37,99,235,0.25)",
                    transition: "all 0.15s", whiteSpace: "nowrap", fontFamily: "'Sora', sans-serif",
                  }}>
                  {domainLoading ? "Generating…" : "✨ Suggest Domains"}
                </button>
              </div>

              {/* Error */}
              {domainError && (
                <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.9rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "7px", fontSize: "0.78rem", color: "#dc2626" }}>
                  {domainError}
                </div>
              )}

              {/* Loading shimmer */}
              {domainLoading && (
                <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: "0.5rem" }}>
                  {Array.from({ length: infra.domains > 6 ? 6 : infra.domains }).map((_, i) => (
                    <div key={i} style={{
                      height: "44px", borderRadius: "8px",
                      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.2s infinite",
                    }} />
                  ))}
                  <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
                </div>
              )}

              {/* Results */}
              {domainSuggestions.length > 0 && !domainLoading && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      {domainSuggestions.length} domain{domainSuggestions.length !== 1 ? "s" : ""} suggested
                    </span>
                    <button onClick={copyAll} style={{
                      fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", padding: "0.3rem 0.7rem",
                      borderRadius: "6px", border: "1px solid #bfdbfe", background: copiedDomain === "__all__" ? "#dbeafe" : "#eff6ff",
                      color: "#2563eb", fontFamily: "'Sora', sans-serif", transition: "all 0.15s",
                    }}>
                      {copiedDomain === "__all__" ? "✓ Copied all!" : "Copy all"}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {domainSuggestions.map((d) => (
                      <button key={d} onClick={() => copyDomain(d)} title="Click to copy" style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "0.6rem 0.85rem", borderRadius: "8px", cursor: "pointer",
                        background: copiedDomain === d ? "#f0fdf4" : "#f8fafc",
                        border: `1.5px solid ${copiedDomain === d ? "#86efac" : "#e2e8f0"}`,
                        transition: "all 0.15s", textAlign: "left", width: "100%",
                      }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e3a5f", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d}</span>
                        <span style={{ fontSize: "0.68rem", color: copiedDomain === d ? "#16a34a" : "#94a3b8", flexShrink: 0, marginLeft: "0.4rem" }}>
                          {copiedDomain === d ? "✓" : "copy"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: "0.7rem", fontSize: "0.7rem", color: "#94a3b8", lineHeight: 1.5 }}>
                    💡 These are suggestions only — check availability at your registrar before purchasing.
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
