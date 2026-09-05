import React, { useEffect, useState, useRef } from "react";
import {
  Home, CalendarDays, Users, CircleDollarSign, Images, MessageCircle,
  Plus, Check, Clock, MapPin, X, Camera, Heart, LogOut, ArrowLeft, Send,
  Paperclip, Download, FileText
} from "lucide-react";
import { supabase, SUPABASE_URL } from "./supabaseClient";

// Public key only — safe to embed in client code, it's the whole point
// of VAPID (the private key that actually signs pushes stays server-side).
const VAPID_PUBLIC_KEY = "BCBgYD7-StN4-TSy2-W2mgn0bEfTxQ6zWXsbwpPyqOE246Zj_1RGvSBBqJedfyPzmKHBd-6Af8-UMKvGLwIGSY8";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

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

  // Once logged in, look up this person's member row. If the normal
  // auto-link trigger somehow missed (e.g. an admin added them after
  // they already had a login), fall back to matching by email and
  // self-heal the link right here, instead of leaving them stuck.
  useEffect(() => {
    if (!session) { setMember(null); setMemberLookupDone(false); return; }
    setMemberLookupDone(false);

    const findAndLinkMember = async () => {
      let { data } = await supabase
        .from("members")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!data) {
        const { data: byEmail } = await supabase
          .from("members")
          .select("*")
          .ilike("email", session.user.email)
          .maybeSingle();

        if (byEmail && !byEmail.auth_user_id) {
          const { data: linked } = await supabase
            .from("members")
            .update({ auth_user_id: session.user.id })
            .eq("id", byEmail.id)
            .select()
            .maybeSingle();
          data = linked ?? byEmail;
        } else {
          data = byEmail ?? null;
        }
      }

      setMember(data ?? null);
      setMemberLookupDone(true);
    };

    findAndLinkMember();
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
        {mode === "signin" && "Sign in with the email your admin added you with."}
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
        No roster entry found for <b style={{ color: C.ivory }}>{email}</b>. Ask a chapter admin to add you first.
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
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const currentYear = new Date().getFullYear();

  const enableNotifications = async () => {
    try {
      if (typeof Notification === "undefined") { setNotifStatus("unsupported"); return; }
      const permission = await Notification.requestPermission();
      setNotifStatus(permission);
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      await supabase.from("push_subscriptions").upsert(
        {
          member_id: member.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
    } catch (err) {
      console.error("Push subscription failed:", err);
      setNotifStatus("error");
    }
  };

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

  const updateEvent = async (eventId, fields) => {
    await supabase.from("events").update(fields).eq("id", eventId);
    loadEvents();
  };

  const deleteEvent = async (eventId) => {
    await supabase.from("events").delete().eq("id", eventId);
    loadEvents();
  };

  const addMember = async (name, email, roleTitle) => {
    await supabase.from("members").insert({ name, email, role: roleTitle || "Member" });
    setShowAddMember(false);
    loadMembers();
  };

  const removeMember = async (memberId) => {
    await supabase.from("members").delete().eq("id", memberId);
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

  const addPost = async (caption, imagePath) => {
    await supabase.from("posts").insert({ author_id: member.id, caption, image_url: imagePath ?? null });
    loadFeed();
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto pt-9 pb-2">
        {notifStatus === "default" && (
          <div className="mx-5 mb-3 p-3 rounded-sm flex items-center justify-between gap-3" style={{ background: C.purple }}>
            <div className="text-xs" style={{ color: C.ivory, ...sans }}>Get notified about new messages</div>
            <button onClick={enableNotifications} className="text-xs px-3 py-1.5 rounded-sm shrink-0" style={{ background: C.gold, color: C.purpleDeep, ...sans }}>
              Enable
            </button>
          </div>
        )}
        {tab === "home" && <HomeScreen member={member} events={events} />}
        {tab === "events" && <EventsScreen events={events} rsvpIds={rsvpIds} toggleRsvp={toggleRsvp} isOfficer={member.is_officer} onUpdate={updateEvent} onDelete={deleteEvent} />}
        {tab === "members" && (
          <MembersScreen members={members} isOfficer={member.is_officer} duesPaidIds={duesPaidIds} onAdd={() => setShowAddMember(true)} onRemove={removeMember} />
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
        {tab === "feed" && <FeedScreen feed={feed} onAddPost={addPost} member={member} />}
        {tab === "messages" && <MessagesScreen member={member} members={members} />}
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

function EventsScreen({ events, rsvpIds, toggleRsvp, isOfficer, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null); // event object or null
  const [confirmDelete, setConfirmDelete] = useState(null); // event object or null

  return (
    <div className="px-5">
      <ScreenHeader title="Events" subtitle="Chapter calendar" />
      {events.map(e => {
        const going = rsvpIds.has(e.id);
        return (
          <div key={e.id} className="mb-3 p-4 rounded-sm" style={{ background: "#fff", borderTop: `3px solid ${going ? C.green : C.gold}` }}>
            <div className="flex items-start justify-between">
              <div className="text-base" style={{ color: C.ink, ...serif }}>{e.title}</div>
              {isOfficer && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(e)} className="text-[10px] px-2 py-1 rounded-sm" style={{ background: C.ivory, color: C.inkSoft, ...sans }}>Edit</button>
                  <button onClick={() => setConfirmDelete(e)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#F7E9E4" }}>
                    <X size={12} color="#A15A3C" />
                  </button>
                </div>
              )}
            </div>
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

      {editing && (
        <EditEventModal
          event={editing}
          onClose={() => setEditing(null)}
          onSave={(fields) => { onUpdate(editing.id, fields); setEditing(null); }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Event"
          message={`Delete "${confirmDelete.title}"? This also removes everyone's RSVPs for it.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
        />
      )}
    </div>
  );
}

function EditEventModal({ event, onClose, onSave }) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.event_date);
  const [time, setTime] = useState(event.event_time || "");
  const [location, setLocation] = useState(event.location || "");

  return (
    <div className="absolute inset-0 z-30 flex items-end" style={{ background: "rgba(36,21,54,0.55)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg" style={{ ...serif, color: C.ink }}>Edit Event</div>
          <button onClick={onClose}><X size={18} color={C.inkSoft} /></button>
        </div>
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} />
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} />
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Time</label>
        <input value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 7:00 PM" className="w-full mt-1 mb-3 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} />
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Location</label>
        <input value={location} onChange={e => setLocation(e.target.value)} className="w-full mt-1 mb-5 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} />
        <button
          onClick={() => onSave({ title, event_date: date, event_time: time, location })}
          className="w-full py-3 rounded-sm font-medium"
          style={{ background: C.purple, color: C.ivory, ...sans }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function MembersScreen({ members, isOfficer, duesPaidIds, onAdd, onRemove }) {
  const [confirmTarget, setConfirmTarget] = useState(null); // member object or null

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
            {isOfficer && (
              <button onClick={() => setConfirmTarget(m)} className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F7E9E4" }}>
                <X size={12} color="#A15A3C" />
              </button>
            )}
          </div>
        );
      })}

      {confirmTarget && (
        <ConfirmModal
          title="Remove Member"
          message={`Remove ${confirmTarget.name} from the roster? This also removes their RSVPs, messages, and dues history.`}
          confirmLabel="Remove"
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => { onRemove(confirmTarget.id); setConfirmTarget(null); }}
        />
      )}
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

function FeedScreen({ feed, onAddPost, member }) {
  const [caption, setCaption] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handlePhoto = async (file) => {
    setUploading(true);
    const result = await uploadFileToBucket(file, "feed-photos", member.id);
    setUploading(false);
    if (result) setPendingPhoto(result);
  };

  const submit = () => {
    onAddPost(caption, pendingPhoto?.file_path ?? null);
    setCaption("");
    setPendingPhoto(null);
  };

  return (
    <div className="px-5">
      <ScreenHeader title="Chapter Feed" subtitle="Photos & updates" />
      {pendingPhoto && <PendingAttachment fileName={pendingPhoto.file_name} onRemove={() => setPendingPhoto(null)} />}
      <div className="mb-5 flex gap-2">
        <AttachButton onFile={handlePhoto} accept="image/*" />
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder={uploading ? "Uploading…" : "Share an update…"} disabled={uploading} className="flex-1 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} />
        <button
          disabled={uploading || (!caption && !pendingPhoto)}
          onClick={submit}
          className="px-3 rounded-sm text-xs disabled:opacity-40"
          style={{ background: C.purple, color: C.ivory, ...sans }}
        >
          Post
        </button>
      </div>
      {feed.map(p => (
        <div key={p.id} className="mb-5 rounded-sm overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {p.image_url ? (
            <FeedImage path={p.image_url} />
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

// ---- Chat attachments ----

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — keeps things well within free-tier storage

async function uploadFileToBucket(file, bucket, folder) {
  if (file.size > MAX_FILE_BYTES) {
    alert("That file is over 10MB — try something smaller.");
    return null;
  }
  const path = `${folder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) {
    alert("Upload failed: " + error.message);
    return null;
  }
  return { file_path: path, file_name: file.name, file_type: file.type };
}

async function uploadChatFile(file, senderId) {
  return uploadFileToBucket(file, "chat-uploads", senderId);
}

function Attachment({ filePath, fileName, fileType }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.storage.from("chat-uploads").createSignedUrl(filePath, 3600).then(({ data }) => {
      if (active && data) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [filePath]);

  const isImage = fileType?.startsWith("image/");

  if (!url) return <div className="text-xs mt-1" style={{ color: C.inkSoft, ...sans }}>Loading attachment…</div>;

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={url} alt={fileName} className="rounded-sm max-w-full" style={{ maxHeight: 220 }} />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded-sm" style={{ background: "rgba(0,0,0,0.06)" }}>
      <FileText size={14} />
      <span className="text-xs truncate" style={{ ...sans }}>{fileName}</span>
      <Download size={12} className="shrink-0" />
    </a>
  );
}

function FeedImage({ path }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.storage.from("feed-photos").createSignedUrl(path, 3600).then(({ data }) => {
      if (active && data) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);

  if (!url) return <div className="h-40 w-full flex items-center justify-center" style={{ background: "#F2EEE0" }}><span className="text-xs" style={{ color: C.inkSoft, ...sans }}>Loading…</span></div>;
  return <img src={url} alt="" className="h-40 w-full object-cover" />;
}

function AttachButton({ onFile, accept }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }}
      />
      <button onClick={() => inputRef.current?.click()} className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <Paperclip size={16} color={C.inkSoft} />
      </button>
    </>
  );
}

function PendingAttachment({ fileName, onRemove }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-sm text-xs" style={{ background: "#F2EEE0", ...sans }}>
      <Paperclip size={12} />
      <span className="flex-1 truncate">{fileName}</span>
      <button onClick={onRemove}><X size={12} color={C.inkSoft} /></button>
    </div>
  );
}

// ---- Messages ----

function MessagesScreen({ member, members }) {
  const [subTab, setSubTab] = useState("chapter"); // "chapter" | "groups" | "direct"
  const [activeThreadWith, setActiveThreadWith] = useState(null); // member object or null
  const [activeGroup, setActiveGroup] = useState(null); // group object or null

  if (subTab === "direct" && activeThreadWith) {
    return <DirectThread me={member} other={activeThreadWith} onBack={() => setActiveThreadWith(null)} />;
  }
  if (subTab === "groups" && activeGroup) {
    return <GroupThread me={member} group={activeGroup} members={members} onBack={() => setActiveGroup(null)} />;
  }

  return (
    <div className="px-5">
      <ScreenHeader title="Messages" subtitle={subTab === "chapter" ? "Chapter-wide chat" : subTab === "groups" ? "Group chats" : "Direct messages"} />

      <div className="flex mb-4 rounded-sm overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <button onClick={() => setSubTab("chapter")} className="flex-1 py-2 text-xs" style={subTab === "chapter" ? { background: C.purple, color: C.ivory, ...sans } : { background: "#fff", color: C.inkSoft, ...sans }}>
          Chapter
        </button>
        <button onClick={() => setSubTab("groups")} className="flex-1 py-2 text-xs" style={subTab === "groups" ? { background: C.purple, color: C.ivory, ...sans } : { background: "#fff", color: C.inkSoft, ...sans }}>
          Groups
        </button>
        <button onClick={() => setSubTab("direct")} className="flex-1 py-2 text-xs" style={subTab === "direct" ? { background: C.purple, color: C.ivory, ...sans } : { background: "#fff", color: C.inkSoft, ...sans }}>
          Direct
        </button>
      </div>

      {subTab === "chapter" && <ChapterChat me={member} />}
      {subTab === "groups" && <GroupsList me={member} members={members} onOpen={setActiveGroup} />}
      {subTab === "direct" && (
        <div>
          {members.filter(m => m.id !== member.id).map(m => (
            <button key={m.id} onClick={() => setActiveThreadWith(m)} className="w-full flex items-center gap-3 py-3 text-left" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: C.purple, color: C.gold, ...serif }}>
                {m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm" style={{ color: C.ink, ...sans }}>{m.name}</div>
                <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>{m.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupsList({ me, members, onOpen }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false })
    .then(({ data }) => { setGroups(data ?? []); setLoading(false); });

  useEffect(() => { load(); }, []); // eslint-disable-line

  const createGroup = async (name, memberIds) => {
    const { data: group, error } = await supabase.from("groups").insert({ name, created_by: me.id }).select().single();
    if (error || !group) { alert(error?.message || "Could not create group"); return; }
    const rows = [me.id, ...memberIds.filter(id => id !== me.id)].map(member_id => ({ group_id: group.id, member_id }));
    await supabase.from("group_members").insert(rows);
    setShowCreate(false);
    load();
  };

  return (
    <div>
      <button onClick={() => setShowCreate(true)} className="w-full py-2.5 mb-4 rounded-sm text-sm flex items-center justify-center gap-1" style={{ background: C.purple, color: C.ivory, ...sans }}>
        <Plus size={14} /> New Group
      </button>

      {loading && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>Loading…</div>}
      {!loading && groups.length === 0 && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>No groups yet — create one for a committee or board.</div>}
      {groups.map(g => (
        <button key={g.id} onClick={() => onOpen(g)} className="w-full flex items-center gap-3 py-3 text-left" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="w-10 h-10 rounded-sm flex items-center justify-center text-xs shrink-0" style={{ background: C.purple, color: C.gold, ...serif }}>
            {g.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-sm" style={{ color: C.ink, ...sans }}>{g.name}</div>
        </button>
      ))}

      {showCreate && <CreateGroupModal members={members} onClose={() => setShowCreate(false)} onCreate={createGroup} />}
    </div>
  );
}

function CreateGroupModal({ members, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end" style={{ background: "rgba(36,21,54,0.55)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: "#fff", maxHeight: "80%", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg" style={{ ...serif, color: C.ink }}>New Group</div>
          <button onClick={onClose}><X size={18} color={C.inkSoft} /></button>
        </div>
        <label className="text-xs" style={{ color: C.inkSoft, ...sans }}>Group name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 mb-4 px-3 py-2 rounded-sm text-sm" style={{ border: `1px solid ${C.line}`, ...sans }} placeholder="e.g. Exec Board" />

        <label className="text-xs mb-2 block" style={{ color: C.inkSoft, ...sans }}>Add members</label>
        {members.map(m => (
          <label key={m.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
            <span className="text-sm" style={{ color: C.ink, ...sans }}>{m.name}</span>
          </label>
        ))}

        <button
          disabled={!name.trim()}
          onClick={() => onCreate(name, Array.from(selected))}
          className="w-full py-3 mt-4 rounded-sm font-medium disabled:opacity-40"
          style={{ background: C.purple, color: C.ivory, ...sans }}
        >
          Create Group
        </button>
      </div>
    </div>
  );
}

function GroupThread({ me, group, members, onBack }) {
  const [messages, setMessages] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null); // member object or null
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadMessages = () => supabase
    .from("group_messages")
    .select("*, members(name)")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true })
    .then(({ data }) => { setMessages(data ?? []); setLoading(false); });

  const loadMembers = () => supabase
    .from("group_members")
    .select("member_id")
    .eq("group_id", group.id)
    .then(({ data }) => setGroupMembers((data ?? []).map(r => r.member_id)));

  useEffect(() => {
    loadMessages();
    loadMembers();
    const channel = supabase
      .channel(`group_messages_live_${group.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line

  const handleFile = async (file) => {
    setUploading(true);
    const result = await uploadChatFile(file, me.id);
    setUploading(false);
    if (result) setPendingFile(result);
  };

  const send = async () => {
    if (!text.trim() && !pendingFile) return;
    const body = text;
    const attachment = pendingFile;
    setText("");
    setPendingFile(null);
    await supabase.from("group_messages").insert({
      group_id: group.id,
      sender_id: me.id,
      body,
      file_path: attachment?.file_path ?? null,
      file_name: attachment?.file_name ?? null,
      file_type: attachment?.file_type ?? null,
    });
    loadMessages();
  };

  const addMembers = async (memberIds) => {
    const rows = memberIds.map(member_id => ({ group_id: group.id, member_id }));
    await supabase.from("group_members").insert(rows);
    setShowAdd(false);
    loadMembers();
  };

  const removeFromGroup = async (memberId) => {
    await supabase.from("group_members").delete().eq("group_id", group.id).eq("member_id", memberId);
    setConfirmRemove(null);
    loadMembers();
  };

  const notInGroup = members.filter(m => !groupMembers.includes(m.id));
  const inGroup = members.filter(m => groupMembers.includes(m.id));

  return (
    <div className="px-5">
      <div className="flex items-center justify-between pb-4 mb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2">
          <button onClick={onBack}><ArrowLeft size={18} color={C.inkSoft} /></button>
          <div>
            <div className="text-lg" style={{ ...serif, color: C.ink }}>{group.name}</div>
            <button onClick={() => setShowManage(true)} className="text-xs" style={{ color: C.purple, ...sans, textDecoration: "underline" }}>
              {groupMembers.length} members — manage
            </button>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.purple }}>
          <Plus size={14} color={C.ivory} />
        </button>
      </div>

      <div className="mb-3" style={{ maxHeight: 420, overflowY: "auto" }}>
        {loading && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>Loading…</div>}
        {!loading && messages.length === 0 && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>No messages yet — say something.</div>}
        {messages.map(m => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className="mb-2" style={{ textAlign: mine ? "right" : "left" }}>
              {!mine && <div className="text-[10px] mb-0.5" style={{ color: C.inkSoft, ...sans }}>{m.members?.name ?? "Member"}</div>}
              <div className="inline-block px-3 py-2 rounded-sm text-sm max-w-[85%]" style={mine ? { background: C.purple, color: C.ivory, ...sans } : { background: "#fff", border: `1px solid ${C.line}`, color: C.ink, ...sans }}>
                {m.body}
                {m.file_path && <Attachment filePath={m.file_path} fileName={m.file_name} fileType={m.file_type} />}
              </div>
            </div>
          );
        })}
      </div>
      {pendingFile && <PendingAttachment fileName={pendingFile.file_name} onRemove={() => setPendingFile(null)} />}
      <div className="flex gap-2">
        <AttachButton onFile={handleFile} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={uploading ? "Uploading…" : `Message ${group.name}…`}
          disabled={uploading}
          className="flex-1 px-3 py-2 rounded-sm text-sm"
          style={{ border: `1px solid ${C.line}`, ...sans }}
        />
        <button onClick={send} disabled={uploading || (!text.trim() && !pendingFile)} className="w-10 h-10 rounded-sm flex items-center justify-center disabled:opacity-40" style={{ background: C.purple }}>
          <Send size={16} color={C.ivory} />
        </button>
      </div>

      {showAdd && (
        <div className="absolute inset-0 z-30 flex items-end" style={{ background: "rgba(36,21,54,0.55)" }}>
          <AddToGroupModal candidates={notInGroup} onClose={() => setShowAdd(false)} onAdd={addMembers} />
        </div>
      )}

      {showManage && (
        <div className="absolute inset-0 z-30 flex items-end" style={{ background: "rgba(36,21,54,0.55)" }}>
          <div className="w-full rounded-t-2xl p-5" style={{ background: "#fff", maxHeight: "80%", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg" style={{ ...serif, color: C.ink }}>Group Members</div>
              <button onClick={() => setShowManage(false)}><X size={18} color={C.inkSoft} /></button>
            </div>
            {inGroup.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <span className="text-sm" style={{ color: C.ink, ...sans }}>{m.name}{m.id === me.id ? " (you)" : ""}</span>
                <button onClick={() => setConfirmRemove(m)} className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F7E9E4" }}>
                  <X size={12} color="#A15A3C" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Remove from Group"
          message={confirmRemove.id === me.id
            ? "Leave this group? You'll need to be re-added to rejoin."
            : `Remove ${confirmRemove.name} from ${group.name}?`}
          confirmLabel="Remove"
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => removeFromGroup(confirmRemove.id)}
        />
      )}
    </div>
  );
}

function AddToGroupModal({ candidates, onClose, onAdd }) {
  const [selected, setSelected] = useState(new Set());
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  return (
    <div className="w-full rounded-t-2xl p-5" style={{ background: "#fff", maxHeight: "80%", overflowY: "auto" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg" style={{ ...serif, color: C.ink }}>Add to Group</div>
        <button onClick={onClose}><X size={18} color={C.inkSoft} /></button>
      </div>
      {candidates.length === 0 && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>Everyone's already in this group.</div>}
      {candidates.map(m => (
        <label key={m.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
          <span className="text-sm" style={{ color: C.ink, ...sans }}>{m.name}</span>
        </label>
      ))}
      <button
        disabled={selected.size === 0}
        onClick={() => onAdd(Array.from(selected))}
        className="w-full py-3 mt-4 rounded-sm font-medium disabled:opacity-40"
        style={{ background: C.purple, color: C.ivory, ...sans }}
      >
        Add Selected
      </button>
    </div>
  );
}

function ChapterChat({ me }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState(null); // { file_path, file_name, file_type } or null
  const [uploading, setUploading] = useState(false);

  const load = () => supabase
    .from("chapter_messages")
    .select("*, members(name)")
    .order("created_at", { ascending: true })
    .then(({ data }) => { setMessages(data ?? []); setLoading(false); });

  useEffect(() => {
    load();
    const channel = supabase
      .channel("chapter_messages_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chapter_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line

  const handleFile = async (file) => {
    setUploading(true);
    const result = await uploadChatFile(file, me.id);
    setUploading(false);
    if (result) setPendingFile(result);
  };

  const send = async () => {
    if (!text.trim() && !pendingFile) return;
    const body = text;
    const attachment = pendingFile;
    setText("");
    setPendingFile(null);
    await supabase.from("chapter_messages").insert({
      sender_id: me.id,
      body,
      file_path: attachment?.file_path ?? null,
      file_name: attachment?.file_name ?? null,
      file_type: attachment?.file_type ?? null,
    });
    load();
  };

  return (
    <div>
      <div className="mb-3" style={{ maxHeight: 420, overflowY: "auto" }}>
        {loading && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>Loading…</div>}
        {!loading && messages.length === 0 && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>No messages yet — say something.</div>}
        {messages.map(m => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className="mb-2" style={{ textAlign: mine ? "right" : "left" }}>
              {!mine && <div className="text-[10px] mb-0.5" style={{ color: C.inkSoft, ...sans }}>{m.members?.name ?? "Member"}</div>}
              <div
                className="inline-block px-3 py-2 rounded-sm text-sm max-w-[85%]"
                style={mine ? { background: C.purple, color: C.ivory, ...sans } : { background: "#fff", border: `1px solid ${C.line}`, color: C.ink, ...sans }}
              >
                {m.body}
                {m.file_path && <Attachment filePath={m.file_path} fileName={m.file_name} fileType={m.file_type} />}
              </div>
            </div>
          );
        })}
      </div>
      {pendingFile && <PendingAttachment fileName={pendingFile.file_name} onRemove={() => setPendingFile(null)} />}
      <div className="flex gap-2">
        <AttachButton onFile={handleFile} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={uploading ? "Uploading…" : "Message the chapter…"}
          disabled={uploading}
          className="flex-1 px-3 py-2 rounded-sm text-sm"
          style={{ border: `1px solid ${C.line}`, ...sans }}
        />
        <button onClick={send} disabled={uploading || (!text.trim() && !pendingFile)} className="w-10 h-10 rounded-sm flex items-center justify-center disabled:opacity-40" style={{ background: C.purple }}>
          <Send size={16} color={C.ivory} />
        </button>
      </div>
    </div>
  );
}

function DirectThread({ me, other, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => supabase
    .from("direct_messages")
    .select("*")
    .or(`and(sender_id.eq.${me.id},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${me.id})`)
    .order("created_at", { ascending: true })
    .then(({ data }) => { setMessages(data ?? []); setLoading(false); });

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`direct_messages_live_${me.id}_${other.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line

  const handleFile = async (file) => {
    setUploading(true);
    const result = await uploadChatFile(file, me.id);
    setUploading(false);
    if (result) setPendingFile(result);
  };

  const send = async () => {
    if (!text.trim() && !pendingFile) return;
    const body = text;
    const attachment = pendingFile;
    setText("");
    setPendingFile(null);
    await supabase.from("direct_messages").insert({
      sender_id: me.id,
      recipient_id: other.id,
      body,
      file_path: attachment?.file_path ?? null,
      file_name: attachment?.file_name ?? null,
      file_type: attachment?.file_type ?? null,
    });
    load();
  };

  return (
    <div className="px-5">
      <div className="flex items-center gap-2 pb-4 mb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        <button onClick={onBack}><ArrowLeft size={18} color={C.inkSoft} /></button>
        <div className="text-lg" style={{ ...serif, color: C.ink }}>{other.name}</div>
      </div>

      <div className="mb-3" style={{ maxHeight: 460, overflowY: "auto" }}>
        {loading && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>Loading…</div>}
        {!loading && messages.length === 0 && <div className="text-xs" style={{ color: C.inkSoft, ...sans }}>No messages yet.</div>}
        {messages.map(m => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className="mb-2" style={{ textAlign: mine ? "right" : "left" }}>
              <div
                className="inline-block px-3 py-2 rounded-sm text-sm max-w-[85%]"
                style={mine ? { background: C.purple, color: C.ivory, ...sans } : { background: "#fff", border: `1px solid ${C.line}`, color: C.ink, ...sans }}
              >
                {m.body}
                {m.file_path && <Attachment filePath={m.file_path} fileName={m.file_name} fileType={m.file_type} />}
              </div>
            </div>
          );
        })}
      </div>
      {pendingFile && <PendingAttachment fileName={pendingFile.file_name} onRemove={() => setPendingFile(null)} />}
      <div className="flex gap-2">
        <AttachButton onFile={handleFile} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={uploading ? "Uploading…" : `Message ${other.name.split(" ")[0]}…`}
          disabled={uploading}
          className="flex-1 px-3 py-2 rounded-sm text-sm"
          style={{ border: `1px solid ${C.line}`, ...sans }}
        />
        <button onClick={send} disabled={uploading || (!text.trim() && !pendingFile)} className="w-10 h-10 rounded-sm flex items-center justify-center disabled:opacity-40" style={{ background: C.purple }}>
          <Send size={16} color={C.ivory} />
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end" style={{ background: "rgba(36,21,54,0.55)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: "#fff" }}>
        <div className="text-lg mb-2" style={{ ...serif, color: C.ink }}>{title}</div>
        <div className="text-sm mb-5" style={{ color: C.inkSoft, ...sans }}>{message}</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-sm font-medium text-sm" style={{ background: C.ivory, border: `1px solid ${C.line}`, color: C.ink, ...sans }}>
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-sm font-medium text-sm" style={{ background: "#A15A3C", color: "#fff", ...sans }}>
            {confirmLabel}
          </button>
        </div>
      </div>
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
    { id: "messages", icon: MessageCircle, label: "Messages" },
    { id: "feed", icon: Images, label: "Feed" },
  ];
  return (
    <div className="flex items-center justify-around py-2" style={{ borderTop: `1px solid ${C.line}`, background: "#fff" }}>
      {items.map(it => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} className="flex flex-col items-center gap-0.5 px-1">
            <Icon size={17} color={active ? C.purple : C.inkSoft} strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[9px]" style={{ color: active ? C.purple : C.inkSoft, ...sans }}>{it.label}</span>
          </button>
        );
      })}
      <button onClick={() => supabase.auth.signOut()} className="flex flex-col items-center gap-0.5 px-1">
        <LogOut size={17} color={C.inkSoft} strokeWidth={1.8} />
        <span className="text-[9px]" style={{ color: C.inkSoft, ...sans }}>Sign out</span>
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
