"use client"
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export function Hero() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setLocation("/dashboard");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-4 max-w-2xl"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900">
          Eat better, <span className="text-primary">spend less.</span>
        </h1>
        <p className="text-lg text-slate-500 font-medium max-w-lg mx-auto">
          Your personal AI food agent. Finds recipes, compares prices, and plans your week in seconds.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-xl relative group"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-cyan-400/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition duration-500" />
        <div className="relative relative flex items-center bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden border border-slate-100 group-focus-within:border-primary/50 group-focus-within:ring-4 group-focus-within:ring-primary/10 transition-all duration-300">
          <div className="pl-6 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to eat this week?"
            className="w-full py-5 px-4 text-lg text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          <button 
            onClick={() => setLocation("/dashboard")}
            className="mr-2 p-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
