import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, Sparkles, Globe, Mic, MicOff, Plus, Brain, Download, Calendar,
  Shield, BarChart3, FileText, Bell, Settings, ChevronRight, History, 
  Zap, Target, TrendingUp, Volume2, VolumeX, Loader2
} from "lucide-react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// === TYPES ===
interface Message {
  type: "human" | "ai";
  content: string;
  id: string;
  agent?: string;
  finalReportWithCitations?: boolean;
}
interface ProcessedEvent { title: string; data: any; }

// === VOICE HOOK ===
function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };
    
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening, setTranscript };
}

// === TTS HOOK ===
function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_\[\]()]/g, '').substring(0, 5000));
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
}

export default function App() {
  // Core state
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appName, setAppName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setDisplayData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageEvents, setMessageEvents] = useState<Map<string, ProcessedEvent[]>>(new Map());
  const [websiteCount, setWebsiteCount] = useState(0);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);

  // Enhanced state
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"config" | "intel" | "history" | "schedule">("config");
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);

  // Load sidebar data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [reportsRes, alertsRes, tasksRes, compRes] = await Promise.allSettled([
          fetch('/api/memory/reports').then(r => r.json()),
          fetch('/api/intel/alerts').then(r => r.json()),
          fetch('/api/scheduler/tasks').then(r => r.json()),
          fetch('/api/intel/dashboard').then(r => r.json()),
        ]);
        if (reportsRes.status === 'fulfilled') setPastReports(reportsRes.value.reports || []);
        if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.alerts || []);
        if (tasksRes.status === 'fulfilled') setScheduledTasks(tasksRes.value.tasks || []);
        if (compRes.status === 'fulfilled') setCompetitors(compRes.value.competitors || []);
      } catch { /* Backend may not be ready yet */ }
    };
    loadData();
  }, []);

  const currentAgentRef = useRef('');
  const accumulatedTextRef = useRef("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Voice
  const { isListening, transcript, startListening, stopListening, setTranscript } = useVoiceInput();
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechOutput();

  // Retry helper
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 10, maxDuration = 120000): Promise<any> => {
    const startTime = Date.now();
    let lastError: Error;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (Date.now() - startTime > maxDuration) throw new Error(`Timeout`);
      try { return await fn(); } catch (error) {
        lastError = error as Error;
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 5000)));
      }
    }
    throw lastError!;
  };

  const createSession = async () => {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await fetch(`/api/apps/app/users/u_999/sessions/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Session failed: ${res.status}`);
    const data = await res.json();
    return { userId: data.userId, sessionId: data.id, appName: data.appName };
  };

  const checkBackendHealth = async () => {
    try {
      const r = await fetch("/api/docs", { method: "GET" });
      return r.ok;
    } catch { return false; }
  };

  // SSE processing
  const extractData = (data: string) => {
    try {
      const p = JSON.parse(data);
      return {
        textParts: p.content?.parts?.filter((x: any) => x.text).map((x: any) => x.text) || [],
        agent: p.author || '',
        finalReportWithCitations: p.actions?.stateDelta?.final_report_with_citations,
        functionCall: p.content?.parts?.find((x: any) => x.functionCall)?.functionCall,
        functionResponse: p.content?.parts?.find((x: any) => x.functionResponse)?.functionResponse,
        sourceCount: p.actions?.stateDelta?.url_to_short_id ? Object.keys(p.actions.stateDelta.url_to_short_id).length : 0,
        sources: p.actions?.stateDelta?.sources,
      };
    } catch { return { textParts: [], agent: '', finalReportWithCitations: undefined, functionCall: null, functionResponse: null, sourceCount: 0, sources: null }; }
  };

  const agentTitles: Record<string, string> = {
    "plan_generator": "📋 Planning Strategy",
    "section_planner": "📐 Structuring Report",
    "section_researcher": "🔍 Deep Web Research",
    "research_evaluator": "🎯 Quality Assessment",
    "EscalationChecker": "✅ Quality Gate",
    "enhanced_search_executor": "🚀 Enhanced Research",
    "report_composer_with_citations": "📝 Composing Report",
  };

  const processSSE = (jsonData: string, aiMsgId: string) => {
    const { textParts, agent, finalReportWithCitations, functionCall, functionResponse, sourceCount, sources } = extractData(jsonData);
    if (sourceCount > 0) setWebsiteCount(p => Math.max(p, sourceCount));
    if (agent) currentAgentRef.current = agent;

    if (functionCall) {
      setMessageEvents(p => new Map(p).set(aiMsgId, [...(p.get(aiMsgId) || []), {
        title: `🔧 Tool: ${functionCall.name}`, data: { type: 'functionCall', ...functionCall }
      }]));
    }
    if (functionResponse) {
      setMessageEvents(p => new Map(p).set(aiMsgId, [...(p.get(aiMsgId) || []), {
        title: `📦 Result: ${functionResponse.name}`, data: { type: 'functionResponse', ...functionResponse }
      }]));
    }
    if (textParts.length > 0 && agent !== "report_composer_with_citations") {
      if (agent !== "interactive_planner_agent") {
        setMessageEvents(p => new Map(p).set(aiMsgId, [...(p.get(aiMsgId) || []), {
          title: agentTitles[agent] || `⚙️ ${agent}`, data: { type: 'text', content: textParts.join(" ") }
        }]));
      } else {
        for (const text of textParts) {
          accumulatedTextRef.current += text;
          setMessages(p => p.map(m => m.id === aiMsgId ? { ...m, content: accumulatedTextRef.current.trim(), agent: currentAgentRef.current } : m));
          setDisplayData(accumulatedTextRef.current.trim());
        }
      }
    }
    if (sources) {
      setMessageEvents(p => new Map(p).set(aiMsgId, [...(p.get(aiMsgId) || []), {
        title: "🌐 Sources Retrieved", data: { type: 'sources', content: sources }
      }]));
    }
    if (agent === "report_composer_with_citations" && finalReportWithCitations) {
      const fid = `${Date.now()}_final`;
      setMessages(p => [...p, { type: "ai", content: finalReportWithCitations, id: fid, agent: "report_composer", finalReportWithCitations: true }]);
      setDisplayData(finalReportWithCitations);
    }
  };

  // Submit handler
  const handleSubmit = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      let u = userId, s = sessionId, a = appName;
      if (!s) {
        const sd = await retryWithBackoff(createSession);
        u = sd.userId; s = sd.sessionId; a = sd.appName;
        setUserId(u); setSessionId(s); setAppName(a);
      }
      setMessages(p => [...p, { type: "human", content: query, id: `${Date.now()}` }]);
      const aiId = `${Date.now()}_ai`;
      currentAgentRef.current = ''; accumulatedTextRef.current = '';
      setMessages(p => [...p, { type: "ai", content: "", id: aiId, agent: '' }]);

      const res = await retryWithBackoff(() => fetch("/api/run_sse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: a, userId: u, sessionId: s, newMessage: { parts: [{ text: query }], role: "user" }, streaming: true, model: selectedModel }),
      }));

      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let buf = "", evtBuf = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (value) buf += dec.decode(value, { stream: true });
          let eol;
          while ((eol = buf.indexOf('\n')) >= 0) {
            const line = buf.substring(0, eol); buf = buf.substring(eol + 1);
            if (line.trim() === "") { if (evtBuf) { processSSE(evtBuf.trim(), aiId); evtBuf = ""; } }
            else if (line.startsWith('data:')) evtBuf += line.substring(5) + '\n';
          }
          if (done) break;
        }
      }
    } catch (e) {
      setMessages(p => [...p, { type: "ai", content: `❌ Error: ${e}`, id: `${Date.now()}_err` }]);
    } finally { setIsLoading(false); }
  }, [userId, sessionId, appName, selectedModel]);

  // Export handlers
  const handleExportPDF = async () => {
    const report = messages.find(m => m.finalReportWithCitations);
    if (!report) return;
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: report.content, title: "Research Report" })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'research_report.pdf'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error("PDF export failed:", e); }
  };

  const handleExportDocx = async () => {
    const report = messages.find(m => m.finalReportWithCitations);
    if (!report) return;
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: report.content, title: "Research Report" })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'research_report.docx'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error("DOCX export failed:", e); }
  };

  // File upload
  const handleFileUpload = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    setUploadedFiles(p => [...p, ...Array.from(files).map(f => f.name)]);
    try {
      await fetch("/api/upload", { method: "POST", body: formData });
    } catch (e) { console.error("Upload failed:", e); }
  };

  // Health check
  useEffect(() => {
    (async () => {
      for (let i = 0; i < 60; i++) {
        if (await checkBackendHealth()) { setIsCheckingBackend(false); return; }
        await new Promise(r => setTimeout(r, 2000));
      }
      setIsCheckingBackend(false);
    })();
  }, []);

  // Voice transcript sync
  useEffect(() => {
    if (transcript && !isListening) {
      handleSubmit(transcript);
      setTranscript("");
    }
  }, [isListening]);

  // === RENDER ===
  if (isCheckingBackend) return (
    <div className="h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-3 border-4 border-purple-600 border-b-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
        </div>
        <div>
          <p className="text-white font-bold text-lg">Initializing Allmighty Engine</p>
          <p className="text-neutral-500 text-sm mt-1">Connecting to research infrastructure...</p>
        </div>
      </div>
    </div>
  );

  const hasReport = messages.some(m => m.finalReportWithCitations);

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans antialiased overflow-hidden">
      {/* === SIDEBAR === */}
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col overflow-hidden shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider text-white">ALLMIGHTY</h1>
              <p className="text-[10px] text-neutral-500 font-bold tracking-widest">DEEP SEARCH ENGINE</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800">
          {([
            ["config", <Settings className="w-3.5 h-3.5" />],
            ["intel", <Shield className="w-3.5 h-3.5" />],
            ["history", <History className="w-3.5 h-3.5" />],
            ["schedule", <Calendar className="w-3.5 h-3.5" />],
          ] as [string, React.ReactNode][]).map(([tab, icon]) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab as any)}
              className={`flex-1 py-3 flex justify-center transition-all ${
                sidebarTab === tab ? "text-blue-400 border-b-2 border-blue-400 bg-blue-600/5" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >{icon}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sidebarTab === "config" && (
            <>
              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">AI Model</label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash</option>
                  <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro</option>
                  <option value="gpt-4o">🤖 GPT-4o</option>
                  <option value="claude-3-5-sonnet">🎭 Claude 3.5 Sonnet</option>
                </select>
              </div>

              {/* Document Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">RAG Documents</label>
                <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-neutral-700 rounded-xl hover:border-blue-500 transition-colors cursor-pointer bg-neutral-800/30">
                  <Plus className="w-6 h-6 text-neutral-500" />
                  <span className="text-xs text-neutral-400 font-medium">Drop files or click</span>
                  <input type="file" className="hidden" multiple accept=".pdf,.docx,.txt,.md,.json"
                    onChange={e => e.target.files && handleFileUpload(e.target.files)} />
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 bg-neutral-800 rounded-lg text-[11px] text-neutral-400">
                        <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Export */}
              {hasReport && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Export Report</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 bg-red-600/10 border border-red-600/20 rounded-xl text-red-400 text-xs font-bold hover:bg-red-600/20 transition-all">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={handleExportDocx} className="flex items-center gap-2 px-3 py-2 bg-blue-600/10 border border-blue-600/20 rounded-xl text-blue-400 text-xs font-bold hover:bg-blue-600/20 transition-all">
                      <Download className="w-3.5 h-3.5" /> DOCX
                    </button>
                  </div>
                </div>
              )}

              {/* Voice Controls */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Voice Controls</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isListening ? "bg-red-600 text-white animate-pulse" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isListening ? "Stop" : "Voice"}
                  </button>
                  <button
                    onClick={() => {
                      if (isSpeaking) stopSpeaking();
                      else {
                        const report = messages.find(m => m.finalReportWithCitations);
                        if (report) speak(report.content);
                      }
                    }}
                    disabled={!hasReport}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSpeaking ? "bg-purple-600 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 disabled:opacity-30"
                    }`}
                  >
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    {isSpeaking ? "Stop" : "Read"}
                  </button>
                </div>
              </div>
            </>
          )}

          {sidebarTab === "intel" && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-center">
                <Target className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white mb-1">Competitive Intel</h3>
                <p className="text-[11px] text-neutral-500">Monitor competitors daily. Add companies to track their moves automatically.</p>
                <button className="mt-3 w-full py-2 bg-orange-600/10 border border-orange-600/20 text-orange-400 rounded-lg text-xs font-bold hover:bg-orange-600/20 transition-all">
                  + Add Competitor
                </button>
              </div>
              {competitors.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tracking</label>
                  {competitors.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-neutral-800/30 border border-neutral-700 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${c.active ? 'bg-green-500' : 'bg-neutral-600'}`}></div>
                      <span className="text-xs text-neutral-300 font-medium">{c.company}</span>
                    </div>
                  ))}
                </div>
              )}
              {alerts.length > 0 ? (
                alerts.map((a, i) => (
                  <div key={i} className="p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] text-orange-400 font-bold">{a.company}</span>
                    </div>
                    <p className="text-xs text-neutral-300">{a.title}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-600 text-center py-4">No alerts yet</p>
              )}
            </div>
          )}

          {sidebarTab === "history" && (
            <div className="space-y-3">
              <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-center">
                <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white mb-1">Session Memory</h3>
                <p className="text-[11px] text-neutral-500">Your research persists across sessions. The agent remembers past findings.</p>
              </div>
              {pastReports.length > 0 ? (
                pastReports.map((r, i) => (
                  <div key={i} className="p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg hover:border-neutral-600 cursor-pointer transition-all">
                    <p className="text-xs font-bold text-neutral-300 truncate">{r.topic}</p>
                    <p className="text-[10px] text-neutral-600 mt-1">{r.created_at}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-600 text-center py-4">Reports will appear here</p>
              )}
            </div>
          )}

          {sidebarTab === "schedule" && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-center">
                <Calendar className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white mb-1">Auto Reports</h3>
                <p className="text-[11px] text-neutral-500">Schedule automated research reports. Set frequency and topics.</p>
                <button className="mt-3 w-full py-2 bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-600/20 transition-all">
                  + Schedule Report
                </button>
              </div>
              {scheduledTasks.map((t, i) => (
                <div key={i} className="p-3 bg-neutral-800/30 border border-neutral-700 rounded-lg">
                  <p className="text-xs font-bold text-neutral-300">{t.query}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">{t.cron}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/80">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-lg font-black text-blue-400">{websiteCount}</p>
              <p className="text-[8px] text-neutral-600 font-bold uppercase">Sources</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-purple-400">{messages.filter(m => m.type === 'ai').length}</p>
              <p className="text-[8px] text-neutral-600 font-bold uppercase">Responses</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-emerald-400">{messageEvents.size}</p>
              <p className="text-[8px] text-neutral-600 font-bold uppercase">Actions</p>
            </div>
          </div>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {messages.length === 0 ? (
          <WelcomeView 
            onSubmit={handleSubmit} 
            isLoading={isLoading} 
            isListening={isListening}
            transcript={transcript}
            onVoiceToggle={isListening ? stopListening : startListening}
            selectedModel={selectedModel}
          />
        ) : (
          <ResearchView
            messages={messages}
            isLoading={isLoading}
            scrollAreaRef={scrollAreaRef}
            messageEvents={messageEvents}
            websiteCount={websiteCount}
            hasReport={hasReport}
            onExportPDF={handleExportPDF}
            onExportDocx={handleExportDocx}
            isSpeaking={isSpeaking}
            onSpeak={() => { const r = messages.find(m => m.finalReportWithCitations); if (r) speak(r.content); }}
            onStopSpeak={stopSpeaking}
          />
        )}
      </main>
    </div>
  );
}

// === WELCOME VIEW ===
function WelcomeView({ onSubmit, isLoading, isListening, transcript, onVoiceToggle, selectedModel }: {
  onSubmit: (q: string) => void; isLoading: boolean; isListening: boolean;
  transcript: string; onVoiceToggle: () => void; selectedModel: string;
}) {
  const [query, setQuery] = useState(transcript || "");

  useEffect(() => { if (transcript) setQuery(transcript); }, [transcript]);

  const suggestions = [
    { text: "What is the future of humanoid robotics in 2026?", icon: <TrendingUp className="w-4 h-4" /> },
    { text: "Analyze quantum computing's impact on cybersecurity", icon: <Shield className="w-4 h-4" /> },
    { text: "Comprehensive report on sodium-ion battery technology", icon: <BarChart3 className="w-4 h-4" /> },
    { text: "Role of AI agents in clinical drug discovery", icon: <Brain className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-neutral-950">
      <div className="absolute inset-0 pointer-events-none overflow-hidden blur-[120px] opacity-15">
        <div className="absolute top-1/2 left-1/4 w-[50%] h-[50%] bg-blue-600 rounded-full animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[40%] h-[40%] bg-indigo-800 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/4 right-1/2 w-[30%] h-[30%] bg-purple-700 rounded-full animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="w-full max-w-4xl space-y-14 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase">PARALLEL MULTI-AGENT • RAG • MCP • VOICE</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.1]">
            Allmighty<br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Deep Research</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Autonomous multi-agent research with parallel workers, persistent memory, competitive intelligence, and real-time voice interaction.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-35 transition-opacity"></div>
          <form onSubmit={e => { e.preventDefault(); if (query.trim()) onSubmit(query); }}
            className="relative bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden focus-within:border-neutral-700 transition-all">
            <div className="p-4 flex items-start gap-4">
              <div className="p-3 bg-neutral-800 rounded-2xl hidden sm:block">
                <Search className="w-6 h-6 text-neutral-400" />
              </div>
              <textarea value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Ask anything — I'll research it deeply with parallel agents..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-xl text-white py-2 resize-none h-28 placeholder-neutral-600 outline-none"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (query.trim()) onSubmit(query); } }}
              />
            </div>
            <div className="px-4 py-3 bg-neutral-900/50 border-t border-neutral-800/50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={onVoiceToggle}
                  className={`p-2 rounded-lg transition-all ${isListening ? "bg-red-600 text-white animate-pulse" : "hover:bg-neutral-800 text-neutral-500"}`}>
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <div className="h-6 w-px bg-neutral-800"></div>
                <div className="px-2 py-1 bg-blue-600/10 border border-blue-500/20 rounded-md text-[10px] font-bold text-blue-400">
                  {selectedModel.toUpperCase()}
                </div>
              </div>
              <button type="submit" disabled={isLoading || !query.trim()}
                className={`flex items-center gap-2 px-7 py-2.5 rounded-xl font-bold transition-all ${
                  query.trim() ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20" : "bg-neutral-800 text-neutral-600"
                }`}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Research</span><Sparkles className="w-4 h-4" /></>}
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setQuery(s.text)}
              className="px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 hover:bg-neutral-800/50 transition-all text-left group flex items-start gap-3">
              <div className="p-2 bg-neutral-800 rounded-lg text-neutral-500 group-hover:text-blue-400 transition-colors shrink-0">{s.icon}</div>
              <div>
                <p className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">{s.text}</p>
                <div className="mt-1.5 text-[10px] font-bold text-neutral-600 uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore <ChevronRight className="w-2.5 h-2.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// === RESEARCH VIEW ===

function ResearchView({ messages, isLoading, scrollAreaRef, messageEvents, websiteCount, hasReport, onExportPDF, onExportDocx, isSpeaking, onSpeak, onStopSpeak }: {
  messages: Message[]; isLoading: boolean; scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  messageEvents: Map<string, any[]>; websiteCount: number;
  hasReport: boolean; onExportPDF: () => void; onExportDocx: () => void;
  isSpeaking: boolean; onSpeak: () => void; onStopSpeak: () => void;
}) {
  useEffect(() => {
    if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <header className="px-6 py-3 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center border-2 border-neutral-900"><Globe className="w-3.5 h-3.5 text-white" /></div>
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center border-2 border-neutral-900"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center border-2 border-neutral-900"><Brain className="w-3.5 h-3.5 text-white" /></div>
          </div>
          <div>
            <h2 className="text-xs font-black text-white tracking-wider uppercase">Multi-Agent Research</h2>
            <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 font-bold tracking-wider">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              {isLoading ? 'AGENTS WORKING' : 'COMPLETE'} • {websiteCount} SOURCES
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasReport && (
            <>
              <button onClick={onExportPDF} className="px-3 py-1.5 bg-red-600/10 border border-red-600/20 text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-600/20 transition-all flex items-center gap-1.5">
                <Download className="w-3 h-3" /> PDF
              </button>
              <button onClick={onExportDocx} className="px-3 py-1.5 bg-blue-600/10 border border-blue-600/20 text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-600/20 transition-all flex items-center gap-1.5">
                <Download className="w-3 h-3" /> DOCX
              </button>
              <button onClick={isSpeaking ? onStopSpeak : onSpeak}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                  isSpeaking ? "bg-purple-600 text-white" : "bg-purple-600/10 border border-purple-600/20 text-purple-400 hover:bg-purple-600/20"
                }`}>
                {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />} {isSpeaking ? "Stop" : "Read"}
              </button>
            </>
          )}
          <button onClick={() => window.location.reload()} className="px-3 py-1.5 bg-neutral-800 text-neutral-400 rounded-lg text-[10px] font-bold hover:bg-neutral-700 transition-all">
            New
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-10">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.type === "human" ? "items-end" : "items-start"}`}>
            {msg.type === "human" ? (
              <div className="max-w-2xl bg-neutral-800/80 border border-neutral-700/50 rounded-2xl px-5 py-4 text-neutral-200 text-lg font-medium">{msg.content}</div>
            ) : (
              <div className="w-full space-y-6">
                {messageEvents.get(msg.id) && messageEvents.get(msg.id)!.length > 0 && (
                  <ActivityTimeline events={messageEvents.get(msg.id)!} />
                )}
                {msg.content && (
                  <div className={`prose prose-invert prose-blue max-w-4xl bg-neutral-900/40 border border-neutral-800/60 rounded-3xl p-8 shadow-2xl ${
                    msg.finalReportWithCitations ? 'border-l-4 border-l-blue-600' : ''
                  }`}>
                    {msg.finalReportWithCitations && (
                      <div className="flex items-center gap-2 mb-6 text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                        <FileText className="w-4 h-4" /> Final Research Report
                      </div>
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-4 text-neutral-500">
            <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            <div>
              <div className="text-sm font-bold text-neutral-400">Agents synthesizing...</div>
              <div className="flex gap-1 mt-1">
                {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-neutral-700 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}></div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
