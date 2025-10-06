/**
 * Charts and Statistics for Tax Filing Portal
 * Handles dashboard charts and data visualization
 */

class PortalCharts {
    constructor() {
        this.charts = {};
        this.chartColors = {
            primary: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#06b6d4',
            secondary: '#6b7280'
        };
    }

    // Initialize all charts
    initCharts() {
        this.createActivityChart();
        this.createStatusDistributionChart();
        this.createProgressChart();
        this.createTimelineChart();
    }

    // Activity Chart - Line chart showing activity over time
    createActivityChart() {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        // Generate sample data for the last 30 days
        const days = 30;
        const labels = [];
        const sessionData = [];
        const conversationData = [];
        const jobData = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Generate random sample data
            sessionData.push(Math.floor(Math.random() * 20) + 5);
            conversationData.push(Math.floor(Math.random() * 50) + 10);
            jobData.push(Math.floor(Math.random() * 15) + 2);
        }

        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Sessions',
                        data: sessionData,
                        borderColor: this.chartColors.primary,
                        backgroundColor: this.chartColors.primary + '20',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Conversations',
                        data: conversationData,
                        borderColor: this.chartColors.success,
                        backgroundColor: this.chartColors.success + '20',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Jobs',
                        data: jobData,
                        borderColor: this.chartColors.warning,
                        backgroundColor: this.chartColors.warning + '20',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Activity Overview (Last 30 Days)',
                        color: '#1f2937',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e5e7eb'
                        },
                        ticks: {
                            color: '#6b7280'
                        }
                    },
                    x: {
                        grid: {
                            color: '#e5e7eb'
                        },
                        ticks: {
                            color: '#6b7280'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // Status Distribution Chart - Doughnut chart showing status breakdown
    createStatusDistributionChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Completed', 'Pending', 'Failed'],
                datasets: [{
                    data: [35, 45, 15, 5],
                    backgroundColor: [
                        this.chartColors.success,
                        this.chartColors.primary,
                        this.chartColors.warning,
                        this.chartColors.danger
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Status Distribution',
                        color: '#1f2937',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // Progress Chart - Bar chart showing completion rates
    createProgressChart() {
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;

        this.charts.progress = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Documents', 'Tax Forms', 'Calculations', 'Reviews'],
                datasets: [
                    {
                        label: 'Completed',
                        data: [85, 72, 68, 45],
                        backgroundColor: this.chartColors.success,
                        borderRadius: 4
                    },
                    {
                        label: 'In Progress',
                        data: [10, 20, 25, 30],
                        backgroundColor: this.chartColors.warning,
                        borderRadius: 4
                    },
                    {
                        label: 'Pending',
                        data: [5, 8, 7, 25],
                        backgroundColor: this.chartColors.secondary,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Task Completion Progress',
                        color: '#1f2937',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            color: '#6b7280'
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#6b7280'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Timeline Chart - Horizontal bar chart showing processing times
    createTimelineChart() {
        const ctx = document.getElementById('timelineChart');
        if (!ctx) return;

        this.charts.timeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Document Processing', 'Tax Calculation', 'Form Generation', 'Review Process'],
                datasets: [{
                    label: 'Average Time (minutes)',
                    data: [2.5, 5.2, 1.8, 8.3],
                    backgroundColor: [
                        this.chartColors.info,
                        this.chartColors.primary,
                        this.chartColors.success,
                        this.chartColors.warning
                    ],
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Average Processing Times',
                        color: '#1f2937',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Time (minutes)',
                            color: '#6b7280'
                        },
                        ticks: {
                            color: '#6b7280'
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#6b7280'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Update charts with real data
    updateCharts(data) {
        if (data.sessions && this.charts.activity) {
            this.updateActivityChart(data.sessions);
        }
        
        if (data.sessions && this.charts.status) {
            this.updateStatusChart(data.sessions);
        }
        
        if (data.jobs && this.charts.progress) {
            this.updateProgressChart(data.jobs);
        }
    }

    updateActivityChart(sessionData) {
        // Update activity chart with real session data
        if (this.charts.activity && sessionData.recentActivity) {
            const activity = sessionData.recentActivity;
            
            this.charts.activity.data.datasets[0].data = activity.sessions;
            this.charts.activity.data.datasets[1].data = activity.conversations;
            this.charts.activity.data.datasets[2].data = activity.jobs;
            
            this.charts.activity.update();
        }
    }

    updateStatusChart(sessionData) {
        // Update status distribution chart
        if (this.charts.status && sessionData.statusDistribution) {
            const status = sessionData.statusDistribution;
            
            this.charts.status.data.datasets[0].data = [
                status.active || 0,
                status.completed || 0,
                status.pending || 0,
                status.failed || 0
            ];
            
            this.charts.status.update();
        }
    }

    updateProgressChart(jobData) {
        // Update progress chart with job completion data
        if (this.charts.progress && jobData.completionRates) {
            const rates = jobData.completionRates;
            
            this.charts.progress.data.datasets[0].data = [
                rates.documents?.completed || 0,
                rates.taxForms?.completed || 0,
                rates.calculations?.completed || 0,
                rates.reviews?.completed || 0
            ];
            
            this.charts.progress.data.datasets[1].data = [
                rates.documents?.inProgress || 0,
                rates.taxForms?.inProgress || 0,
                rates.calculations?.inProgress || 0,
                rates.reviews?.inProgress || 0
            ];
            
            this.charts.progress.data.datasets[2].data = [
                rates.documents?.pending || 0,
                rates.taxForms?.pending || 0,
                rates.calculations?.pending || 0,
                rates.reviews?.pending || 0
            ];
            
            this.charts.progress.update();
        }
    }

    // Create mini charts for stat cards
    createMiniChart(canvasId, data, color) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                }
            }
        });
    }

    // Utility method to generate sample trend data
    generateTrendData(days = 7, maxValue = 100) {
        const data = [];
        for (let i = 0; i < days; i++) {
            data.push(Math.floor(Math.random() * maxValue) + 10);
        }
        return data;
    }

    // Utility method to generate labels for time series
    generateTimeLabels(days = 7) {
        const labels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return labels;
    }

    // Destroy all charts
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    // Resize all charts
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }
}

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.portalCharts = new PortalCharts();
    
    // Initialize charts after a short delay to ensure DOM is ready
    setTimeout(() => {
        window.portalCharts.initCharts();
    }, 100);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.portalCharts) {
            window.portalCharts.resizeCharts();
        }
    });
});