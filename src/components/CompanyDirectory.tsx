"use client";

import React, { useState, useEffect } from "react";
import { Users, Clock, FileText, CheckCircle, MapPin, Phone, Building2, Upload, Calendar, ArrowRight, ShieldAlert, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string;
  phone_number: string;
  address: string;
  job_title: string;
  salary_amount: number;
  salary_frequency: string;
  joined_at: string;
}

interface Attendance {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
}

interface DailyReport {
  id: string;
  user_id: string;
  date: string;
  report_text: string;
}

interface CompanyDirectoryProps {
  role: "director" | "employee";
}

export const CompanyDirectory: React.FC<CompanyDirectoryProps> = ({ role }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [dailyReport, setDailyReport] = useState("");
  const [submittedReport, setSubmittedReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Sub-tabs for Director view
  const [activeSubTab, setActiveSubTab] = useState<"profiles" | "timesheets">("profiles");

  // Timesheets Data
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  
  // Date Filters
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected Report Modal
  const [selectedReportText, setSelectedReportText] = useState<string | null>(null);

  const fetchTimesheets = async () => {
    try {
      const aRes = await apiFetch(`/api/attendance?all=true&startDate=${startDate}&endDate=${endDate}`);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAllAttendance(aData.attendance || []);
      }

      const rRes = await apiFetch(`/api/daily-reports?all=true&startDate=${startDate}&endDate=${endDate}`);
      if (rRes.ok) {
        const rData = await rRes.json();
        setAllReports(rData.reports || []);
      }
    } catch (e) {
      console.error("Failed to fetch global timesheets", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const uid = session.user.id;
    setCurrentUserId(uid);

    try {
      // Fetch Profiles
      const pRes = await apiFetch('/api/profiles');
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.profiles) setProfiles(pData.profiles);
      }

      // Fetch Own Attendance
      const aRes = await apiFetch('/api/attendance');
      if (aRes.ok) {
        const aData = await aRes.json();
        if (aData.attendance) setAttendance(aData.attendance);
      }

      // Fetch Own Daily Report
      const rRes = await apiFetch('/api/daily-reports');
      if (rRes.ok) {
        const rData = await rRes.json();
        if (rData.reports && rData.reports.length > 0) {
          const myReport = (rData.reports as DailyReport[]).find((r) => r.user_id === uid);
          if (myReport) {
            setSubmittedReport(myReport);
            setDailyReport(myReport.report_text);
          }
        }
      }

      if (role === 'director') {
        await fetchTimesheets();
      }
    } catch (err) {
      console.error("Failed to fetch directory data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  // Refetch timesheets on date change
  useEffect(() => {
    if (role === 'director' && currentUserId) {
      fetchTimesheets();
    }
  }, [startDate, endDate]);

  const handleCheckIn = async () => {
    try {
      const res = await apiFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_in' })
      });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data.attendance);
        if (role === 'director') fetchTimesheets();
      }
    } catch (e) { console.error(e); }
  };

  const handleCheckOut = async () => {
    try {
      const res = await apiFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_out' })
      });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data.attendance);
        if (role === 'director') fetchTimesheets();
      }
    } catch (e) { console.error(e); }
  };

  const handleSubmitReport = async () => {
    if (!dailyReport.trim()) return;
    try {
      const res = await apiFetch('/api/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_text: dailyReport })
      });
      if (res.ok) {
        const data = await res.json();
        setSubmittedReport(data.report);
        if (role === 'director') fetchTimesheets();
      }
    } catch (e) { console.error(e); }
  };

  const handleAvatarUpload = () => {
    const url = prompt("Enter Avatar Image URL:");
    if (url) {
      updateProfile({ avatar_url: url });
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const res = await apiFetch(`/api/profiles/${currentUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(prev => {
          const exists = prev.find(p => p.user_id === currentUserId);
          if (exists) return prev.map(p => p.user_id === currentUserId ? { ...p, ...data.profile } : p);
          return [...prev, data.profile];
        });
      }
    } catch (e) { console.error(e); }
  };

  const calculateHours = (inStr: string | null, outStr: string | null) => {
    if (!inStr || !outStr) return "-";
    const diff = new Date(outStr).getTime() - new Date(inStr).getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours.toFixed(2) + " hrs";
  };

  if (loading) {
    return <div className="p-6 text-slate-500 font-mono">Loading HRMS Subsystem...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/50 p-6 overflow-y-auto relative">
      
      {/* Title */}
      <div className="flex items-center justify-between mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-500" />
            HUMAN RESOURCES MANAGEMENT
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">PERSONNEL PROFILES, TIMESHEETS & DAILY LOGS</p>
        </div>

        {/* Sub-tabs for Director */}
        {role === "director" && (
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveSubTab("profiles")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === "profiles"
                  ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              Profiles
            </button>
            <button
              onClick={() => setActiveSubTab("timesheets")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === "timesheets"
                  ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              Timesheet & Daily Reports
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      {role === "director" && activeSubTab === "timesheets" ? (
        
        /* TIMESHEETS / LOGS SUB-TAB (DIRECTOR ONLY) */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Audit Personnel Timesheets</h3>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold"
                />
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    <th className="pb-3">Personnel</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Clock In</th>
                    <th className="pb-3">Clock Out</th>
                    <th className="pb-3">Total Time</th>
                    <th className="pb-3">Attendance</th>
                    <th className="pb-3 text-right">Daily Work Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {allAttendance.map((att) => {
                    const prof = profiles.find((p) => p.user_id === att.user_id);
                    const report = allReports.find((r) => r.user_id === att.user_id && r.date === att.date);

                    return (
                      <tr key={att.id} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="py-3 flex items-center gap-3">
                          {prof?.avatar_url ? (
                            <img src={prof.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center">
                              <Users className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {prof?.full_name || "Unregistered Employee"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold">
                              {prof?.job_title || "Operative"}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-semibold text-slate-600 dark:text-slate-400">{att.date}</td>
                        <td className="py-3 font-mono text-slate-500">
                          {att.check_in ? new Date(att.check_in).toLocaleTimeString() : "-"}
                        </td>
                        <td className="py-3 font-mono text-slate-500">
                          {att.check_out ? new Date(att.check_out).toLocaleTimeString() : "-"}
                        </td>
                        <td className="py-3 font-bold text-slate-700 dark:text-slate-350">
                          {calculateHours(att.check_in, att.check_out)}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            att.check_out 
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-500" 
                              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
                          }`}>
                            {att.check_out ? "Completed" : "Clocked In"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {report ? (
                            <button
                              onClick={() => setSelectedReportText(report.report_text)}
                              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 rounded-lg text-[10px] font-bold border border-indigo-150 dark:border-indigo-900/50 flex items-center gap-1.5 ml-auto transition-all"
                            >
                              <FileText className="w-3 h-3" /> Read Report
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">No Report Logged</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {allAttendance.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 font-semibold">
                        No timesheet records found for this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      ) : (

        /* STANDARD PROFILES GRID VIEW */
        <>
          {/* Employee Action Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            
            {/* Attendance Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Daily Attendance Portal</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <button
                  onClick={handleCheckIn}
                  disabled={!!attendance?.check_in}
                  className={`flex-1 py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    attendance?.check_in 
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                      : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                  }`}
                >
                  {attendance?.check_in ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {attendance?.check_in ? "Checked In" : "Clock In"}
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={!attendance?.check_in || !!attendance?.check_out}
                  className={`flex-1 py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    !attendance?.check_in || attendance?.check_out
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                  }`}
                >
                  {attendance?.check_out ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {attendance?.check_out ? "Checked Out" : "Clock Out"}
                </button>
              </div>
              <div className="text-xs text-slate-500 font-mono flex justify-between">
                {attendance?.check_in && <span>IN: {new Date(attendance.check_in).toLocaleTimeString()}</span>}
                {attendance?.check_out && <span>OUT: {new Date(attendance.check_out).toLocaleTimeString()}</span>}
              </div>
            </div>

            {/* Daily Report Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Daily Work Summary Report</h3>
              </div>
              <textarea
                value={dailyReport}
                onChange={(e) => setDailyReport(e.target.value)}
                disabled={!!submittedReport}
                placeholder="List completed features, tasks, and roadblocks for remote team transparency..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24 mb-3 disabled:opacity-50"
              />
              <button
                onClick={handleSubmitReport}
                disabled={!!submittedReport || !dailyReport.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm"
              >
                {submittedReport ? <CheckCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                {submittedReport ? "Work Summary Logged" : "Submit Daily Work Report"}
              </button>
            </div>
          </div>

          {/* Directory Grid */}
          <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase mb-4">Company Directory</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {profiles.map(p => (
              <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                {role === 'director' && (
                  <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/50">
                      <Award className="w-3 h-3" />
                      ${Number(p.salary_amount).toLocaleString()} / {p.salary_frequency}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    {p.user_id === currentUserId && (
                      <button 
                        onClick={handleAvatarUpload}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-slate-900 hover:bg-indigo-600 transition-colors"
                        title="Change Photo"
                      >
                        <Upload className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{p.full_name || 'Unregistered Personnel'}</h4>
                    <p className="text-xs font-semibold text-indigo-500">{p.job_title}</p>
                  </div>
                </div>

                <div className="space-y-2 mt-4 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{p.phone_number || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{p.address || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Joined: {new Date(p.joined_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {p.user_id === currentUserId && !p.full_name && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-2 font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Profile incomplete.
                    </p>
                    <button 
                      onClick={() => {
                        const name = prompt("Enter your full name:");
                        const title = prompt("Enter your Job Title:");
                        const phone = prompt("Enter your phone number:");
                        if (name) updateProfile({ full_name: name, job_title: title || 'Operative', phone_number: phone || '' });
                      }}
                      className="w-full py-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-800/85 transition-colors"
                    >
                      Update Profile Details
                    </button>
                  </div>
                )}
              </div>
            ))}
            {profiles.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-500">
                No personnel profiles registered yet.
              </div>
            )}
          </div>
        </>
      )}

      {/* Slide-out Modal for Daily Reports */}
      {selectedReportText && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-lg w-full rounded-2xl p-6 shadow-2xl relative">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" /> Daily Work Log Report
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-350 leading-relaxed font-mono bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto whitespace-pre-line">
              {selectedReportText}
            </p>
            <button
              onClick={() => setSelectedReportText(null)}
              className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-sm"
            >
              Close Log Viewer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
