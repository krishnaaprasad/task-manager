"use client";
import { motion } from "framer-motion";

export default function TaskCard({ task }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }} 
      className="bg-white p-4 rounded shadow mb-4"
    >
      <h3 className="font-bold text-lg">{task.title}</h3>
      <p className="text-gray-600">{task.brief}</p>
      <p className="mt-2 text-sm">
        Assigned to: <span className="font-medium">{task.assigned_to}</span>
      </p>
      <p className="mt-1 text-sm">
        Stage: <span className="font-medium">{task.stage}</span>
      </p>
      <p className="mt-1 text-sm">
        Priority: <span className="font-medium">{task.priority}</span>
      </p>
    </motion.div>
  );
}
