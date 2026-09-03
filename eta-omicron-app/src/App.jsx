import React, { useEffect, useState } from "react";
import {
  Home, CalendarDays, Users, CircleDollarSign, Images,
  Plus, Check, Clock, MapPin, X, Camera, Heart, LogOut
} from "lucide-react";
import { supabase, SUPABASE_URL } from "./supabaseClient";

// ---- Design tokens ----
const C = {
  purpleDeep: "#241536",
  purple: "#452C7A",
  purpleSoft: "#6B4FA0",
  gold: "#C9A227",
  goldSoft: "#E4C766",
  ivory: "#F7F3E8",
  ink: "#211530",
  inkSoft: "#5B4E68",
  line: "#E3DCC9",
  green: "#4C7A5B",
};
const serif = { fontFamily: "'Iowan Old Style','Palatino Linotype',Georgia,serif" };
const sans = { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" };

export default function App() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [memberLookupDone, setMemberLookupDone] = useState(false);
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("paid") === "1" ? "dues" : "home"
  );
  const [recoveryMode, setRecoveryMode] = useState(false);

  // If we just landed back from Stripe, clean the query string out of the URL
  useEffect(() => {
    if (window.location.search.includes("paid=") || window.location.search.includes("canceled=")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Watch auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Once logged in, look up this person's member row
  useEffect(() => {
    if (!session) { setMember(null); setMemberLookupDone(false); return; }
    setMemberLookupDone(false);
    supabase
      .from("members")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMember(data ?? null);
        setMemberLookupDone(true);
      });
  }, [session]);

  if (recoveryMode) return <Frame><ResetPasswordScreen onDone={() => setRecoveryMode(false)} /></Frame>;
  if (!session) return <Frame><LoginScreen /></Frame>;
  if (!memberLookupDone) return <Frame><CenteredNote text="Loading…" /></Frame>;
  if (!member) return <Frame><NotAMemberScreen email={session.user.email} /></Frame>;

  return (
    <Frame>
      <AppShell member={member} tab={tab} setTab={setTab} />
    </Frame>
  );
}

function Frame({ children }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center py-8" style={{ background: C.purpleDeep }}>
      <div className="relative w-[380px] h-[780px] rounded-[2.5rem] overflow-hidden flex flex-col" style={{ background: C.ivory, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 rounded-b-2xl z-20" style={{ background: C.purpleDeep }} />
        {children}
      </div>
    </div>
  );
}

function CenteredNote({ text }) {
  return <div className="h-full flex items-center justify-center text-sm" style={{ color: C.inkSoft, ...sans }}>{text}</div>;
}

// ---- Auth ----

function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setInfo(""); setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Password set. If your project requires email confirmation, check your inbox once — after that, just sign in with your password below.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) setError(error.message);
      else setInfo("Check your email for a link to reset your password.");
    }
    setBusy(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: `linear-gradient(180deg, ${C.purpleDeep} 0%, ${C.purple} 100%)` }}>
      <div className="text-6xl mb-3" style={{ color: C.gold, ...serif }}>ΗΟ</div>
      <div className="text-xs tracking-wide mb-1" style={{ color: C.goldSoft, ...sans, letterSpacing: "0.15em" }}>OMEGA PSI PHI FRATERNITY, INC.</div>
      <div className="text-2xl mb-8" style={{ color: C.ivory, ...serif }}>Eta Omicron Chapter</div>
      <div className="w-full h-px mb-8" style={{ background: C.purpleSoft }} />

      <div className="text-sm mb-4" style={{ color: "#D9CDEC", ...sans }}>
        {mode === "signin" && "Sign in with the email your officer added you with."}
        {mode === "signup" && "First time here? Set a password for that email."}
        {mode === "forgot" && "Enter your email and we'll send a reset link."}
      </div>

      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full px-3 py-3 mb-3 rounded-sm text-sm"
        style={{ ...sans }}
      />
      {mode !== "forgot" && (
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Create a password" : "Password"}
          className="w-full px-3 py-3 mb-3 rounded-sm text-sm"
          style={{ ...sans }}
        />
      )}

      <button
        onClick={submit}
        disabled={!email || (mode !== "forgot" && !password) || busy}
        className="w-full py-3 mb-3 rounded-sm font-medium disabled:opacity-40"
        style={{ background: C.gold, color: C.purpleDeep, ...sans }}
      >
        {busy ? "Please wait…" : mode === "signin" ? "Sign In" : mode === "signup" ? "Create Password" : "Send Reset Link"}
      </button>

      <div className="flex flex-col gap-2">
        {mode === "signin" && (
          <>
            <button onClick={() => { setMode("signup"); setError(""); setInfo(""); }} className="text-xs" style={{ color: C.goldSoft, ...sans }}>
              First time here? Set a password
            </button>
            <button onClick={() => { setMode("forgot"); setError(""); setInfo(""); }} className="text-xs" style={{ color: "#B9A9D6", ...sans }}>
              Forgot password?
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button onClick={() => { setMode("signin"); setError(""); setInfo(""); }} className="text-xs" style={{ color: C.goldSoft, ...sans }}>
            Back to sign in
          </button>
        )}
      </div>

      {error && <div className="text-xs mt-4" style={{ color: "#E6A5A5" }}>{error}</div>}
      {info && <div className="text-xs mt-4" style={{ color: "#B9DCC3" }}>{info}</div>}
    </div>
  );
}

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: `linear-gradient(180deg, ${C.purpleDeep} 0%, ${C.purple} 100%)` }}>
      <div className="text-2xl mb-6" style={{ color: C.ivory, ...serif }}>Set a New Password</div>
      {done ? (
        <>
          <div className="text-sm mb-5" style={{ color: "#B9DCC3", ...sans }}>Password updated.</div>
          <button onClick={onDone} className="w-full py-3 rounded-sm font-medium" style={{ background: C.gold, color: C.purpleDeep, ...sans }}>
            Continue
          </button>
        </>
      ) : (
        <>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full px-3 py-3 mb-3 rounded-sm text-sm"
            style={{ ...sans }}
          />
          <button
            onClick={submit}
            disabled={!password || busy}
            className="w-full py-3 rounded-sm font-medium disabled:opacity-40"
            style={{ background: C.gold, color: C.purpleDeep, ...sans }}
          >
            {busy ? "Saving…" : "Save New Password"}
          </button>
          {error && <div className="text-xs mt-4" style={{ color: "#E6A5A5" }}>{error}</div>}
        </>
      )}
    </div>
  );
}

function NotAMemberScreen({ email }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: `linear-gradient(180deg, ${C.purpleDeep} 0%, ${C.purple} 100%)` }}>
      <div className="text-sm mb-4" style={{ color: "#D9CDEC", ...sans }}>
        No roster entry found for <b style={{ color: C.ivory }}>{email}</b>. Ask a chapter officer to add you first.
      </div>
      <button onClick={() => supabase.auth.signOut()} className="text-xs px-4 py-2 rounded-sm" style={{ border: `1px solid ${C.goldSoft}`, color: C.ivory, ...sans }}>
        Sign out
      </button>
    </div>
  );
}

// ---- Shell ----

function AppShell({ member, tab, setTab }) {
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [rsvpIds, setRsvpIds] = useState(new Set());
  const [feed, setFeed] = useState([]);
  const [duesPaidIds, setDuesPaidIds] = useState(new Set());
  const [showAddMember, setShowAddMember] = useState(false);
  const currentYear = new Date().getFullYear();

  const loadMembers = () => supabase.from("members").select("*").order("name").then(({ data }) => setMembers(data ?? []));
  const loadEvents = () => supabase.from("events").select("*").order("event_date").then(({ data }) => setEvents(data ?? []));
  const loadRsvps = () => supabase.from("rsvps").select("event_id").eq("member_id", member.id)
    .then(({ data }) => setRsvpIds(new Set((data ?? []).map(r => r.event_id))));
  const loadFeed = () => supabase.from("posts").select("*, members(name)").order("created_at", { ascending: false })
    .then(({ data }) => setFeed(data ?? []));
  const loadDues = () => supabase.from("dues_payments").select("member_id").eq("year", currentYear)
    .then(({ data }) => setDuesPaidIds(new Set((data ?? []).map(d => d.member_id))));

  useEffect(() => { loadMembers(); loadEvents(); loadRsvps(); loadFeed(); loadDues(); }, []); // eslint-disable-line

  const toggleRsvp = async (eventId) => {
    if (rsvpIds.has(eventId)) {
      await supabase.from("rsvps").delete().eq("event_id", eventId).eq("member_id", member.id);
    } else {
      await supabase.from("rsvps").insert({ event_id: eventId, member_id: member.id });
    }
    loadRsvps();
  };

  const addMember = async (name, email, roleTitle) => {
    await supabase.from("members").insert({ name, email, role: roleTitle || "Member" });
    setShowAddMember(false);
    loadMembers();
  };

  const payDues = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const body = await res.json();
    if (body.url) window.location.href = body.url;
    else alert(body.error || "Could not start checkout");
  };

  const addPost = async (caption) => {
    await supabase.from("posts").insert({ author_id: member.id, caption });
    loadFeed();
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto pt-9 pb-2">
        {tab === "home" && <HomeScreen member={member} events={events} />}
        {tab === "events" && <EventsScreen events={events} rsvpIds={rsvpIds} toggleRsvp={toggleRsvp} />}
        {tab === "members" && (
          <MembersScreen members={members} isOfficer={member.is_officer} duesPaidIds={duesPaidIds} onAdd={() => setShowAddMember(true)} />
        )}
        {tab === "dues" && (
          <DuesScreen
            isOfficer={member.is_officer}
            members={members}
            duesPaidIds={duesPaidIds}
            year={currentYear}
            meId={member.id}
            meDuesAmount={member.dues_amount ?? 75}
            onPay={payDues}
          />
        )}
        {tab === "feed" && <FeedScreen feed={feed} onAddPost={addPost} />}
      </div>

      <TabBar tab={tab} setTab={setTab} member={member} />

      {showAddMember && <AddMemberModal onClose={() => setShowAddMember(false)} onAdd={addMember} />}
    </>
  );
}

// ---- Screens ----

function ScreenHeader({ title, subtitle, action }) {
  return (
    <div className="px-5 pb-4 mb-3 flex items-end justify-between" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div>
        <div className="text-2xl" style={{ ...serif, color: C.ink }}>{title}</div>
        {subtitle && <div className="text-xs mt-0.5" style={{ color: C.inkSoft, ...sans }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function HomeScreen({ member, events }) {
  const upcoming = events.slice(0, 3);
  return (
    <div className="px-5">
      <ScreenHeader title="Eta Omicron" subtitle={`Welcome, ${member.name.split(" ")[0]}`} />
      <div className="rounded-sm p-4 mb-5" style={{ background: C.purple }}>
        <div className="text-xs mb-1" style={{ color: C.goldSoft, ...sans, letterSpacing: "0.1em" }}>CHAPTER HISTORY</div>
        <div className="text-sm leading-relaxed" style={{ color: C.ivory, ...sans }}>
          Chartered to serve the surrounding community through Manhood, Scholarship, Perseverance, and Uplift.
        </div>
      </div>
      <div className="text-xs mb-2" style={{ color: C.inkSoft, ...sans, letterSpacing: "0.08em" }}>UPCOMING</div>
      {upcoming.length === 0 && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>No events yet.</div>}
      {upcoming.map(e => (
        <div key={e.id} className="flex items-center gap-3 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="w-11 h-11 flex flex-col items-center justify-center rounded-sm shrink-0" style={{ background: C.ivory, border: `1px solid ${C.gold}` }}>
            <div className="text-[10px] leading-none" style={{ color: C.inkSoft, ...sans }}>{new Date(e.event_date).toLocaleDateString(undefined, { month: "short" })}</div>
            <div className="text-sm leading-none mt-0.5" style={{ color: C.ink, ...serif }}>{new Date(e.event_date).getDate()}</div>
          </div>
          <div>
            <div className="text-sm" style={{ color: C.ink, ...sans }}>{e.title}</div>
            <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>{e.event_time} · {e.location}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsScreen({ events, rsvpIds, toggleRsvp }) {
  return (
    <div className="px-5">
      <ScreenHeader title="Events" subtitle="Chapter calendar" />
      {events.map(e => {
        const going = rsvpIds.has(e.id);
        return (
          <div key={e.id} className="mb-3 p-4 rounded-sm" style={{ background: "#fff", borderTop: `3px solid ${going ? C.green : C.gold}` }}>
            <div className="text-base" style={{ color: C.ink, ...serif }}>{e.title}</div>
            <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: C.inkSoft, ...sans }}>
              <Clock size={12} /> {new Date(e.event_date).toLocaleDateString()} · {e.event_time}
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: C.inkSoft, ...sans }}>
              <MapPin size={12} /> {e.location}
            </div>
            <button
              onClick={() => toggleRsvp(e.id)}
              className="mt-3 text-xs px-3 py-1.5 rounded-sm flex items-center gap-1"
              style={going ? { background: "#EAF2EC", color: C.green, ...sans } : { background: C.purple, color: C.ivory, ...sans }}
            >
              {going && <Check size={12} />} {going ? "You're going" : "RSVP"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MembersScreen({ members, isOfficer, duesPaidIds, onAdd }) {
  return (
    <div className="px-5">
      <ScreenHeader
        title="Members"
        subtitle={`${members.length} on the roll`}
        action={isOfficer && (
          <button onClick={onAdd} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.purple }}>
            <Plus size={16} color={C.ivory} />
          </button>
        )}
      />
      {members.map(m => {
        const paid = duesPaidIds?.has(m.id);
        return (
          <div key={m.id} className="flex items-center gap-3 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: C.purple, color: C.gold, ...serif }}>
              {m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm" style={{ color: C.ink, ...sans }}>{m.name}</div>
              <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>{m.role}{m.line ? ` · ${m.line}` : ""}</div>
            </div>
            {isOfficer && (
              <div className="text-[10px] px-2 py-1 rounded-sm" style={paid
                ? { background: "#EAF2EC", color: C.green, ...sans }
                : { background: "#F7E9E4", color: "#A15A3C", ...sans }}>
                {paid ? "PAID" : "UNPAID"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DuesScreen({ isOfficer, members, duesPaidIds, year, meId, meDuesAmount, onPay }) {
  const meIsPaid = duesPaidIds.has(meId);

  if (isOfficer) {
    const paidCount = members.filter(m => duesPaidIds.has(m.id)).length;
    const total = paidCount * Number(meDuesAmount ?? 75);
    return (
      <div className="px-5">
        <ScreenHeader title="Dues" subtitle={`${year} — Chapter-wide status`} />

        <div className="rounded-sm p-4 mb-5" style={{ background: C.purple }}>
          <div className="text-xs mb-1" style={{ color: C.goldSoft, ...sans, letterSpacing: "0.1em" }}>YOUR DUES — {year}</div>
          {meIsPaid ? (
            <div className="flex items-center gap-1 text-sm" style={{ color: "#B9DCC3", ...sans }}>
              <Check size={14} /> Paid for {year}
            </div>
          ) : (
            <>
              <div className="text-2xl mb-2" style={{ color: C.ivory, ...serif }}>${Number(meDuesAmount ?? 75).toFixed(2)} due</div>
              <button onClick={onPay} className="w-full py-2.5 rounded-sm font-medium text-sm" style={{ background: C.gold, color: C.purpleDeep, ...sans }}>
                Pay Dues
              </button>
            </>
          )}
        </div>

        <div className="text-xs mb-2" style={{ color: C.inkSoft, ...sans, letterSpacing: "0.08em" }}>CHAPTER-WIDE — {year}</div>
        <div className="flex gap-3 mb-5">
          <StatBlock label="Paid" value={paidCount} />
          <StatBlock label="Unpaid" value={members.length - paidCount} />
          <StatBlock label="Collected" value={`~$${total.toFixed(0)}`} />
        </div>
        {members.map(m => {
          const paid = duesPaidIds.has(m.id);
          return (
            <div key={m.id} className="flex items-center justify-between py-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div>
                <div className="text-sm" style={{ color: C.ink, ...sans }}>{m.name}</div>
                <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>{m.role}</div>
              </div>
              <div className="text-xs px-2 py-1 rounded-sm" style={paid
                ? { background: "#EAF2EC", color: C.green, ...sans }
                : { background: "#F7E9E4", color: "#A15A3C", ...sans }}>
                {paid ? "Paid" : "Unpaid"}
              </div>
            </div>
          );
        })}
        <div className="text-xs mt-4 leading-relaxed" style={{ color: C.inkSoft, ...sans }}>
          Dues are tracked per calendar year — everyone starts back at "unpaid" automatically each January, with prior years kept on record.
        </div>
      </div>
    );
  }

  return (
    <div className="px-5">
      <ScreenHeader title="Dues" subtitle={`${year}`} />
      <div className="rounded-sm p-5 text-center" style={{ background: C.purple }}>
        <div className="text-xs mb-2" style={{ color: C.goldSoft, ...sans, letterSpacing: "0.1em" }}>AMOUNT DUE — {year}</div>
        <div className="text-4xl mb-1" style={{ color: C.ivory, ...serif }}>{meIsPaid ? "$0" : `$${Number(meDuesAmount ?? 75).toFixed(2)}`}</div>
        <div className="text-xs mb-5" style={{ color: "#D9CDEC", ...sans }}>{meIsPaid ? `You're all set for ${year}.` : "Pay securely via Stripe."}</div>
        {!meIsPaid && (
          <button onClick={onPay} className="w-full py-3 rounded-sm font-medium" style={{ background: C.gold, color: C.purpleDeep, ...sans }}>
            Pay Dues
          </button>
        )}
        {meIsPaid && (
          <div className="flex items-center justify-center gap-1 text-sm" style={{ color: "#B9DCC3", ...sans }}>
            <Check size={14} /> Payment confirmed
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="flex-1 p-3 rounded-sm text-center" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="text-lg" style={{ color: C.ink, ...serif }}>{value}</div>
      <div className="text-[10px]" style={{ color: C.inkSoft, ...sans, letterSpacing: "0.05em" }}>{label.toUpperCase()}</div>
    </div>
  );
}

function FeedScreen({ feed, onAddPost }) {
  const [caption, setCaption] = useState("");
  return (
    <div className="px-5">
      <ScreenHeader title="Chapter Feed" subtitle="Photos & updates" />
      <div className="mb-5 flex gap-2">
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Share an update…" className="flex-1 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} />
        <button
          disabled={!caption}
          onClick={() => { onAddPost(caption); setCaption(""); }}
          className="px-3 rounded-sm text-xs disabled:opacity-40"
          style={{ background: C.purple, color: C.ivory, ...sans }}
        >
          Post
        </button>
      </div>
      {feed.map(p => (
        <div key={p.id} className="mb-5 rounded-sm overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {p.image_url ? (
            <img src={p.image_url} alt="" className="h-40 w-full object-cover" />
          ) : (
            <div className="h-24 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleSoft})` }}>
              <Camera size={24} color={C.goldSoft} />
            </div>
          )}
          <div className="p-3">
            <div className="text-sm" style={{ color: C.ink, ...sans }}><b>{p.members?.name ?? "Member"}</b></div>
            <div className="text-xs mt-1" style={{ color: C.inkSoft, ...sans }}>{p.caption}</div>
            <div className="flex items-center gap-1 mt-3 text-xs" style={{ color: C.inkSoft, ...sans }}>
              <Heart size={13} /> 0
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Nav / Modals ----

function TabBar({ tab, setTab, member }) {
  const items = [
    { id: "home", icon: Home, label: "Home" },
    { id: "events", icon: CalendarDays, label: "Events" },
    { id: "members", icon: Users, label: "Members" },
    { id: "dues", icon: CircleDollarSign, label: "Dues" },
    { id: "feed", icon: Images, label: "Feed" },
  ];
  return (
    <div className="flex items-center justify-around py-2.5" style={{ borderTop: `1px solid ${C.line}`, background: "#fff" }}>
      {items.map(it => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} className="flex flex-col items-center gap-0.5 px-2">
            <Icon size={19} color={active ? C.purple : C.inkSoft} strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[10px]" style={{ color: active ? C.purple : C.inkSoft, ...sans }}>{it.label}</span>
          </button>
        );
      })}
      <button onClick={() => supabase.auth.signOut()} className="flex flex-col items-center gap-0.5 px-2">
        <LogOut size={19} color={C.inkSoft} strokeWidth={1.8} />
        <span className="text-[10px]" style={{ color: C.inkSoft, ...sans }}>Sign out</span>
      </button>
    </div>
  );
}

function AddMemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  return (
    <div className="absolute inset-0 z-30 flex items-end" style={{ background: "rgba(36,21,54,0.55)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg" style={{ ...serif, color: C.ink }}>Add Member</div>
          <button onClick={onClose}><X size={18} color={C.inkSoft} /></button>
        </div>
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Full name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} placeholder="e.g. James Carter" />
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Email (used to sign in)</label>
        <input value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} placeholder="james@example.com" />
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Chapter role (optional)</label>
        <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} className="w-full mt-1 mb-5 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} placeholder="e.g. Member" />
        <button
          disabled={!name || !email}
          onClick={() => onAdd(name, email, roleTitle)}
          className="w-full py-3 rounded-sm font-medium disabled:opacity-40"
          style={{ background: C.purple, color: C.ivory, ...sans }}
        >
          Add to Roster
        </button>
      </div>
    </div>
  );
}
