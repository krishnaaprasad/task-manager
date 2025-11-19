"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ManagerApprovalModal({ task, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (approved) => {
    setLoading(true);
    try {
      const updates = {
        approval_pending: false,
        approved: approved,
      };

      // Handle pending actions
      if (task.pending_action === "delete" && approved) {
        await supabase.from("tasks").delete().eq("id", task.id);
      } else if (task.pending_action === "reassign" && approved) {
        updates.assigned_to = task.pending_assigned_to;
      }

      // Clear pending fields
      updates.pending_action = null;
      updates.pending_assigned_to = null;

      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) {
        alert("Action failed: " + error.message);
      } else {
        onUpdate && onUpdate(data[0]);
        onClose && onClose();
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose}></div>

      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-5 z-50">
        <h3 className="text-lg font-semibold mb-3">Manager Approval</h3>
        <p className="mb-4">
          Task: <strong>{task.title}</strong>
        </p>
        <p className="mb-4">
          Pending Action: <strong>{task.pending_action}</strong>
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 rounded bg-gray-300"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded bg-green-600 text-white"
            onClick={() => handleAction(true)}
            disabled={loading}
          >
            Approve
          </button>
          <button
            className="px-3 py-1 rounded bg-red-600 text-white"
            onClick={() => handleAction(false)}
            disabled={loading}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
