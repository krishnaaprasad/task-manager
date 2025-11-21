"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TaskModal from "@/components/TaskModal";
import TaskActivityModal from "@/components/TaskActivityModal";
import NotificationBell from "@/components/NotificationBell";
import ExportActivityButton from "@/components/ExportActivityButton";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";
import PieChart from "@/components/charts/PieChart";
import toast from "react-hot-toast";
import BriefViewModal from "@/components/BriefViewModal";
import {
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activityTask, setActivityTask] = useState(null);
  const [briefTask, setBriefTask] = useState(null);

  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // ----------------------------------------------
  // LOAD USER
  // ----------------------------------------------
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user || null);
    }
    load();
  }, []);

  // ----------------------------------------------
  // LOAD EMPLOYEE META
  // ----------------------------------------------
  useEffect(() => {
    if (!currentUser?.email) return;
    async function loadMe() {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("email", currentUser.email)
        .maybeSingle();

      setEmployeeInfo(data || null);
    }
    loadMe();
  }, [currentUser]);

  // ----------------------------------------------
  // LOAD TASKS WITH APPROVAL VISIBILITY RULES
  // ----------------------------------------------
  useEffect(() => {
    if (!employeeInfo) return;

    async function fetchAll() {
      const { data: all } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      let visible = all || [];

      // NON-MANAGER RULES
      if (employeeInfo.role !== "Manager") {
        const me = employeeInfo.full_name;

        visible = visible.filter((t) => {
          const isCreator = t.created_by_email === currentUser.email;
          const isAssignee = t.assigned_to_name === me;

          // Assignee sees ONLY after approval
          if (isAssignee && t.approval_status === "approved") return true;

          // Creator sees always
          if (isCreator) return true;

          return false;
        });
      }

      setTasks(visible);

      // summary
      try {
        const res = await fetch("/api/dashboard/summary");
        if (res.ok) {
          const json = await res.json();
          setSummary(json);
        }
      } catch {}
    }

    fetchAll();

    // realtime
    const channel = supabase
      .channel("dash_tasks", { config: { broadcast: { self: true } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchAll();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [employeeInfo, currentUser]);

  // ----------------------------------------------
  // MODAL OPEN/CLOSE
  // ----------------------------------------------
  const openCreate = () => {
    setSelectedTask(null);
    setShowModal(true);
  };

  const openEdit = (t) => {
    setSelectedTask(t);
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

  // ----------------------------------------------
  // APPROVE / REJECT
  // ----------------------------------------------
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
    if (!res.ok) return toast.error(json.error || "Failed");
    toast.success("Approved!");
  };

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
    if (!res.ok) return toast.error(json.error || "Failed");
    toast.success("Rejected!");
  };

  // ----------------------------------------------
  // STATUS CHANGE
  // ----------------------------------------------
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
    if (!res.ok) alert(json.error);
  };

  // ----------------------------------------------
  // MARK COMPLETE
  // ----------------------------------------------
  const markComplete = async (task) => {
    const ok = confirm("Mark as completed?");
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
    if (!res.ok) toast.error(json.error);
    toast.success("Completed!");
  };

  // ----------------------------------------------
  // FILTER & PAGE
  // ----------------------------------------------
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
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-900">
        Loading...
      </div>
    );

  const isManager = employeeInfo.role === "Manager";

  // ----------------------------------------------
  // UI
  // ----------------------------------------------
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <span className="text-sm text-gray-300">
            {employeeInfo.full_name} ({employeeInfo.role})
          </span>
        </div>

        <div className="flex items-center gap-3 cursor-pointer">
          <NotificationBell />
          <ExportActivityButton tasks={tasks} />
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="px-3 py-1 bg-red-600 rounded cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-sm text-gray-300">Total Tasks (30d)</div>
          <div className="text-2xl font-semibold">{summary?.totalTasks ?? "-"}</div>
        </div>

        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-sm text-gray-300">Completed (This Month)</div>
          <div className="text-2xl font-semibold">
            {summary?.completedThisMonth ?? "-"}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-sm text-gray-300">Pending Approval</div>
          <div className="text-2xl font-semibold">
            {summary?.pendingApproval ?? "-"}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-sm text-gray-300">Overdue</div>
          <div className="text-2xl font-semibold">{summary?.overdue ?? "-"}</div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h3 className="mb-2 text-sm text-gray-300">Tasks by Priority</h3>
          <BarChart data={summary?.byPriority ?? {}} />
        </div>

        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h3 className="mb-2 text-sm text-gray-300">Completed (last 30 days)</h3>
          <LineChart data={summary?.completedByDay ?? []} />
        </div>

        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h3 className="mb-2 text-sm text-gray-300">Stage Distribution</h3>
          <PieChart data={summary?.byStage ?? {}} />
        </div>
      </div>

      {/* FILTER + CREATE */}
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

        <button onClick={openCreate} className="ml-auto px-4 py-2 bg-blue-600 rounded">
          + New Task
        </button>
      </div>

      {/* TABLE */}
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
            {pageData.map((t) => {
              const canEdit =
                isManager || t.created_by_email === currentUser.email;

              return (
                <tr key={t.id} className="border-t border-gray-700">
                  <td className="p-3">{t.task_number}</td>
                  <td className="p-3">{t.title}</td>

                  <td className="p-3 max-w-xs">
                    {t.brief?.length > 45 ? (
                      <div>
                        <span className="truncate inline-block max-w-[140px]">
                          {t.brief.slice(0, 45)}...
                        </span>
                        <button
                          onClick={() => setBriefTask(t)}
                          className="text-blue-400 text-xs ml-2 hover:underline"
                        >
                          View More
                        </button>
                      </div>
                    ) : (
                      <span>{t.brief || "-"}</span>
                    )}
                  </td>

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
                    {t.start_date
                      ? new Date(t.start_date).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="p-3">
                    {t.due_date
                      ? new Date(t.due_date).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="p-3">
                    {t.completion_date ? (
                      new Date(t.completion_date).toLocaleDateString()
                    ) : canEdit ? (
                      <input
                        type="checkbox"
                        onChange={() => markComplete(t)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="p-3">
                    {(isManager ||
                      t.assigned_to_name === employeeInfo.full_name) && (
                      <select
                        value={t.stage}
                        onChange={(e) =>
                          handleStatusChange(t, e.target.value)
                        }
                        className="bg-gray-900 p-1 rounded"
                      >
                        <option>Not Started</option>
                        <option>Started</option>
                        <option>Done</option>
                        {t.assigned_to_name === employeeInfo.full_name && (
                          <option>Send for Review</option>
                        )}
                      </select>
                    )}

                    {!(isManager || t.assigned_to_name === employeeInfo.full_name) && (
                      <span>{t.stage}</span>
                    )}
                  </td>

                  <td className="p-3">{t.created_by_name}</td>

                  <td className="p-3 flex gap-2 items-center">
                    {/* EDIT */}
                    {canEdit && (
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        <PencilSquareIcon className="w-5 h-5 text-blue-400" />
                      </button>
                    )}

                    {/* DELETE */}
                    {(isManager || t.created_by_email === currentUser.email) && (
                      <button
                        onClick={() => {
                          fetch("/api/tasks", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: t.id,
                              requester_email: currentUser.email,
                              updates: { delete_task: true },
                            }),
                          })
                            .then((r) => r.json())
                            .then((j) => {
                              if (j.pending) alert("Delete request sent");
                              else if (j.deleted)
                                setTasks((prev) =>
                                  prev.filter((x) => x.id !== t.id)
                                );
                            });
                        }}
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        <TrashIcon className="w-5 h-5 text-red-400" />
                      </button>
                    )}

                    {/* ACTIVITY */}
                    <button
                      onClick={() => setActivityTask(t)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <svg
                        className="w-5 h-5 text-indigo-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"></circle>
                        <path
                          d="M12 8v4l2 2"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                    </button>

                    {/* APPROVAL BUTTONS */}
                    {t.approval_status === "pending" && isManager && (
                      <>
                        <button
                          onClick={() => handleApprove(t)}
                          className="p-1 hover:bg-gray-700 rounded"
                        >
                          <CheckIcon className="w-5 h-5 text-green-400" />
                        </button>

                        <button
                          onClick={() => handleReject(t)}
                          className="p-1 hover:bg-gray-700 rounded"
                        >
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

      {/* PAGINATION */}
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-400">
          Showing {filtered.length} results
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 bg-gray-700 rounded"
          >
            Prev
          </button>
          <div className="px-3 py-1 bg-gray-800 rounded">Page {page}</div>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 bg-gray-700 rounded"
          >
            Next
          </button>
        </div>
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

      {briefTask && (
        <BriefViewModal
          task={briefTask}
          onClose={() => setBriefTask(null)}
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
