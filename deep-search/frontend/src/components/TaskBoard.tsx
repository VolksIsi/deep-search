import React from "react";
import { CheckCircle2, Circle, PlayCircle, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

export interface Task {
  id: string;
  title: string;
  status: "pending" | "running" | "completed";
}

export const TaskBoard: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="glass-panel border-white/5 rounded-2xl p-6 my-6 bg-neutral-900/40 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors duration-700" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner">
          <ClipboardList className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Research Strategy</h3>
          <p className="text-[10px] text-neutral-400 uppercase tracking-[0.2em] font-bold">Autonomous Execution Roadmap</p>
        </div>
      </div>

      <div className="space-y-2.5 relative z-10">
        {tasks.map((task, idx) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all duration-500 ${
              task.status === "running"
                ? "bg-blue-500/[0.08] border-blue-500/40 shadow-[0_0_25px_-10px_rgba(59,130,246,0.4)]"
                : task.status === "completed"
                ? "bg-emerald-500/[0.03] border-emerald-500/10"
                : "bg-white/[0.02] border-white/5 hover:border-white/10"
            }`}
          >
            <div className="flex-shrink-0">
              {task.status === "completed" ? (
                <div className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              ) : task.status === "running" ? (
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/40 blur-md rounded-full animate-pulse" />
                  <PlayCircle className="h-5 w-5 text-blue-400 relative z-10" />
                </div>
              ) : (
                <Circle className="h-5 w-5 text-neutral-700 transiton-colors duration-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm tracking-tight ${
                  task.status === "completed" 
                    ? "text-neutral-500 line-through decoration-emerald-500/20 font-medium" 
                    : task.status === "running"
                    ? "text-blue-100 font-semibold"
                    : "text-neutral-300 font-medium"
                }`}
              >
                {task.title}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
