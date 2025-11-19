// components/charts/PieChart.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PieChart({ data = {} }) {
  // data expected: { "Not Started": 2, "Started": 1, "Done": 4 }
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

  // pick visually distinct accents for glassy gold theme
  const palette = useMemo(() => {
    return [
      "rgba(178,140,52,0.95)", // gold
      "rgba(100,120,140,0.95)", // muted steel
      "rgba(90,160,140,0.95)",  // teal
      "rgba(200,150,90,0.95)",  // soft gold variant
    ];
  }, []);

  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => palette[i % palette.length]),
      borderColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.06)",
      borderWidth: 1.5,
    }],
  }), [labels, values, palette, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutCubic" },
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: isDark ? "#d6d6d6" : "#333", boxWidth: 12, padding: 12 },
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(17,20,25,0.9)" : "rgba(255,255,255,0.98)",
        titleColor: isDark ? "#fff" : "#111",
        bodyColor: isDark ? "#ddd" : "#222",
        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.formattedValue}`,
        },
      },
    },
  }), [isDark]);

  return (
    <div className="h-56 w-full">
      <Pie options={options} data={chartData} />
    </div>
  );
}
