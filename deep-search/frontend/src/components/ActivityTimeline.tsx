import React from "react";
import { Search, Globe, Cpu, CheckCircle, Brain, Layers, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TimelineEvent {
  title: string;
  data: any;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => {
  const getIcon = (title: string, data: any) => {
    const t = title.toLowerCase();
    const d = data.type?.toLowerCase() || "";
    
    if (t.includes("search") || d.includes("google_search")) return <Search className="w-4 h-4 text-blue-400" />;
    if (t.includes("scrape") || d.includes("web_scrape")) return <Globe className="w-4 h-4 text-emerald-400" />;
    if (t.includes("document") || d.includes("search_uploaded_docs")) return <Database className="w-4 h-4 text-purple-400" />;
    if (t.includes("mcp") || d.includes("mcp_query")) return <Cpu className="w-4 h-4 text-orange-400" />;
    if (t.includes("plan") || t.includes("strategy")) return <Layers className="w-4 h-4 text-indigo-400" />;
    if (t.includes("evaluat") || t.includes("quality")) return <Brain className="w-4 h-4 text-pink-400" />;
    
    return <CheckCircle className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="space-y-4 px-2 w-full max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 bg-neutral-900/50 px-3 py-1 rounded-full border border-neutral-800">
          Agent Execution Logs
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-neutral-800 to-transparent"></div>
      </div>
      
      <div className="space-y-3 relative pl-4 border-l border-neutral-800/50">
        <AnimatePresence initial={false}>
          {events.map((event, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="relative group"
            >
              <div className="absolute -left-[21px] top-4 w-2 h-2 rounded-full bg-neutral-700 border-2 border-neutral-950 group-hover:bg-blue-500 transition-colors"></div>
              
              <div className="bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/60 rounded-xl p-4 hover:border-neutral-700 transition-all shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/30">
                    {getIcon(event.title, event.data)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-neutral-200 truncate">{event.title}</h4>
                    {event.data.content && typeof event.data.content === 'string' && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-1 italic font-medium">
                        {event.data.content.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>
                
                {event.data.type === 'sources' && event.data.content && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.values(event.data.content).slice(0, 3).map((source: any, i: number) => (
                      <div key={i} className="text-[10px] px-2 py-0.5 bg-blue-600/5 border border-blue-500/20 text-blue-400 rounded-md font-bold">
                        {source.domain || 'Source'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
