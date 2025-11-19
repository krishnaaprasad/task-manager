// components/charts/LineChart.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function LineChart({ data = [] }) {
  // data expected: [{ date: "2025-11-01", count: 1 }, ...]
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const detect = () => {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const hasDarkClass = document.documentElement.classList.contains("dark");
      setIsDark(hasDarkClass || prefersDark);
    };
    detect();
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", detect);
    const observer = new MutationObserver(detect);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", detect);
      observer.disconnect();
    };
  }, []);

  const labels = useMemo(() => data.map(d => d.date), [data]);
  const values = useMemo(() => data.map(d => d.count || 0), [data]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      label: "Completed",
      data: values,
      borderColor: isDark ? "rgba(178,140,52,0.95)" : "rgba(154,134,76,0.95)",
      borderWidth: 2.25,
      tension: 0.35,
      pointRadius: 3.2,
      pointHoverRadius: 6,
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return "rgba(178,140,52,0.18)";
        const grad = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        grad.addColorStop(0, isDark ? "rgba(178,140,52,0.06)" : "rgba(154,134,76,0.06)");
        grad.addColorStop(1, isDark ? "rgba(178,140,52,0.26)" : "rgba(154,134,76,0.28)");
        return grad;
      },
      fill: true,
      pointBackgroundColor: isDark ? "#fff" : "#fff",
      pointBorderColor: isDark ? "rgba(178,140,52,0.95)" : "rgba(154,134,76,0.95)",
    }],
  }), [labels, values, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutCubic" },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? "rgba(17,20,25,0.9)" : "rgba(255,255,255,0.98)",
        titleColor: isDark ? "#fff" : "#111",
        bodyColor: isDark ? "#ddd" : "#222",
        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: isDark ? "#d0d6db" : "#333", maxRotation: 0, autoSkip: true },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: isDark ? "#9ea3a8" : "#444" },
        grid: { color: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" },
      },
    },
  }), [isDark]);

  return (
    <div className="h-56 w-full">
      <Line options={options} data={chartData} />
    </div>
  );
}
