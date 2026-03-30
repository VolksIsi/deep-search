
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Brain,
  CheckCircle2,
  Command,
  Cpu,
  Download,
  FileText,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Play,
  Send,
  Settings2,
  Shield,
  Sparkle,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Sidebar, type SidebarTab } from "@/components/Sidebar";

interface Message {
  type: "human" | "ai";
  content: string;
  id: string;
  agent?: string;
  finalReportWithCitations?: boolean;
}

interface ProcessedEvent {
  title: string;
  data: any;
}

function isResearchPlanMessage(content: string) {
  return /\[RESEARCH\]/i.test(content);
}

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
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        finalTranscript += event.results[index][0].transcript;
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

  return { isListening, transcript, setTranscript, startListening, stopListening };
}

function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_\[\]()]/g, "").substring(0, 5000));
    utterance.rate = 1;
    utterance.pitch = 1;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appName, setAppName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messageEvents, setMessageEvents] = useState<Map<string, ProcessedEvent[]>>(new Map());
  const [websiteCount, setWebsiteCount] = useState(0);
  const [isCheckingBackend, setIsCheckingBackend] = useState(true);

  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string>("");
  const [loginError, setLoginError] = useState(false);

  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("config");
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentAgentRef = useRef("");
  const accumulatedTextRef = useRef("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { isListening, transcript, setTranscript, startListening, stopListening } = useVoiceInput();
  const { isSpeaking, speak, stop: stopSpeaking } = useSpeechOutput();

  // Check localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("deep_search_token");
    if (savedToken) {
      setAccessToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessToken) {
      localStorage.setItem("deep_search_token", accessToken);
      setIsAuthenticated(true);
    } else {
      setLoginError(true);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      try {
        const headers = { "X-Access-Token": accessToken };
        const [reportsRes, alertsRes, tasksRes, compRes] = await Promise.allSettled([
          fetch("/api/memory/reports", { headers }).then((res) => res.json()),
          fetch("/api/intel/alerts", { headers }).then((res) => res.json()),
          fetch("/api/scheduler/tasks", { headers }).then((res) => res.json()),
          fetch("/api/intel/dashboard", { headers }).then((res) => res.json()),
        ]);
        if (reportsRes.status === "fulfilled") setPastReports(reportsRes.value.reports || []);
        if (alertsRes.status === "fulfilled") setAlerts(alertsRes.value.alerts || []);
        if (tasksRes.status === "fulfilled") setScheduledTasks(tasksRes.value.tasks || []);
        if (compRes.status === "fulfilled") setCompetitors(compRes.value.competitors || []);
      } catch {
        // Backend can be unavailable during startup.
      }
    };

    loadData();
  }, []);

  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 10, maxDuration = 120000): Promise<any> => {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (Date.now() - startTime > maxDuration) throw new Error("Timeout");
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 5000)));
      }
    }

    throw lastError || new Error("Unknown retry error");
  };

  const createSession = async () => {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await fetch(`/apps/app/users/u_999/sessions/${id}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Access-Token": accessToken
      },
    });
    if (!res.ok) throw new Error(`Session failed: ${res.status}`);
    const data = await res.json();
    return { userId: data.userId, sessionId: data.id, appName: data.appName };
  };

  const checkBackendHealth = async () => {
    try {
      const response = await fetch("/docs", { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  };

  const extractData = (data: string) => {
    try {
      const payload = JSON.parse(data);
      return {
        textParts: payload.error
          ? [`Error: ${payload.error}`]
          : payload.content?.parts?.filter((part: any) => part.text).map((part: any) => part.text) || [],
        agent: payload.author || "",
        finalReportWithCitations: payload.actions?.stateDelta?.final_report_with_citations,
        functionCall: payload.content?.parts?.find((part: any) => part.functionCall)?.functionCall,
        functionResponse: payload.content?.parts?.find((part: any) => part.functionResponse)?.functionResponse,
        sourceCount: payload.actions?.stateDelta?.url_to_short_id
          ? Object.keys(payload.actions.stateDelta.url_to_short_id).length
          : 0,
        sources: payload.actions?.stateDelta?.sources,
      };
    } catch {
      return {
        textParts: [],
        agent: "",
        finalReportWithCitations: undefined,
        functionCall: null,
        functionResponse: null,
        sourceCount: 0,
        sources: null,
      };
    }
  };

  const agentTitles: Record<string, string> = {
    plan_generator: "Planning Strategy",
    section_planner: "Structuring Report",
    section_researcher: "Deep Web Research",
    research_evaluator: "Quality Assessment",
    EscalationChecker: "Quality Gate",
    enhanced_search_executor: "Enhanced Research",
    report_composer_with_citations: "Composing Report",
  };

  const processSSE = (jsonData: string, aiMsgId: string) => {
    const { textParts, agent, finalReportWithCitations, functionCall, functionResponse, sourceCount, sources } =
      extractData(jsonData);

    if (sourceCount > 0) {
      setWebsiteCount((prev) => Math.max(prev, sourceCount));
    }
    if (agent) {
      currentAgentRef.current = agent;
    }

    if (functionCall) {
      setMessageEvents((prev) =>
        new Map(prev).set(aiMsgId, [
          ...(prev.get(aiMsgId) || []),
          { title: `Tool: ${functionCall.name}`, data: { type: "functionCall", ...functionCall } },
        ]),
      );
    }
    if (functionResponse) {
      setMessageEvents((prev) =>
        new Map(prev).set(aiMsgId, [
          ...(prev.get(aiMsgId) || []),
          { title: `Result: ${functionResponse.name}`, data: { type: "functionResponse", ...functionResponse } },
        ]),
      );
    }

    if (textParts.length > 0 && agent !== "report_composer_with_citations") {
      if (agent !== "interactive_planner_agent" && agent !== "plan_generator" && agent !== "section_researcher") {
        setMessageEvents((prev) =>
          new Map(prev).set(aiMsgId, [
            ...(prev.get(aiMsgId) || []),
            { title: agentTitles[agent] || `Agent: ${agent}`, data: { type: "text", content: textParts.join(" ") } },
          ]),
        );
      } else {
        for (const text of textParts) {
          accumulatedTextRef.current += text;
          
          // Intelligent Keyword Detection for Research Plan Approval Buttons
          const lowerText = accumulatedTextRef.current.toLowerCase();
          if (
            (lowerText.includes("approve this plan") || 
             lowerText.includes("refine it further") || 
             lowerText.includes("do you approve")) && 
            !hasResearchPlan
          ) {
            setHasResearchPlan(true);
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === aiMsgId
                ? { ...message, content: accumulatedTextRef.current.trim(), agent: currentAgentRef.current }
                : message,
            ),
          );
        }
      }
    }

    if (sources) {
      setMessageEvents((prev) =>
        new Map(prev).set(aiMsgId, [
          ...(prev.get(aiMsgId) || []),
          { title: "Sources Retrieved", data: { type: "sources", content: sources } },
        ]),
      );
    }

    if (agent === "report_composer_with_citations" && finalReportWithCitations) {
      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          content: finalReportWithCitations,
          id: `${Date.now()}_final`,
          agent: "report_composer",
          finalReportWithCitations: true,
        },
      ]);
    }
  };

  const handleSubmit = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setIsLoading(true);

      try {
        let localUserId = userId;
        let localSessionId = sessionId;
        let localAppName = appName;

        if (!localSessionId) {
          const sessionData = await retryWithBackoff(createSession);
          localUserId = sessionData.userId;
          localSessionId = sessionData.sessionId;
          localAppName = sessionData.appName;

          setUserId(localUserId);
          setSessionId(localSessionId);
          setAppName(localAppName);
        }

        setMessages((prev) => [...prev, { type: "human", content: query, id: `${Date.now()}` }]);
        const aiId = `${Date.now()}_ai`;
        currentAgentRef.current = "";
        accumulatedTextRef.current = "";
        setMessages((prev) => [...prev, { type: "ai", content: "", id: aiId, agent: "" }]);

        const response = await retryWithBackoff(() =>
          fetch("/run_sse", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Access-Token": accessToken
            },
            body: JSON.stringify({
              appName: localAppName,
              userId: localUserId,
              sessionId: localSessionId,
              newMessage: { parts: [{ text: query }], role: "user" },
              streaming: true,
              model: selectedModel,
            }),
          }),
        );

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventBuffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (value) buffer += decoder.decode(value, { stream: true });

            let eol;
            while ((eol = buffer.indexOf("\n")) >= 0) {
              const line = buffer.substring(0, eol);
              buffer = buffer.substring(eol + 1);

              if (line.trim() === "") {
                if (eventBuffer) {
                  processSSE(eventBuffer.trim(), aiId);
                  eventBuffer = "";
                }
              } else if (line.startsWith("data:")) {
                eventBuffer += line.substring(5) + "\n";
              }
            }

            if (done) break;
          }
        }
      } catch (error) {
        setMessages((prev) => [...prev, { type: "ai", content: `Error: ${error}`, id: `${Date.now()}_err` }]);
      } finally {
        setIsLoading(false);
      }
    },
    [appName, selectedModel, sessionId, userId],
  );

  const handleExportPDF = async () => {
    const report = messages.find((message) => message.finalReportWithCitations);
    if (!report) return;

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: report.content, title: "Research Report" }),
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "research_report.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export failed", error);
    }
  };

  const handleExportDocx = async () => {
    const report = messages.find((message) => message.finalReportWithCitations);
    if (!report) return;

    try {
      const response = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: report.content, title: "Research Report" }),
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "research_report.docx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("DOCX export failed", error);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    setUploadedFiles((prev) => [...prev, ...Array.from(files).map((file) => file.name)]);

    try {
      await fetch("/api/upload", { method: "POST", body: formData });
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  useEffect(() => {
    (async () => {
      for (let attempt = 0; attempt < 60; attempt++) {
        if (await checkBackendHealth()) {
          setIsCheckingBackend(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      setIsCheckingBackend(false);
    })();
  }, []);

  useEffect(() => {
    if (transcript && !isListening) {
      handleSubmit(transcript);
      setTranscript("");
    }
  }, [handleSubmit, isListening, setTranscript, transcript]);

  const hasReport = useMemo(() => messages.some((message) => message.finalReportWithCitations), [messages]);
  const aiMessageCount = useMemo(() => messages.filter((message) => message.type === "ai").length, [messages]);
  const toolRuns = useMemo(
    () => Array.from(messageEvents.values()).reduce((sum, events) => sum + events.length, 0),
    [messageEvents],
  );

  const toggleSpeakFromSidebar = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    const report = messages.find((message) => message.finalReportWithCitations);
    if (report) speak(report.content);
  }, [isSpeaking, messages, speak, stopSpeaking]);

  if (isCheckingBackend) {
    return (
      <div className="flex h-screen items-center justify-center premium-gradient">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel rounded-3xl border-white/10 p-9 text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-500/30 bg-cyan-500/10">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          </div>
          <p className="text-lg font-black uppercase tracking-[0.12em] text-white">Allmighty Deep Search</p>
          <p className="mt-2 text-sm text-neutral-400">Booting neural research platform... Connecting to Discovery Engine.</p>
        </motion.div>
      </div>
    );
  }

  const handleReportSelect = async (reportId: number) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/memory/reports/${reportId}`);
      if (!res.ok) throw new Error("Report not found");
      const report = await res.json();
      
      setMessages([
        {
          type: "ai",
          content: report.content,
          id: `restored_${report.id}`,
          agent: "library_restoration",
          finalReportWithCitations: true,
        }
      ]);
      setIsSidebarOpen(false);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load report:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#05060a] text-neutral-100">
      <AnimatePresence>
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel w-full max-w-md rounded-3xl border-white/10 p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                <Shield className="h-10 w-10 text-cyan-400" />
              </div>
              
              <h1 className="mb-2 text-2xl font-black uppercase tracking-widest text-white">
                ALLMIGHTY ACCESS
              </h1>
              <p className="mb-8 text-neutral-400 text-sm">
                Unlock the 2026 Deep Search Engine with your secure access token.
              </p>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="relative group">
                  <div className={`absolute inset-0 bg-cyan-500/20 blur-xl rounded-2xl transition-opacity duration-500 ${accessToken ? 'opacity-100' : 'opacity-0'}`} />
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value);
                      setLoginError(false);
                    }}
                    placeholder="Enter Access Token..."
                    className={`relative w-full rounded-2xl border ${loginError ? 'border-red-500/50' : 'border-white/10'} bg-black/40 px-6 py-4 text-center text-lg tracking-widest text-white placeholder:text-neutral-700 focus:border-cyan-500/50 focus:outline-none transition-all`}
                    autoFocus
                  />
                </div>

                {loginError && (
                  <p className="text-red-400 text-xs font-bold uppercase tracking-tighter">
                    INVALID TOKEN • ACCESS DENIED
                  </p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full rounded-2xl bg-cyan-500 py-4 font-black uppercase tracking-[0.2em] text-black shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all hover:bg-cyan-400"
                >
                  Authorize System
                </motion.button>
              </form>

              <div className="mt-8 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                Security Protocol V4.2 • Protected by Neural Grid
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        onFileUpload={handleFileUpload}
        uploadedFiles={uploadedFiles}
        isListening={isListening}
        onVoiceToggle={isListening ? stopListening : startListening}
        isSpeaking={isSpeaking}
        onSpeakToggle={toggleSpeakFromSidebar}
        canSpeak={hasReport}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        websiteCount={websiteCount}
        aiMessageCount={aiMessageCount}
        toolRuns={toolRuns}
        competitors={competitors}
        alerts={alerts}
        pastReports={pastReports}
        onReportSelect={handleReportSelect}
        scheduledTasks={scheduledTasks}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="relative flex flex-1 flex-col overflow-hidden premium-gradient">
        <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.08]" />
        <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-4 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.section
              key="welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col"
            >
              <WelcomeView
                onSubmit={handleSubmit}
                isLoading={isLoading}
                isListening={isListening}
                transcript={transcript}
                onVoiceToggle={isListening ? stopListening : startListening}
                selectedModel={selectedModel}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              />
            </motion.section>
          ) : (
            <motion.section
              key="research"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col"
            >
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
                onSpeak={() => {
                  const r = messages.find((m) => m.finalReportWithCitations);
                  if (r) speak(r.content);
                }}
                onStopSpeak={stopSpeaking}
                onSubmit={handleSubmit}
                isListening={isListening}
                onVoiceToggle={isListening ? stopListening : startListening}
                transcript={transcript}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
function WelcomeView({
  onSubmit,
  isLoading,
  isListening,
  transcript,
  onVoiceToggle,
  selectedModel,
  onToggleSidebar,
}: {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  isListening: boolean;
  transcript: string;
  onVoiceToggle: () => void;
  selectedModel: string;
  onToggleSidebar: () => void;
}) {
  const [query, setQuery] = useState(transcript || "");

  useEffect(() => {
    if (transcript) setQuery(transcript);
  }, [transcript]);

  const suggestions = [
    { text: "Future of humanoid robotics in 2026", icon: <TrendingUp className="h-4 w-4" /> },
    { text: "Quantum computing impact on global cybersecurity", icon: <Shield className="h-4 w-4" /> },
    { text: "Sodium-ion battery breakthrough trajectory", icon: <BarChart3 className="h-4 w-4" /> },
    { text: "AI agents in clinical drug discovery", icon: <Brain className="h-4 w-4" /> },
  ];

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 py-20 lg:justify-center lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.09]" />
      
      {/* Header / Brand */}
      <div className="fixed left-0 right-0 top-0 z-[60] flex h-16 items-center justify-between border-b border-white/5 bg-black/40 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-600">
            <Zap className="h-5 w-5 text-black" />
          </div>
          <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Allmighty Deep Search</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-neutral-400 transition hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl space-y-10 py-10 text-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="inline-flex items-center gap-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2">
            <Sparkle className="h-4 w-4 text-cyan-300" />
            <span className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-200/80">
              Vertex AI Neural Core Active
            </span>
          </div>
          <h1 className="mt-7 text-6xl font-black leading-[0.92] tracking-tight text-white md:text-8xl">
            Next-Gen
            <span className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-emerald-300 bg-clip-text text-transparent">
              {" "}
              AI Search
            </span>
            <br />
            Engine
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-xl text-neutral-400">
            Orchestrate grounded research with Vertex AI Discovery Engine and GenAI App Builder.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) onSubmit(query);
          }}
          className="glass-panel mx-auto max-w-5xl rounded-[2rem] border-white/10 p-5"
        >
          <div className="flex items-start gap-4 rounded-2xl border border-white/5 bg-black/40 p-5">
            <div className="hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 sm:block">
              <Command className="h-8 w-8 text-cyan-300" />
            </div>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Describe the domain and depth you want to research..."
              className="h-32 flex-1 resize-none bg-transparent text-2xl text-white placeholder:text-neutral-600 focus:outline-none"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (query.trim()) onSubmit(query);
                }
              }}
            />
          </div>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/40 px-4 py-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onVoiceToggle}
                className={`rounded-xl border px-4 py-3 transition ${
                  isListening
                    ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                    : "border-white/10 bg-black/40 text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-200"
                }`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2">
                <Cpu className="h-4 w-4 text-indigo-300" />
                <span className="text-xs font-black uppercase tracking-[0.14em] text-indigo-200/90">{selectedModel}</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading || !query.trim()}
              className={`inline-flex items-center gap-3 rounded-xl px-7 py-3 text-xs font-black uppercase tracking-[0.2em] transition ${
                query.trim()
                  ? "bg-cyan-500 text-black shadow-[0_0_30px_rgba(34,211,238,0.35)]"
                  : "bg-neutral-800 text-neutral-500"
              }`}
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Zap className="h-5 w-5" />Start Research</>}
            </motion.button>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.14 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {suggestions.map((item, index) => (
            <button
              key={`${item.text}-${index}`}
              onClick={() => setQuery(item.text)}
              className="glass-panel rounded-2xl border-white/5 p-4 text-left transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
            >
              <div className="mb-3 inline-flex rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-200">
                {item.icon}
              </div>
              <p className="text-sm font-semibold text-neutral-200">{item.text}</p>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function ResearchView({
  messages,
  isLoading,
  scrollAreaRef,
  messageEvents,
  websiteCount,
  hasReport,
  onExportPDF,
  onExportDocx,
  isSpeaking,
  onSpeak,
  onStopSpeak,
  onSubmit,
  isListening,
  onVoiceToggle,
  transcript,
  onToggleSidebar,
}: {
  messages: Message[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  messageEvents: Map<string, any[]>;
  websiteCount: number;
  hasReport: boolean;
  onExportPDF: () => void;
  onExportDocx: () => void;
  isSpeaking: boolean;
  onSpeak: () => void;
  onStopSpeak: () => void;
  onSubmit: (query: string) => void;
  isListening: boolean;
  onVoiceToggle: () => void;
  transcript: string;
  onToggleSidebar: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (transcript) setQuery(transcript);
  }, [transcript]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [isLoading, messages, scrollAreaRef]);

  const hasResearchPlan = useMemo(
    () => messages.some((message) => message.type === "ai" && isResearchPlanMessage(message.content)),
    [messages],
  );

  return (
    <div className="relative z-10 flex h-full flex-1 flex-col overflow-hidden">
      <header className="relative z-20 border-b border-white/5 bg-black/45 px-8 py-5 backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-200">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-200">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">Multi Agent Runtime</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isLoading ? "bg-cyan-400 animate-pulse" : "bg-emerald-400"}`} />
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                  {isLoading ? "Pipeline active" : "Pipeline stable"} • {websiteCount} sources
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-neutral-400 transition hover:text-white lg:hidden"
            >
              <Settings2 className="h-5 w-5" />
            </button>
            {hasReport && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
                  <button 
                    onClick={onExportPDF} 
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-rose-300 transition hover:bg-rose-500/10"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </button>
                  <div className="h-4 w-[1px] bg-white/5" />
                  <button 
                    onClick={onExportDocx} 
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    DOCX
                  </button>
                  <div className="h-4 w-[1px] bg-white/5" />
                  <button 
                    onClick={() => {
                      const report = messages.find(m => m.finalReportWithCitations);
                      if (report) {
                        navigator.clipboard.writeText(report.content);
                        alert("Report copied to clipboard!");
                      }
                    }} 
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>

                <button
                  onClick={isSpeaking ? onStopSpeak : onSpeak}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 transition ${
                    isSpeaking ? "bg-indigo-500/30 text-indigo-100" : "bg-black/35 text-indigo-200 hover:bg-white/10"
                  }`}
                >
                  {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-white/10 bg-black/35 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400 transition hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div ref={scrollAreaRef} className="relative flex-1 space-y-12 overflow-y-auto px-8 py-10 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className={`flex ${message.type === "human" ? "justify-end" : "justify-start"}`}
            >
              {message.type === "human" ? (
                <div className="glass-panel max-w-3xl rounded-3xl border-cyan-500/20 px-6 py-4 text-lg text-white">
                  {message.content}
                </div>
              ) : (
                <div className="w-full space-y-6">
                  {messageEvents.get(message.id) && messageEvents.get(message.id)!.length > 0 && (
                    <ActivityTimeline events={messageEvents.get(message.id)!} />
                  )}
                  {message.content && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.995 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`prose prose-invert max-w-6xl rounded-[2rem] p-10 glass-panel ${
                        message.finalReportWithCitations ? "border-emerald-500/20 neon-glow-emerald" : "border-white/5"
                      }`}
                    >
                      {message.finalReportWithCitations && (
                        <div className="mb-8 flex items-center gap-4 border-b border-white/10 pb-6">
                          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-3 text-emerald-200">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300/80">Final Deliverable</p>
                            <p className="text-2xl font-black text-white">Strategic Research Report</p>
                          </div>
                        </div>
                      )}
                      <div className="text-neutral-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 pb-20">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300/80">
              Agents are collecting and validating data
            </p>
          </motion.div>
        )}
      </div>

      <div className="relative z-20 border-t border-white/5 bg-black/45 px-8 py-6 backdrop-blur-2xl">
        <div className="mx-auto max-w-5xl space-y-5">
          <AnimatePresence>
            {hasResearchPlan && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex items-center justify-center gap-4 py-2"
              >
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(16,185,129,0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSubmit("Start Research")}
                  disabled={isLoading}
                  className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-500 px-8 py-4 text-xs font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                  <Play className="h-4 w-4 fill-black" />
                  Initialize Research
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setQuery("Optimize the research plan by focus on ");
                    const input = document.querySelector('input[placeholder*="Approve"]');
                    if (input instanceof HTMLInputElement) input.focus();
                  }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-xs font-black uppercase tracking-[0.25em] text-white transition-all backdrop-blur-md"
                >
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  Refine Strategy
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!query.trim()) return;
              onSubmit(query);
              setQuery("");
            }}
            className="glass-panel rounded-2xl border-white/10 p-3"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onVoiceToggle}
                className={`rounded-xl border px-3 py-3 transition ${
                  isListening
                    ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                    : "border-white/10 bg-black/30 text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-200"
                }`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={hasResearchPlan ? "Approve or refine the research strategy..." : "Type your next research command..."}
                className="flex-1 bg-transparent px-1 py-2 text-lg text-white placeholder:text-neutral-600 focus:outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!query.trim()) return;
                    onSubmit(query);
                    setQuery("");
                  }
                }}
              />

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading || !query.trim()}
                className={`rounded-xl p-3 transition ${
                  query.trim()
                    ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                    : "border border-white/10 bg-black/30 text-neutral-600"
                }`}
              >
                <Send className="h-5 w-5" />
              </motion.button>
            </div>
          </form>

          <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Secure Stream
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              AI Logic Active
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" />
              Parallel Tools Online
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
