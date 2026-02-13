// src/lib/utils/charts.js
export function chartDefaults(type) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeInOutQuart' },
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: '#1a2236', borderColor: '#1e3a5f', borderWidth: 1,
        titleColor: '#e2e8f0', bodyColor: '#94a3b8',
        callbacks: {
          label: ctx => typeof ctx.raw === 'number' ? ` $${ctx.raw.toFixed(2)}` : ` ${ctx.raw}`
        }
      }
    },
    scales: type !== 'doughnut' && type !== 'pie' ? {
      x: { grid: { color: 'rgba(30,58,95,0.4)' }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(30,58,95,0.4)' }, ticks: { color: '#64748b', font: { size: 11 } } }
    } : undefined
  };
}
