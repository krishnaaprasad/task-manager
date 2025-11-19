// components/ExportActivityButton.jsx
"use client";

import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { useState } from "react";

/**
 * Exports ALL tasks' activity into an Excel workbook.
 * Expects tasks array prop (client already fetched tasks).
 */
export default function ExportActivityButton({ tasks = [] }) {
  const [loading, setLoading] = useState(false);

  const exportAll = async () => {
    setLoading(true);
    try {
      // Build rows: each activity entry becomes a row with task metadata
      const rows = [];
      (tasks || []).forEach(task => {
        const activity = task.activity || [];
        if (activity.length === 0) {
          rows.push({
            task_number: task.task_number,
            task_id: task.id,
            title: task.title,
            action: "No activity",
            user: task.created_by_email,
            timestamp: task.created_at,
            comment: "",
          });
        } else {
          activity.forEach(a => {
            rows.push({
              task_number: task.task_number,
              task_id: task.id,
              title: task.title,
              action: a.action || a.summary || "Update",
              user: a.user || "",
              timestamp: a.timestamp || "",
              comment: a.comment || "",
              old_value: a.old_value ?? "",
              new_value: a.new_value ?? "",
            });
          });
        }
      });

      // Create worksheet & workbook
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Task Activity");

      // Generate buffer
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });

      saveAs(blob, `task-activity-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={exportAll} className="px-3 py-1 bg-emerald-600 rounded" disabled={loading}>
      {loading ? "Exporting..." : "Export Activity (XLSX)"}
    </button>
  );
}
