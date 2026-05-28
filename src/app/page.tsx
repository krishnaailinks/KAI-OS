"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Building, ShieldCheck, Zap, ArrowRight, ChevronRight, BarChart3, Fingerprint } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate enterprise system boot-up
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleEnterSystem = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500/30 font-sans overflow-x-hidden relative">
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center"
          >
            <div className="relative w-32 h-32 mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 opacity-20"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 rounded-full border-b-2 border-l-2 border-sky-400 opacity-40"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Building className="w-10 h-10 text-white" />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <h2 className="text-2xl font-black tracking-[0.3em] uppercase text-white mb-2">KAI-OS</h2>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-mono tracking-widest">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                INITIALIZING CORE SUBSYSTEMS
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-500/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[30%] h-[30%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 border border-blue-400/20">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-black tracking-widest uppercase text-sm leading-none">KAI-OS</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Krishna AI Links Pvt. Ltd.</div>
            </div>
          </div>
          <button 
            onClick={handleEnterSystem}
            className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold transition-all backdrop-blur-md"
          >
            Access Portal
            <Fingerprint className="w-4 h-4" />
          </button>
        </div>

        <div className="z-10 max-w-5xl mx-auto text-center mt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: loading ? 0 : 1, y: loading ? 30 : 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Enterprise Command Center v2.0
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
              The Ultimate Operating System<br className="hidden md:block" /> for the Modern Enterprise.
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              KAI-OS unifies Project Management, Human Resources, Automated Financial Billing, and Real-Time Communications into a single, impenetrable fortress.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={handleEnterSystem}
                className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-10px_rgba(37,99,235,0.7)] w-full sm:w-auto overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                <Fingerprint className="w-5 h-5" />
                Initialize Session
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Presentation Cards */}
        <div className="w-full max-w-6xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 z-10 px-4 pb-32">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loading ? 0 : 1, y: loading ? 20 : 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm hover:bg-slate-900 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Impenetrable Security</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Zero-trust RBAC architecture, instant WebSocket session lockouts, and immutable audit logs. You have complete control.
            </p>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 group cursor-pointer">
              Explore Architecture <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loading ? 0 : 1, y: loading ? 20 : 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm hover:bg-slate-900 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Automated FMS & HRMS</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              When projects hit completion, invoices are auto-generated. Full employee tracking with daily logs and clock-in systems.
            </p>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1 group cursor-pointer">
              View Analytics <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loading ? 0 : 1, y: loading ? 20 : 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm hover:bg-slate-900 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Real-Time Sync</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Powered by Supabase WebSockets. See tasks move, messages arrive, and video calls connect instantly across the globe.
            </p>
            <div className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1 group cursor-pointer">
              Test Connection <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
