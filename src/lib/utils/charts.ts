import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export { Chart, registerables };

export const chartDefaults = (type: string) => ({
	responsive: true,
	maintainAspectRatio: false,
	plugins: {
		legend: {
			display: type === 'doughnut',
			position: 'bottom' as const,
			labels: {
				color: '#94a3b8',
				font: { size: 12 }
			}
		},
		tooltip: {
			backgroundColor: '#1e293b',
			titleColor: '#f1f5f9',
			bodyColor: '#cbd5e1',
			borderColor: '#334155',
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8
		}
	},
	scales: type !== 'doughnut' ? {
		y: {
			grid: { color: 'rgba(51, 65, 85, 0.4)' },
			ticks: { color: '#64748b', font: { size: 11 } }
		},
		x: {
			grid: { display: false },
			ticks: { color: '#64748b', font: { size: 11 } }
		}
	} : undefined
});
