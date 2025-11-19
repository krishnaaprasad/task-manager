// components/TaskActivityModal.jsx
"use client";

import React from "react";

export default function TaskActivityModal({ task, onClose }) {
  const activity = task?.activity || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-gray-800 text-white rounded-lg shadow-lg w-full max-w-2xl p-6 z-50">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold">{task?.title || "Activity"}</h3>
            <p className="text-sm text-gray-300">Task #{task?.task_number || "-"}</p>
          </div>
          <button onClick={onClose} className="px-2 py-1 bg-gray-700 rounded">Close</button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
          {activity.length === 0 && <div className="text-sm text-gray-300">No activity yet.</div>}

          {activity.slice().reverse().map((a, i) => {
            // We support both older and structured entries:
            const {
              action,
              summary,
              old_value,
              new_value,
              user,
              timestamp,
              comment,
            } = a || {};

            const timeString = timestamp ? new Date(timestamp).toLocaleString() : "-";

            return (
              <div key={i} className="bg-gray-900 p-3 rounded border border-gray-700">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="text-sm font-medium">{action || summary || "Update"}</div>
                    {summary && <div className="text-xs text-gray-300 mt-1">{summary}</div>}
                    {comment && <div className="text-xs text-gray-400 mt-1 italic">{comment}</div>}
                    <div className="text-xs text-gray-400 mt-2">
                      {old_value !== undefined && (
                        <span>Old: <strong>{String(old_value ?? "-")}</strong></span>
                      )}
                      {new_value !== undefined && (
                        <span className="ml-3">New: <strong>{String(new_value ?? "-")}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-gray-400">
                    <div>{user || "-"}</div>
                    <div className="mt-1">{timeString}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
