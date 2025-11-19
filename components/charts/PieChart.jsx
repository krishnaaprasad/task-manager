// components/charts/PieChart.jsx
"use client";

import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

export default function PieChart({ data = {} }) {
  const labels = Object.keys(data);
  const values = labels.map(k => data[k] || 0);
  const chartData = { labels, datasets: [{ data: values }] };
  const options = { responsive: true, plugins: { legend: { position: "bottom" } } };

  return <div className="h-56"><Pie data={chartData} options={options} /></div>;
}
