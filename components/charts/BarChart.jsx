// components/charts/BarChart.jsx
"use client";

import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function BarChart({ data = {} }) {
  const labels = Object.keys(data);
  const values = labels.map(k => data[k] || 0);

  const chartData = {
    labels,
    datasets: [{ label: "Tasks", data: values }],
  };

  const options = { responsive: true, plugins: { legend: { display: false } } };

  return <div className="h-56"><Bar data={chartData} options={options} /></div>;
}
