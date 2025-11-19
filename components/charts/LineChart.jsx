// components/charts/LineChart.jsx
"use client";

import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function LineChart({ data = [] }) {
  const labels = data.map(d => d.date);
  const values = data.map(d => d.count || 0);

  const chartData = { labels, datasets: [{ label: "Completed", data: values, fill: true }] };
  const options = { responsive: true, plugins: { legend: { display: false } } };

  return <div className="h-56"><Line data={chartData} options={options} /></div>;
}
