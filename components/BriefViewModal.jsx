"use client";

export default function BriefViewModal({ task, onClose }) {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 p-5 z-50 max-h-[85vh] overflow-y-auto">
        
        <h2 className="text-xl font-semibold mb-3">
          {task.title}
        </h2>

        <div className="mb-4">
          <h3 className="text-sm opacity-80 mb-1">Full Brief:</h3>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {task.brief || "No brief provided"}
          </p>
        </div>

        {task.attachments?.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm opacity-80 mb-1">Attachments:</h3>

            <ul className="space-y-2">
              {task.attachments.map((file, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded-lg border border-gray-700"
                >
                  <span className="truncate">{file.name}</span>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-sm hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
