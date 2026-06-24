"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, KeyRound, ArrowRight, Mail, AlertTriangle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<"employee" | "director">("employee");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  
  const [toast, setToast] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length > 8) score += 25;
    if (pass.match(/[A-Z]/)) score += 25;
    if (pass.match(/[0-9]/)) score += 25;
    if (pass.match(/[^A-Za-z0-9]/)) score += 25;
    return score;
  };

  const strength = calculatePasswordStrength(password);
  
  const getStrengthColor = () => {
    if (strength <= 25) return "bg-red-500";
    if (strength <= 50) return "bg-orange-500";
    if (strength <= 75) return "bg-amber-400";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (strength === 0) return "None";
    if (strength <= 25) return "Weak";
    if (strength <= 50) return "Fair";
    if (strength <= 75) return "Good";
    return "Strong";
  };

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict Validation
    if (!name.trim() || !email.trim() || !password.trim()) {
      showToast("All fields are required.", "error");
      return;
    }

    if (strength < 50) {
      showToast("Password is too weak. Please use a stronger password.", "error");
      return;
    }

    if (accountType === "director" && !accessCode.trim()) {
      showToast("Director access code is required.", "error");
      return;
    }

    setLoading(true);
    
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          accountType,
          accessCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Registration failed." }));
        throw new Error(data.error || "Registration failed.");
      }

      showToast(`Successfully registered as ${accountType.toUpperCase()}. Routing to login...`, "success");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Registration failed.", "error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-50 font-bold text-sm ${
              toast.type === "error" 
                ? "bg-red-100 dark:bg-red-900/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800" 
                : "bg-green-100 dark:bg-green-900/80 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
            }`}
          >
            {toast.type === "error" ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center px-4">
              <img src="/logo-horizontal.png" alt="KAI-OS" className="w-full max-w-[300px] h-auto object-contain" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Clearance Registration Portal</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => setAccountType("employee")}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  accountType === "employee" 
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Employee
              </button>
              <button
                type="button"
                onClick={() => setAccountType("director")}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  accountType === "director" 
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Director
              </button>
            </div>
            
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Corporate Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="user@krishna-ai.com"
                  />
                </div>
              </div>

              <AnimatePresence>
                {accountType === "director" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-2">Director Access Code</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-amber-500" />
                      </div>
                      <input
                        type="password"
                        required={accountType === "director"}
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-amber-300 dark:border-amber-800/50 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all sm:text-sm"
                        placeholder="Secret Key"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Set Password</label>
                <div className="relative mb-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
                
                {/* Password Strength Meter */}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  <span>Password Strength</span>
                  <span className={strength === 100 ? "text-green-500" : strength >= 75 ? "text-amber-500" : ""}>{getStrengthLabel()}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                    style={{ width: `${Math.max(strength, 5)}%` }}
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying..." : "Submit Registration"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-950/50 px-8 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Already cleared?{" "}
              <button onClick={() => router.push("/login")} className="font-semibold text-sky-600 hover:text-sky-500 transition-colors">
                Login Here
              </button>
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
          &copy; {new Date().getFullYear()} Krishna AI Links Pvt. Ltd.
        </div>
      </div>
    </div>
  );
}
