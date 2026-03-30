import React from "react";
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Database,
  FileText,
  FolderUp,
  History,
  Mic,
  MicOff,
  RadioTower,
  Settings2,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type SidebarTab = "config" | "intel" | "library" | "schedule";

interface SidebarProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onFileUpload: (files: FileList) => void;
  uploadedFiles: string[];
  isListening: boolean;
  onVoiceToggle: () => void;
  isSpeaking: boolean;
  onSpeakToggle: () => void;
  canSpeak: boolean;
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  websiteCount: number;
  aiMessageCount: number;
  toolRuns: number;
  competitors: any[];
  alerts: any[];
  pastReports: any[];
  onReportSelect: (id: number) => void;
  scheduledTasks: any[];
  isOpen: boolean;
  onClose: () => void;
}

interface PanelItem {
  title: string;
  subtitle: string;
}

const models = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", hint: "Speed Layer" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", hint: "Reasoning Layer" },
  { id: "gpt-4o", name: "GPT-4o", hint: "Omni Layer" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", hint: "Writing Layer" },
];

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "config", label: "Config", icon: <Settings2 className="h-4 w-4" /> },
  { id: "intel", label: "Intel", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "library", label: "Library", icon: <History className="h-4 w-4" /> },
  { id: "schedule", label: "Schedule", icon: <CalendarClock className="h-4 w-4" /> },
];

function toPanelItems(items: any[], fallbackTitle: string, fallbackSubtitle: string): PanelItem[] {
  return items.slice(0, 6).map((entry, idx) => {
    if (typeof entry === "string") {
      return { title: entry, subtitle: fallbackSubtitle };
    }
    const title =
      entry?.title ||
      entry?.name ||
      entry?.query ||
      entry?.task ||
      entry?.summary ||
      entry?.id ||
      `${fallbackTitle} ${idx + 1}`;
    const subtitle =
      entry?.status ||
      entry?.severity ||
      entry?.created_at ||
      entry?.updated_at ||
      fallbackSubtitle;
    return { title: String(title), subtitle: String(subtitle) };
  });
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="glass-panel rounded-2xl border-white/5 px-4 py-5 text-center text-xs text-neutral-500">
      {text}
    </div>
  );
}

function ListBlock({ items, onSelect }: { items: (PanelItem & { id?: any })[]; onSelect?: (id: any) => void }) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <motion.div
          key={`${item.title}-${index}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.2 }}
          onClick={() => item.id != null && onSelect?.(item.id)}
          className={`glass-panel rounded-2xl border-white/5 px-4 py-3 transition-all ${item.id != null ? 'cursor-pointer hover:border-cyan-500/40 hover:bg-white/5 active:scale-[0.98]' : ''}`}
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-100">{item.title}</p>
              <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-neutral-500">{item.subtitle}</p>
            </div>
            {item.id != null && <History className="h-3.5 w-3.5 text-neutral-600" />}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedModel,
  setSelectedModel,
  onFileUpload,
  uploadedFiles,
  isListening,
  onVoiceToggle,
  isSpeaking,
  onSpeakToggle,
  canSpeak,
  sidebarTab,
  setSidebarTab,
  websiteCount,
  aiMessageCount,
  toolRuns,
  competitors,
  alerts,
  pastReports,
  onReportSelect,
  scheduledTasks,
  isOpen,
  onClose,
}) => {
  const intelCards = toPanelItems(
    [...alerts, ...competitors],
    "Intel Feed",
    "Incoming signal",
  );
  const scheduleCards = toPanelItems(scheduledTasks, "Task", "Queued");

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[20rem] shrink-0 flex-col overflow-hidden border-r border-white/5 premium-gradient transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.08]" />
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative border-b border-white/5 p-5">
        <div className="glass-panel neon-glow-emerald rounded-3xl border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-emerald-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-[0.18em] text-white">Deep Search</h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">Research Command</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-2 py-2">
              <p className="text-sm font-black text-cyan-300">{websiteCount}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-200/70">Data</p>
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-2 py-2">
              <p className="text-sm font-black text-indigo-300">{aiMessageCount}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-indigo-200/70">AI</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-2">
              <p className="text-sm font-black text-emerald-300">{toolRuns}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-200/70">Tools</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400 hover:text-white lg:hidden"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative border-b border-white/5 px-3 py-3">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id)}
              className={`relative flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition ${
                sidebarTab === tab.id
                  ? "bg-white/10 text-cyan-300"
                  : "bg-white/0 text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              {tab.icon}
              <span className="hidden xl:inline">{tab.label}</span>
              {sidebarTab === tab.id && (
                <motion.div
                  layoutId="tab-highlight"
                  className="absolute inset-0 rounded-xl border border-cyan-500/40"
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={sidebarTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {sidebarTab === "config" && (
              <>
                <section className="glass-panel rounded-2xl border-white/5 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Model Stack</p>
                  <div className="space-y-2">
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                          selectedModel === model.id
                            ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-100"
                            : "border-white/5 bg-black/30 text-neutral-300 hover:border-white/15"
                        }`}
                      >
                        <BrainCircuit className="h-4 w-4 shrink-0 text-indigo-300" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{model.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">{model.hint}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="glass-panel rounded-2xl border-white/5 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">RAG Ingestion</p>
                  <label
                    className="relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 px-4 py-6 text-center transition hover:border-cyan-400/60 hover:bg-cyan-500/10"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (event.dataTransfer.files) onFileUpload(event.dataTransfer.files);
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.md,.json"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(event) => event.target.files && onFileUpload(event.target.files)}
                    />
                    <FolderUp className="h-6 w-6 text-cyan-300" />
                    <p className="text-xs font-semibold text-cyan-100">Upload research docs and internal notes</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">PDF, DOCX, TXT, MD, JSON</p>
                  </label>
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedFiles.slice(-5).map((file, index) => (
                        <div
                          key={`${file}-${index}`}
                          className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                          <span className="truncate text-xs text-neutral-300">{file}</span>
                          <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="glass-panel rounded-2xl border-white/5 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Voice Controls</p>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={onVoiceToggle}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                        isListening
                          ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                          : "border-white/10 bg-black/30 text-neutral-300 hover:border-cyan-500/40"
                      }`}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isListening ? "Stop Mic" : "Start Mic"}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={onSpeakToggle}
                      disabled={!canSpeak}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                        isSpeaking
                          ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
                          : "border-white/10 bg-black/30 text-neutral-300 hover:border-indigo-500/40"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      {isSpeaking ? "Stop Voice" : "Read Report"}
                    </motion.button>
                  </div>
                </section>

                <section className="glass-panel rounded-2xl border-white/5 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Tool Fabric</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100">
                        <RadioTower className="h-4 w-4" />
                        google_search
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">
                        {websiteCount > 0 ? "Live" : "Standby"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100">
                        <BrainCircuit className="h-4 w-4" />
                        mcp
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-200/70">
                        {toolRuns > 0 ? "Connected" : "Idle"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100">
                        <Database className="h-4 w-4" />
                        rag
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
                        {uploadedFiles.length > 0 ? "Indexed" : "Waiting"}
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )}

            {sidebarTab === "intel" && (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Signals & Alerts</p>
                {intelCards.length ? <ListBlock items={intelCards} /> : <EmptyBlock text="No live intel yet. Start a research run to populate this channel." />}
              </>
            )}

            {sidebarTab === "library" && (
              <>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Research Library</p>
                {pastReports.length ? (
                  <ListBlock 
                    items={pastReports.map(r => ({ ...r, title: r.topic, subtitle: r.created_at, id: r.id }))} 
                    onSelect={onReportSelect} 
                  />
                ) : (
                  <EmptyBlock text="No reports in library yet. Generated reports are saved automatically." />
                )}
              </>
            )}

            {sidebarTab === "schedule" && (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Automation Queue</p>
                {scheduleCards.length ? <ListBlock items={scheduleCards} /> : <EmptyBlock text="No scheduled tasks available." />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
    </>
  );
};
