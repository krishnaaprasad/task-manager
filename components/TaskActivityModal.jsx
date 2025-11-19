// components/TaskActivityModal.jsx
"use client";

import React from "react";
import { PaperClipIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

export default function TaskActivityModal({ task, onClose }) {
  const activity = task?.activity || [];
  const attachments = task?.attachments || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-gray-800 text-white rounded-lg shadow-lg w-full max-w-2xl p-6 z-50">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold">{task?.title || "Activity"}</h3>
            <p className="text-sm text-gray-300">Task #{task?.task_number || "-"}</p>
          </div>
          <button onClick={onClose} className="px-2 py-1 bg-gray-700 rounded">
            Close
          </button>
        </div>

        {/* Activity List */}
        <div className="space-y-4 max-h-[60vh] overflow-auto pr-2">

          {activity.length === 0 && (
            <div className="text-sm text-gray-300">No activity yet.</div>
          )}

          {activity.slice().reverse().map((a, i) => {
            const {
              action,
              summary,
              old_value,
              new_value,
              user,
              timestamp,
              comment,
            } = a || {};

            const timeString = timestamp
              ? new Date(timestamp).toLocaleString()
              : "-";

            return (
              <div
                key={i}
                className="bg-gray-900 p-3 rounded border border-gray-700"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {action || summary || "Update"}
                    </div>

                    {comment && (
                      <div className="text-xs text-gray-400 italic mt-1">
                        {comment}
                      </div>
                    )}

                    {/* Show old/new values */}
                    {(old_value !== undefined || new_value !== undefined) && (
                      <div className="text-xs text-gray-400 mt-2">
                        {old_value !== undefined && (
                          <span>
                            Old: <strong>{String(old_value ?? "-")}</strong>
                          </span>
                        )}
                        {new_value !== undefined && (
                          <span className="ml-3">
                            New: <strong>{String(new_value ?? "-")}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* FILE LIST BLOCK */}
                    {action === "Files Added" && (
                      <div className="mt-3 bg-gray-800 p-3 rounded border border-gray-700">
                        <div className="font-medium text-sm mb-2 flex items-center gap-2">
                          <PaperClipIcon className="w-4 h-4" /> Files Uploaded
                        </div>

                        {attachments.length === 0 && (
                          <div className="text-xs text-gray-400">No files</div>
                        )}

                        <div className="space-y-2">
                          {attachments.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-900 p-2 rounded border border-gray-700"
                            >
                              <div>
                                <div className="text-sm">{file.name}</div>
                                <div className="text-[10px] text-gray-400">
                                  {file.size
                                    ? (file.size / 1024).toFixed(1) + " KB"
                                    : ""}
                                </div>
                              </div>

                              <a
                                href={file.url}
                                target="_blank"
                                className="text-blue-400 flex items-center gap-1 text-xs"
                              >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
