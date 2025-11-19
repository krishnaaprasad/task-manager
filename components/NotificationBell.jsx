// components/NotificationBell.jsx
"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationBell() {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!user?.email) return;

    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/notifications?user=${encodeURIComponent(user.email)}`);
        const json = await res.json();
        if (mounted) setNotes(json.notifications || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // realtime subscription for notifications table (user-specific)
    const channel = supabase
      .channel(`notif-${user.email}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_email=eq.${user.email}` },
        (payload) => {
          // new notification or update
          if (payload.eventType === "INSERT") {
            setNotes(prev => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setNotes(prev => prev.map(n => (n.id === payload.new.id ? payload.new : n)));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notes.filter(n => !n.read).length;

  // when opening dropdown => mark all unread as read (Option 3 = A)
  const handleToggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);

    if (willOpen && unreadCount > 0 && user?.email) {
      try {
        await fetch("/api/notifications/route/mark-read", { method: "PATCH" });
      } catch (err) {
        // fallback: call PATCH endpoint with body (some hosts require body)
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_email: user.email }),
        });
      }

      // optimistic update
      setNotes(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  // Helper: open specific task (we just set window.location to a task page)
  const openTask = (taskId) => {
    if (!taskId) return;
    // try open task activity modal route (adjust if you have a route)
    window.location.href = `/dashboard/manager?task=${taskId}`; // you can change this to open modal instead
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded hover:bg-gray-700"
        title="Notifications"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white text-black rounded shadow-lg z-50">
          <div className="p-2 border-b">
            <strong>Notifications</strong>
          </div>

          <div className="max-h-72 overflow-auto">
            {loading ? (
              <div className="p-3">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="p-3 text-sm text-gray-600">No notifications</div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b cursor-pointer ${n.read ? "bg-gray-50" : "bg-white"}`}
                  onClick={() => openTask(n.task_id)}
                >
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-gray-600 truncate">{n.message}</div>
                  <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t text-right">
            <button
              className="text-sm text-blue-600"
              onClick={async () => {
                if (!user?.email) return;
                // explicit mark read
                await fetch("/api/notifications", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ user_email: user.email }),
                });
                setNotes(prev => prev.map(n => ({ ...n, read: true })));
              }}
            >
              Mark all read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
