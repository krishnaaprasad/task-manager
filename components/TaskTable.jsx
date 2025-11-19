// components/TaskModal.jsx
"use client";

import { useEffect, useState } from "react";

export default function TaskModal({ onClose, onSaved, currentUser, employeeInfo, task = null }) {
  const isEdit = Boolean(task);

  const [employees, setEmployees] = useState([]);
  const [title, setTitle] = useState(task?.title || "");
  const [brief, setBrief] = useState(task?.brief || "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to_name || "");
  const [assignedEmail, setAssignedEmail] = useState(task?.assigned_to_email || "");
  const [priority, setPriority] = useState(task?.priority || "Medium");
  const [startDate, setStartDate] = useState(task?.start_date ? task.start_date.slice(0,10) : "");
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.slice(0,10) : "");
  const [loading, setLoading] = useState(false);

  const isManager = employeeInfo?.role === "Manager";
  const isCreator = task?.created_by_email === currentUser?.email;

  const canEdit =
    !isEdit ||
    isManager ||
    (isCreator && (task?.approval_status === "pending" || task.stage === "Not Started"));

  useEffect(() => {
    fetch("/api/employees")
      .then(r => r.json())
      .then(j => setEmployees(j.employees || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setTitle(task?.title || "");
    setBrief(task?.brief || "");
    setAssignedTo(task?.assigned_to_name || "");
    setAssignedEmail(task?.assigned_to_email || "");
    setPriority(task?.priority || "Medium");
    setStartDate(task?.start_date ? task.start_date.slice(0, 10) : "");
    setDueDate(task?.due_date ? task.due_date.slice(0, 10) : "");
  }, [task]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title) return alert("Title required");

    setLoading(true);

    try {
      if (!isEdit) {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            brief,
            priority,
            assigned_to_name: assignedTo || null,
            assigned_to_email: assignedEmail || null,
            created_by_email: currentUser.email,
            created_by_name: employeeInfo?.full_name || null,
            start_date: startDate || null,
            due_date: dueDate || null,
          }),
        });

        const json = await res.json();
        if (!res.ok) return alert(json.error || "Create failed");

        onSaved(json.task);
        onClose();
        return;
      }

      const updates = {
        title,
        brief,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
      };

      if (isManager) {
        updates.assigned_to_name = assignedTo || null;
        updates.assigned_to_email = assignedEmail || null;
      }

      if (!isManager && assignedTo !== task.assigned_to_name) {
        updates.assigned_to_name = assignedTo || null;
      }

      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          requester_email: currentUser.email,
          updates,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Update failed");
        setLoading(false);
        return;
      }

      if (json.pending) {
        onClose();
        return;
      }

      onSaved(json.task);
      onClose();

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-gray-800 text-white rounded-lg shadow-lg w-full max-w-lg p-6 z-50">
        <h3 className="text-xl font-semibold mb-4">
          {isEdit ? "Edit Task" : "Create Task"}
        </h3>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className="w-full p-2 rounded bg-gray-700 border"
            disabled={!canEdit}
          />

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Brief"
            className="w-full p-2 rounded bg-gray-700 border"
            disabled={!canEdit}
          />

          <div>
            <label className="text-sm mb-1 block">Assign To</label>
            <select
              value={assignedTo}
              onChange={(e) => {
                const name = e.target.value;
                setAssignedTo(name);
                const emp = employees.find((x) => x.full_name === name);
                setAssignedEmail(emp?.email || "");
              }}
              className="w-full p-2 rounded bg-gray-700 border"
              disabled={!canEdit && !isManager}
            >
              <option value="">-- Select --</option>
              {employees.map((emp) => (
                <option key={emp.email} value={emp.full_name}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm mb-1 block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 border"
              disabled={!canEdit}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm block">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 border"
                disabled={!canEdit}
              />
            </div>

            <div className="flex-1">
              <label className="text-sm block">Due</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 border"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-3 py-1 rounded bg-blue-600">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>

        {/* ---------------- ACTIVITY LOG ---------------- */}
        {task && task.activity && (
          <div className="mt-5 bg-gray-900 p-3 rounded border border-gray-700 max-h-60 overflow-auto">
            <h3 className="text-md font-semibold mb-2">Activity Log</h3>
            {task.activity
              .slice()
              .reverse()
              .map((a, i) => (
                <div key={i} className="border-b border-gray-700 py-2">
                  <div className="text-sm text-gray-300">{a.action}</div>
                  {a.comment && (
                    <div className="text-xs text-gray-400">{a.comment}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {new Date(a.timestamp).toLocaleString()} — {a.user}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
