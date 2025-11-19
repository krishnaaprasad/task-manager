// app/dashboard/activity/page.jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ActivityPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/tasks/activity");
      const j = await res.json();
      setRows(j.rows || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = rows.filter(r => {
    const s = q.trim().toLowerCase();
    if (s && !(r.action || "").toLowerCase().includes(s) && !(r.comment || "").toLowerCase().includes(s) && !(r.task_title || "").toLowerCase().includes(s)) return false;
    if (userFilter && r.user !== userFilter) return false;
    return true;
  });

  const users = Array.from(new Set(rows.map(r => r.user))).slice(0, 50);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Activity Log</h1>
        <div className="flex gap-2">
          <a href="/api/tasks/export" className="px-3 py-2 bg-gray-800 rounded">Export CSV</a>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search action / comment / task..." className="px-3 py-2 bg-gray-800 rounded border" />
        <select value={userFilter} onChange={(e)=>setUserFilter(e.target.value)} className="px-3 py-2 bg-gray-800 rounded border">
          <option value="">All users</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div className="bg-gray-800 rounded border border-gray-700 p-3">
        {loading ? <div>Loading...</div> :
          filtered.length === 0 ? <div className="text-gray-400">No entries</div> :
          <ul className="space-y-2">
            {filtered.map((r,i) => (
              <li key={i} className="p-3 bg-gray-900 rounded flex justify-between items-start">
                <div>
                  <div className="font-medium">{r.action} — <span className="text-sm text-gray-300">{r.task_title || "-"}</span></div>
                  <div className="text-sm text-gray-300">{r.comment}</div>
                  <div className="text-xs text-gray-400 mt-1">By {r.user}</div>
                </div>
                <div className="text-xs text-gray-400">{new Date(r.timestamp).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        }
      </div>
    </div>
  );
}
