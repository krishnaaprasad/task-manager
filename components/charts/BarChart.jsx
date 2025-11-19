// components/charts/BarChart.jsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function BarChart({ data = {} }) {
  // data expected: { Critical: 2, High: 1, Medium: 3, Low: 0 }
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

  const labels = useMemo(() => Object.keys(data || {}), [data]);
  const values = useMemo(() => labels.map(k => data[k] || 0), [data, labels]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: "Tasks",
        data: values,
        backgroundColor: (ctx) => {
          // scriptable background that creates a vertical gradient
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return isDark ? "#b28c34" : "#9a864c";
          const grad = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          // glassy gold gradient
          grad.addColorStop(0, isDark ? "rgba(178,140,52,0.14)" : "rgba(154,134,76,0.16)");
          grad.addColorStop(0.6, isDark ? "rgba(178,140,52,0.28)" : "rgba(154,134,76,0.32)");
          grad.addColorStop(1, isDark ? "rgba(178,140,52,0.6)" : "rgba(154,134,76,0.8)");
          return grad;
        },
        borderColor: isDark ? "rgba(178,140,52,0.9)" : "rgba(154,134,76,0.95)",
        borderWidth: 1.5,
        hoverBorderWidth: 2,
        borderRadius: 6,
        maxBarThickness: 48,
      },
    ],
  }), [labels, values, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? "rgba(17,20,25,0.9)" : "rgba(255,255,255,0.98)",
        titleColor: isDark ? "#fff" : "#1b1b1b",
        bodyColor: isDark ? "#ddd" : "#222",
        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        borderWidth: 1,
        padding: 10,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.formattedValue}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: isDark ? "#d6d6d6" : "#222", font: { weight: 600 } },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: isDark ? "#9ea3a8" : "#444" },
        grid: {
          color: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
          drawBorder: false,
        },
      },
    },
  }), [isDark]);

  return (
    <div className="h-56 w-full">
      <Bar options={options} data={chartData} />
    </div>
  );
}
