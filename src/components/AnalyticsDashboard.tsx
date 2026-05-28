import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell } from 'recharts';
import { Task } from '../types/dashboard';

interface AnalyticsDashboardProps {
  tasks: Record<string, Task>;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tasks }) => {
  const taskArray = Object.values(tasks);

  // Velocity Data (Tasks over time or by status)
  const statusCounts = {
    "TODO": 0,
    "IN_PROGRESS": 0,
    "IN_REVIEW": 0,
    "COMPLETED": 0
  };

  const priorityCounts = {
    "CRITICAL": 0,
    "ELEVATED": 0,
    "STANDARD": 0,
    "LOW": 0
  };

  taskArray.forEach(task => {
    // Map internal status to standard columns for analytics
    if (task.status === "approved") statusCounts["COMPLETED"]++;
    else if (task.status === "pending_review") statusCounts["IN_REVIEW"]++;
    else if (task.progress > 0) statusCounts["IN_PROGRESS"]++;
    else statusCounts["TODO"]++;

    priorityCounts[task.priority as keyof typeof priorityCounts] = (priorityCounts[task.priority as keyof typeof priorityCounts] || 0) + 1;
  });

  const statusData = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));
  const priorityData = Object.entries(priorityCounts).map(([name, count]) => ({ name, count }));

  // Mock velocity data over a week
  const velocityData = [
    { day: 'Mon', completed: 2, new: 5 },
    { day: 'Tue', completed: 4, new: 3 },
    { day: 'Wed', completed: 6, new: 4 },
    { day: 'Thu', completed: 3, new: 2 },
    { day: 'Fri', completed: 8, new: 7 },
    { day: 'Sat', completed: 1, new: 0 },
    { day: 'Sun', completed: Math.max(statusCounts["COMPLETED"], 1), new: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">System Throughput (Velocity)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="completed" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">Task Distribution by Priority</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#334155', opacity: 0.1 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {
                    priorityData.map((entry, index) => {
                      const colors = {
                        "CRITICAL": "#ef4444",
                        "ELEVATED": "#f97316",
                        "STANDARD": "#3b82f6",
                        "LOW": "#64748b"
                      };
                      return <Cell key={`cell-${index}`} fill={colors[entry.name as keyof typeof colors]} />;
                    })
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">Current Pipeline Bottlenecks</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
              />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
