// app/dashboard/manager/page.jsx  (replace your existing manager page)
"use client";

import { useEffect, useMemo, useState } from "react";
import TaskModal from "@/components/TaskModal";
import TaskActivityModal from "@/components/TaskActivityModal";
import { supabase } from "@/lib/supabaseClient";
import { redirect } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import {
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

const PAGE_SIZE = 10;
export default function ManagerRedirect() {
  redirect("/dashboard");
}
export default function ManagerDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activityTask, setActivityTask] = useState(null);

  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [page, setPage] = useState(1);

  // Load logged-in user
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user);
    }
    loadUser();
  }, []);

  // Load employee info
  useEffect(() => {
    if (!currentUser?.email) return;
    async function loadMe() {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("email", currentUser.email)
        .maybeSingle();

      setEmployeeInfo(data);
    }
    loadMe();
  }, [currentUser]);

  // Load all tasks + realtime subscription
  useEffect(() => {
    if (!employeeInfo) return;

    async function fetchTasks() {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      setTasks(data || []);
    }

    fetchTasks();

    const channel = supabase
      .channel("manager-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchTasks()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [employeeInfo]);

  // Modal handlers
  const openCreate = () => {
    setSelectedTask(null);
    setShowModal(true);
  };

  const openEdit = (task) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const handleSaved = (task) => {
    if (!task) return;

    setTasks((prev) => {
      const idx = prev.findIndex((p) => p.id === task.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = task;
        return copy;
      }
      return [task, ...prev];
    });
  };

  // Delete
  const handleDelete = async (task) => {
    if (!window.confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
  };

  // Approve
  const handleApprove = async (task) => {
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        approve: true,
        manager_email: currentUser.email,
      }),
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error || "Approval failed");

    alert("Task Approved");
  };

  // Reject
  const handleReject = async (task) => {
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        approve: false,
        manager_email: currentUser.email,
      }),
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error || "Reject failed");

    alert("Task Rejected");
  };

  // Status change (manager allowed)
  const handleStatusChange = async (task, newStage) => {
    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        requester_email: currentUser.email,
        updates: { stage: newStage },
      }),
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error);
  };

  // MANUAL COMPLETION CHECKBOX
  const markComplete = async (task) => {
    const ok = confirm("Mark this task as completed?");
    if (!ok) return;

    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        requester_email: currentUser.email,
        updates: { mark_complete: true },
      }),
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error);

    alert("Task marked as completed");
  };

  // Filters
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();

    return tasks.filter((t) => {
      const match =
        t.title.toLowerCase().includes(s) ||
        (t.brief || "").toLowerCase().includes(s) ||
        (t.assigned_to_name || "").toLowerCase().includes(s);

      const stageOK = filterStage ? t.stage === filterStage : true;
      const prioOK = filterPriority ? t.priority === filterPriority : true;

      return match && stageOK && prioOK;
    });
  }, [tasks, search, filterStage, filterPriority]);

  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!employeeInfo)
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-900">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Manager Dashboard</h1>

        <div className="flex gap-3 items-center">
          <NotificationBell />
          <span className="text-sm text-gray-300">
            {employeeInfo.full_name} (Manager)
          </span>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="px-3 py-1 bg-red-600 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Search Filters */}
      <div className="flex gap-3 items-center mb-4">
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border"
        />

        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border"
        >
          <option value="">All Stages</option>
          <option>Not Started</option>
          <option>Started</option>
          <option>Done</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border"
        >
          <option value="">All Priorities</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setFilterStage("");
            setFilterPriority("");
          }}
          className="px-3 py-2 bg-gray-700 rounded"
        >
          Reset
        </button>

        <button
          onClick={openCreate}
          className="ml-auto px-4 py-2 bg-blue-600 rounded"
        >
          + New Task
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto bg-gray-800 rounded border border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900 text-gray-200">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Title</th>
              <th className="p-3">Brief</th>
              <th className="p-3">Assigned</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Approval</th>
              <th className="p-3">Start</th>
              <th className="p-3">Due</th>
              <th className="p-3">Completion</th>
              <th className="p-3">Status</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {pageData.map((t, i) => {
              const serial = (page - 1) * PAGE_SIZE + i + 1;

              return (
                <tr key={t.id} className="border-t border-gray-700">
                  <td className="p-3">{t.task_number}</td>
                  <td className="p-3">{t.title}</td>
                  <td className="p-3 max-w-xs truncate">{t.brief || "-"}</td>
                  <td className="p-3">{t.assigned_to_name || "-"}</td>
                  <td className="p-3">{t.priority}</td>

                  {/* Approval */}
                  <td className="p-3">
                    {t.approval_status === "pending"
                      ? "⏳ Pending"
                      : t.approval_status === "approved"
                      ? "✅ Approved"
                      : "❌ Rejected"}
                  </td>

                  <td className="p-3">
                    {t.start_date ? new Date(t.start_date).toLocaleDateString() : "-"}
                  </td>

                  <td className="p-3">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : "-"}
                  </td>

                  <td className="p-3">
                    {t.completion_date ? new Date(t.completion_date).toLocaleDateString() : (
                      <>{(t.created_by_email === currentUser?.email || employeeInfo.role === "Manager") ? (
                        <input type="checkbox" onChange={() => markComplete(t)} className="w-4 h-4 cursor-pointer" />
                      ) : ("-")}</>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-3">
                    <select
                      value={t.stage}
                      onChange={(e) => handleStatusChange(t, e.target.value)}
                      className="bg-gray-900 p-1 rounded"
                    >
                      <option>Not Started</option>
                      <option>Started</option>
                      <option>Done</option>
                    </select>
                  </td>

                  <td className="p-3">
                    {t.created_by_name || t.created_by_email}
                  </td>

                  <td className="p-3 flex gap-2">
                    <button onClick={() => openEdit(t)} className="p-1">
                      <PencilSquareIcon className="w-5 h-5 text-blue-400" />
                    </button>

                    <button onClick={() => handleDelete(t)} className="p-1">
                      <TrashIcon className="w-5 h-5 text-red-400" />
                    </button>

                    {/* activity */}
                    <button onClick={() => setActivityTask(t)} className="p-1">
                      <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"></circle>
                        <path d="M12 8v4l2 2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>

                    {t.approval_status === "pending" && (
                      <>
                        <button onClick={() => handleApprove(t)} className="p-1">
                          <CheckIcon className="w-5 h-5 text-green-400" />
                        </button>

                        <button onClick={() => handleReject(t)} className="p-1">
                          <XMarkIcon className="w-5 h-5 text-yellow-400" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showModal && (
        <TaskModal
          onClose={() => {
            setShowModal(false);
            setSelectedTask(null);
          }}
          onSaved={handleSaved}
          currentUser={currentUser}
          employeeInfo={employeeInfo}
          task={selectedTask}
        />
      )}

      {activityTask && (
        <TaskActivityModal
          task={activityTask}
          onClose={() => setActivityTask(null)}
        />
      )}
    </div>
  );
}
