// app/dashboard/employee/page.jsx  (replace existing)
"use client";

import { useEffect, useMemo, useState } from "react";
import TaskModal from "@/components/TaskModal";
import TaskActivityModal from "@/components/TaskActivityModal";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";

const PAGE_SIZE = 10;

export default function EmployeeDashboard() {
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
    async function loadAuth() {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user);
    }
    loadAuth();
  }, []);

  // Load employee row
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

  // Load tasks + realtime
  useEffect(() => {
    if (!employeeInfo) return;

    async function fetchTasks() {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("task_number", { ascending: true });

      const me = employeeInfo.full_name;

      const visible = data.filter(
        (t) =>
          t.created_by_email === currentUser.email ||
          t.assigned_to_name === me
      );

      setTasks(visible);
    }

    fetchTasks();

    const channel = supabase
      .channel("employee-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        fetchTasks
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [employeeInfo, currentUser]);

  // Modal
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
      return [...prev, task];
    });
  };

  // Delete request
  const handleDelete = async (task) => {
    if (task.created_by_email !== currentUser.email)
      return alert("Only task creator can request delete.");

    const res = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        requester_email: currentUser.email,
        updates: { delete_task: true },
      }),
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error);

    alert("Delete request sent to manager.");
  };

  // Status change
  const handleStatus = async (task, newStage) => {
    if (task.assigned_to_name !== employeeInfo.full_name)
      return alert("Only assigned employee can update status.");

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

  // Creator manual completion
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

    alert("Task marked as completed.");
  };

  // Filters
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

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
      <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">
        Loading...
      </div>
    );

  const meName = employeeInfo.full_name;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Employee Dashboard</h1>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="text-sm text-gray-300">{meName}</span>
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

      {/* CONTROLS */}
      <div className="flex gap-3 items-center mb-4">
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-gray-800 border rounded"
        />

        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="px-3 py-2 bg-gray-800 border rounded"
        >
          <option value="">All Stages</option>
          <option>Not Started</option>
          <option>Started</option>
          <option>Done</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 bg-gray-800 border rounded"
        >
          <option value="">All Priorities</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <button onClick={openCreate} className="ml-auto px-4 py-2 bg-blue-600 rounded">
          + New Task
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-auto bg-gray-800 border border-gray-700 rounded">
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
              <th className="p-3">Work Status</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {pageData.map((t) => {
              const isCreator = t.created_by_email === currentUser.email;

              const canEdit =
                isCreator &&
                (t.stage === "Not Started" ||
                  t.approval_status === "pending" ||
                  !t.assigned_to_name);

              return (
                <tr key={t.id} className="border-t border-gray-700">
                  <td className="p-3">{t.task_number}</td>

                  <td className="p-3">{t.title}</td>
                  <td className="p-3 max-w-xs truncate">{t.brief || "-"}</td>
                  <td className="p-3">{t.assigned_to_name || "-"}</td>
                  <td className="p-3">{t.priority}</td>

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

                  {/* COMPLETION */}
                  <td className="p-3">
                    {t.completion_date ? (
                      <span>{new Date(t.completion_date).toLocaleDateString()}</span>
                    ) : isCreator ? (
                      <input
                        type="checkbox"
                        onChange={() => markComplete(t)}
                        className="w-5 h-5 cursor-pointer"
                      />
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* WORK STATUS */}
                  <td className="p-3">
                    {t.assigned_to_name === meName ? (
                      <select
                        value={t.stage}
                        onChange={(e) => handleStatus(t, e.target.value)}
                        className="bg-gray-900 p-1 rounded"
                      >
                        <option>Not Started</option>
                        <option>Started</option>
                        <option>Done</option>
                      </select>
                    ) : (
                      <span>{t.stage}</span>
                    )}
                  </td>

                  <td className="p-3">
                    {t.created_by_name || t.created_by_email}
                  </td>

                  <td className="p-3 flex gap-2">
                    {canEdit && (
                      <button onClick={() => openEdit(t)} className="p-1">
                        <PencilSquareIcon className="w-5 h-5 text-blue-400" />
                      </button>
                    )}

                    {isCreator && (
                      <button onClick={() => handleDelete(t)} className="p-1">
                        <TrashIcon className="w-5 h-5 text-red-400" />
                      </button>
                    )}

                    {/* activity */}
                    <button onClick={() => setActivityTask(t)} className="p-1">
                      <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"></circle>
                        <path d="M12 8v4l2 2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
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
