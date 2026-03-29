import React from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Loader2,
  RadioTower,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface TimelineEvent {
  title: string;
  data: any;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
}

type ToolTheme = {
  key: string;
  label: string;
  icon: React.ReactNode;
  accentClass: string;
  chipClass: string;
};

const defaultTheme: ToolTheme = {
  key: "agent",
  label: "Agent Event",
  icon: <TerminalSquare className="h-4 w-4" />,
  accentClass: "border-white/10 bg-white/5 text-neutral-200",
  chipClass: "bg-white/10 text-neutral-300",
};

function getTheme(event: TimelineEvent): ToolTheme {
  const source = `${event.title} ${event.data?.name || ""}`.toLowerCase();

  if (source.includes("google_search") || source.includes("search") || source.includes("web")) {
    return {
      key: "google_search",
      label: "google_search",
      icon: <RadioTower className="h-4 w-4" />,
      accentClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      chipClass: "bg-cyan-500/20 text-cyan-200",
    };
  }

  if (source.includes("mcp")) {
    return {
      key: "mcp",
      label: "mcp",
      icon: <Cpu className="h-4 w-4" />,
      accentClass: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
      chipClass: "bg-indigo-500/20 text-indigo-200",
    };
  }

  if (
    source.includes("rag") ||
    source.includes("document") ||
    source.includes("retrieval") ||
    source.includes("vector") ||
    source.includes("upload")
  ) {
    return {
      key: "rag",
      label: "rag",
      icon: <Database className="h-4 w-4" />,
      accentClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
      chipClass: "bg-emerald-500/20 text-emerald-200",
    };
  }

  if (source.includes("plan") || source.includes("strategy") || source.includes("agent")) {
    return {
      key: "ai_logic",
      label: "ai_logic",
      icon: <BrainCircuit className="h-4 w-4" />,
      accentClass: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
      chipClass: "bg-indigo-500/20 text-indigo-200",
    };
  }

  if (event.data?.type === "sources") {
    return {
      key: "source_map",
      label: "source_map",
      icon: <Globe className="h-4 w-4" />,
      accentClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
      chipClass: "bg-cyan-500/20 text-cyan-200",
    };
  }

  return defaultTheme;
}

function getStatus(event: TimelineEvent) {
  if (event.data?.type === "functionCall") {
    return {
      label: "LIVE",
      className: "border-cyan-500/40 bg-cyan-500/20 text-cyan-200",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    };
  }
  if (event.data?.type === "functionResponse" || event.data?.type === "sources") {
    return {
      label: "SYNCED",
      className: "border-emerald-500/40 bg-emerald-500/20 text-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  return {
    label: "LOG",
    className: "border-indigo-500/40 bg-indigo-500/20 text-indigo-200",
    icon: <Sparkles className="h-3 w-3" />,
  };
}

function prettyValue(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-2 py-2">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">Tool Activity Stream</p>
        <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/40 to-transparent" />
      </div>

      <div className="relative space-y-3">
        <div className="pointer-events-none absolute left-5 top-3 bottom-3 w-px bg-gradient-to-b from-cyan-500/50 via-indigo-500/30 to-transparent" />
        <AnimatePresence initial={false}>
          {events.map((event, index) => {
            const theme = getTheme(event);
            const status = getStatus(event);
            const args = event.data?.args || {};
            const statusIsLive = status.label === "LIVE";

            return (
              <motion.div
                key={`${event.title}-${index}`}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.24, delay: index * 0.05 }}
                className="relative pl-11"
              >
                <motion.div
                  animate={statusIsLive ? { boxShadow: ["0 0 0px rgba(34,211,238,0.15)", "0 0 14px rgba(34,211,238,0.55)", "0 0 0px rgba(34,211,238,0.15)"] } : {}}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className={`absolute left-[14px] top-6 z-10 h-3 w-3 rounded-full border border-white/20 ${statusIsLive ? "bg-cyan-400" : "bg-emerald-400"}`}
                />

                <div className={`glass-panel rounded-2xl border p-4 ${theme.accentClass}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`rounded-xl p-2 ${theme.chipClass}`}>{theme.icon}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold uppercase tracking-[0.08em]">{event.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${theme.chipClass}`}>
                            {theme.label}
                          </span>
                          <ArrowRight className="h-3 w-3 text-neutral-500" />
                          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${status.className}`}>
                            {status.icon}
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                    </span>
                  </div>

                  {event.data?.content && typeof event.data.content === "string" && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs leading-relaxed text-neutral-200">
                      {event.data.content.length > 280 ? `${event.data.content.slice(0, 280)}...` : event.data.content}
                    </div>
                  )}

                  {Object.keys(args).length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {Object.entries(args).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">{key}</p>
                          <p className="mt-1 truncate text-xs text-neutral-200">{prettyValue(value)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {event.data?.type === "sources" && event.data.content && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {Object.values(event.data.content)
                        .slice(0, 6)
                        .map((source: any, sourceIndex: number) => (
                          <div
                            key={`${source?.url || source?.domain || sourceIndex}`}
                            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="truncate text-xs font-semibold text-cyan-100">{source?.domain || "source"}</p>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                            </div>
                            <p className="mt-1 truncate text-[11px] text-cyan-200/80">{source?.url || "no-url"}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
