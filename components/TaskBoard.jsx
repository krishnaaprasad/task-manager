"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TaskModal from "./TaskModal";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import TaskTable from "./TaskTable";

const PAGE_SIZE = 10;

export default function TaskBoard() {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [sortBy, setSortBy] = useState({ field: "created_at", dir: "desc" });
  const [page, setPage] = useState(1);

  // ----------------------------
  // Fetch Tasks
  // ----------------------------
  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      // Employees see only their tasks, Managers see all
      const visibleTasks =
        user?.role === "Manager"
          ? data
          : data.filter((t) => t.assigned_to === user?.email || t.created_by === user?.email);
      setTasks(visibleTasks);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return; // If not logged in, do nothing
    fetchTasks();

    const channel = supabase
      .channel("public:tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  // ----------------------------
  // Modal Handlers
  // ----------------------------
  const openCreateModal = () => { setSelectedTask(null); setOpenModal(true); };
  const openEditModal = (task) => { setSelectedTask(task); setOpenModal(true); };

  // ----------------------------
  // Delete Task
  // ----------------------------
  async function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (user?.role !== "Manager") {
      // Employee requests deletion → pending manager approval
      const { error } = await supabase
        .from("tasks")
        .update({ approval_pending: true, pending_action: "delete" })
        .eq("id", id);

      if (error) { alert("Failed to request deletion"); return; }
      alert("Deletion requested. Awaiting manager approval.");
    } else {
      // Manager deletes directly
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) { alert("Delete failed"); return; }
    }

    fetchTasks();
  }

  // ----------------------------
  // Approve / Reject
  // ----------------------------
  async function handleApprove(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    if (task.pending_action === "delete") {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) { alert("Approval failed"); return; }
    } else if (task.pending_action === "reassign" && task.new_assigned_to) {
      const { error } = await supabase.from("tasks")
        .update({ assigned_to: task.new_assigned_to, approval_pending: false, pending_action: null, new_assigned_to: null })
        .eq("id", id);
      if (error) { alert("Approval failed"); return; }
    } else {
      const { error } = await supabase.from("tasks")
        .update({ approval_pending: false, pending_action: null })
        .eq("id", id);
      if (error) { alert("Approval failed"); return; }
    }

    fetchTasks();
  }

  async function handleReject(id) {
    const { error } = await supabase.from("tasks")
      .update({ approval_pending: false, pending_action: null, new_assigned_to: null })
      .eq("id", id);
    if (error) { alert("Rejection failed"); return; }

    fetchTasks();
  }

  // ----------------------------
  // Filter & Sort
  // ----------------------------
  const filtered = useMemo(() => tasks.filter((t) => {
    const searchTerm = search.trim().toLowerCase();
    const matchesSearch =
      !searchTerm ||
      t.title?.toLowerCase().includes(searchTerm) ||
      t.brief?.toLowerCase().includes(searchTerm) ||
      t.assigned_to?.toLowerCase().includes(searchTerm);

    const matchesStage = filterStage ? t.stage === filterStage : true;
    const matchesPriority = filterPriority ? t.priority === filterPriority : true;

    return matchesSearch && matchesStage && matchesPriority;
  }), [tasks, search, filterStage, filterPriority]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const f = sortBy.field;
    const dir = sortBy.dir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      const va = a[f] ?? "";
      const vb = b[f] ?? "";
      if (f === "created_at" || f === "due_date") return (new Date(va) - new Date(vb)) * dir;
      if (f === "priority") { const map = { Critical: 4, High: 3, Medium: 2, Low: 1 }; return ((map[va] || 0) - (map[vb] || 0)) * dir; }
      return String(va).localeCompare(String(vb)) * dir;
    });

    return arr;
  }, [filtered, sortBy]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const toggleSort = (field) => {
    setPage(1);
    setSortBy((s) => s.field === field ? { field, dir: s.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  };

  // ----------------------------
  // Logout
  // ----------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); // Clear context
  };

  // ----------------------------
  // If no user, show login placeholder
  // ----------------------------
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
        <p>Please login to access the dashboard.</p>
      </div>
    );
  }

  return (
    <div className={`p-6 min-h-screen ${theme === "dark" ? "bg-gray-900" : "bg-gray-100"}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <div className="flex items-center gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search..." className="px-3 py-2 rounded-lg border w-64 dark:bg-gray-700 dark:text-white" />
          <select value={filterStage} onChange={(e) => { setFilterStage(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:text-white">
            <option value="">All Stages</option>
            <option>Pending Approval</option>
            <option>Approved</option>
            <option>In Progress</option>
            <option>Review</option>
            <option>QC</option>
            <option>Done</option>
          </select>
          <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:text-white">
            <option value="">All Priority</option>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <button onClick={() => { setSearch(""); setFilterStage(""); setFilterPriority(""); setSortBy({ field: "created_at", dir: "desc" }); setPage(1); }} className="px-3 py-2 rounded-lg bg-gray-500 text-white">Reset</button>
          <button onClick={openCreateModal} className="px-4 py-2 rounded-lg bg-blue-600 text-white">+ New</button>
          <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-red-600 text-white">Logout</button>
        </div>
      </div>

      <TaskTable
        tasks={pageData}
        currentUser={user}
        onEdit={openEditModal}
        onDelete={deleteTask}
        onSort={toggleSort}
        onApprove={handleApprove}
        onReject={handleReject}
        sortBy={sortBy}
      />

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <div>Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded border" disabled={page === 1}>Prev</button>
          <div>Page {page} of {totalPages}</div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded border" disabled={page === totalPages}>Next</button>
        </div>
      </div>

      {openModal && (
        <TaskModal
          onClose={() => { setOpenModal(false); setSelectedTask(null); }}
          onTaskCreated={() => { fetchTasks(); setOpenModal(false); }}
          task={selectedTask}
          currentUser={user}
        />
      )}
    </div>
  );
}
