"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Unauthenticated access attempt - redirect to login
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

    // Listen for auth state changes (e.g., if user logs out from another tab)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push("/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-blue-900/30 border border-blue-500/50 rounded-2xl flex items-center justify-center mb-6 relative">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
            <div className="absolute inset-0 border-2 border-blue-500 rounded-2xl animate-ping opacity-20"></div>
          </div>
          <h2 className="text-xl font-bold tracking-widest uppercase text-slate-300">Verifying Security Clearance</h2>
          <p className="text-slate-500 text-sm mt-2 font-mono">Ensuring secure connection...</p>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
