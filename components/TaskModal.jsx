// components/TaskModal.jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TaskModal({
  onClose,
  onSaved,
  currentUser,
  employeeInfo,
  task = null,
}) {
  const isEdit = Boolean(task);

  const [employees, setEmployees] = useState([]);
  const [title, setTitle] = useState(task?.title || "");
  const [brief, setBrief] = useState(task?.brief || "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to_name || "");
  const [assignedEmail, setAssignedEmail] = useState(task?.assigned_to_email || "");
  const [priority, setPriority] = useState(task?.priority || "Medium");
  const [startDate, setStartDate] = useState(task?.start_date ? task.start_date.slice(0, 10) : "");
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.slice(0, 10) : "");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);

  const isManager = employeeInfo?.role === "Manager";
  const isCreator = task?.created_by_email === currentUser?.email;

  const canEdit =
    !isEdit ||
    isManager ||
    (isCreator &&
      (task?.approval_status === "pending" || task.stage === "Not Started"));

  // Load employees
  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((j) => setEmployees(j.employees || []));
  }, []);

  // When switching tasks
  useEffect(() => {
    setTitle(task?.title || "");
    setBrief(task?.brief || "");
    setAssignedTo(task?.assigned_to_name || "");
    setAssignedEmail(task?.assigned_to_email || "");
    setPriority(task?.priority || "Medium");
    setStartDate(task?.start_date ? task.start_date.slice(0, 10) : "");
    setDueDate(task?.due_date ? task.due_date.slice(0, 10) : "");
  }, [task]);

  // Submit
  const submit = async (e) => {
    e.preventDefault();
    if (!title) return alert("Title required");

    setLoading(true);

    let uploadedFiles = [];

    // Upload files
    if (files.length > 0) {
      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from("task-files")
          .upload(fileName, file);

        if (!error) {
          const { data: urlData } = supabase.storage
            .from("task-files")
            .getPublicUrl(fileName);

          uploadedFiles.push({
            name: file.name,
            path: fileName,
            url: urlData.publicUrl,
          });
        }
      }
    }

    try {
      // CREATE
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
            attachments: uploadedFiles,
          }),
        });

        const json = await res.json();
        if (!res.ok) return alert(json.error || "Create failed");

        onSaved(json.task);
        onClose();
        return;
      }

      // UPDATE
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
      if (!res.ok) return alert(json.error || "Update failed");

      if (json.pending) return onClose();
      onSaved(json.task);
      onClose();
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------
  // UI
  // ----------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div
        className="
          relative w-full max-w-md 
          bg-gray-900 text-white 
          rounded-xl shadow-2xl border border-gray-700 
          p-5 z-50 animate-fadeIn
          max-h-[85vh] overflow-y-auto
        "
      >
        <h3 className="text-xl font-semibold mb-3">
          {isEdit ? "Edit Task" : "Create Task"}
        </h3>

        <form onSubmit={submit} className="space-y-4">

          {/* TITLE */}
          <div>
            <label className="text-sm opacity-80">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={!canEdit}
              className="
                w-full p-2.5 rounded-lg bg-gray-800 
                border border-gray-700 
                focus:ring-2 focus:ring-blue-500 
                outline-none mt-1
              "
              placeholder="Task Title"
            />
          </div>

          {/* BRIEF */}
          <div>
            <label className="text-sm opacity-80">Brief</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className="
                w-full p-2.5 rounded-lg bg-gray-800
                border border-gray-700 
                focus:ring-2 focus:ring-blue-500 
                outline-none mt-1
              "
              placeholder="Task description..."
            />
          </div>

          {/* ASSIGN */}
          <div>
            <label className="text-sm opacity-80">Assign To</label>
            <select
              value={assignedTo}
              onChange={(e) => {
                const name = e.target.value;
                setAssignedTo(name);
                const emp = employees.find((x) => x.full_name === name);
                setAssignedEmail(emp?.email || "");
              }}
              disabled={!canEdit && !isManager}
              className="
                w-full p-2.5 rounded-lg bg-gray-800 
                border border-gray-700 
                focus:ring-2 focus:ring-blue-500 mt-1
              "
            >
              <option>-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp.email} value={emp.full_name}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* PRIORITY */}
          <div>
            <label className="text-sm opacity-80">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={!canEdit}
              className="
                w-full p-2.5 rounded-lg bg-gray-800
                border border-gray-700 
                focus:ring-2 focus:ring-blue-500 mt-1
              "
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>

          {/* DATES */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm opacity-80">Start Date</label>
              <input
                type="date"
                value={startDate}
                disabled={!canEdit}
                onChange={(e) => setStartDate(e.target.value)}
                className="
                  w-full p-2.5 rounded-lg bg-gray-800 
                  border border-gray-700 
                  focus:ring-2 focus:ring-blue-500 mt-1
                "
              />
            </div>

            <div>
              <label className="text-sm opacity-80">Due Date</label>
              <input
                type="date"
                value={dueDate}
                disabled={!canEdit}
                onChange={(e) => setDueDate(e.target.value)}
                className="
                  w-full p-2.5 rounded-lg bg-gray-800 
                  border border-gray-700 
                  focus:ring-2 focus:ring-blue-500 mt-1
                "
              />
            </div>
          </div>

          {/* FILE UPLOAD */}
          <div>
            <label className="text-sm opacity-80">Attachments</label>
            <input
              type="file"
              multiple
              disabled={!canEdit}
              onChange={(e) => setFiles([...e.target.files])}
              className="
                w-full p-2.5 rounded-lg bg-gray-800 
                border border-gray-700 file:bg-blue-600 
                file:text-white file:px-4 file:py-1 
                file:rounded-md mt-1 cursor-pointer
              "
            />
          </div>

          {/* BUTTONS */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-600/20"
            >
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
