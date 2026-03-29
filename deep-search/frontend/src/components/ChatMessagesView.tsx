import React, { useEffect } from "react";
import { Globe, Sparkles, Loader2, FileText } from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline";
import { TaskBoard } from "./TaskBoard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InputForm } from "./InputForm";

interface Message {
  type: "human" | "ai";
  content: string;
  id: string;
  agent?: string;
  finalReportWithCitations?: boolean;
}

interface ChatMessagesViewProps {
  messages: Message[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (query: string) => void;
  onCancel: () => void;
  displayData: string | null;
  messageEvents: Map<string, any[]>;
  websiteCount: number;
}

export const ChatMessagesView: React.FC<ChatMessagesViewProps> = ({
  messages,
  isLoading,
  scrollAreaRef,
  onSubmit, // Added missing onSubmit prop
  onCancel,
  messageEvents,
  websiteCount,
}) => {
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header / Status Bar */}
      <header className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center border-2 border-neutral-900">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center border-2 border-neutral-900">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Allmighty Agent</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-semibold tracking-wider">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              {isLoading ? 'RESEARCHING IN PROGRESS' : 'READY FOR NEW QUERY'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-xs font-bold text-neutral-300">{websiteCount} Sources</span>
          </div>
          <button 
            onClick={onCancel}
            className="px-3 py-1 bg-red-600/10 border border-red-600/20 text-red-500 rounded-lg text-xs font-bold hover:bg-red-600/20 transition-all"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-12 scroll-smooth"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.type === "human" ? "items-end" : "items-start"} group`}>
            {msg.type === "human" ? (
              <div className="max-w-2xl bg-neutral-800/80 border border-neutral-700/50 rounded-2xl px-5 py-4 shadow-sm text-neutral-200 text-lg font-medium leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="w-full space-y-8">
                {/* Agent Activity Timeline for this AI message */}
                {messageEvents.get(msg.id) && messageEvents.get(msg.id)!.length > 0 && (
                  <div className="w-full max-w-3xl animate-fadeIn">
                    <ActivityTimeline events={messageEvents.get(msg.id)!} />
                  </div>
                )}
                
                {/* Task Board for Research Plans */}
                {msg.content && msg.agent === "plan_generator" && (
                  <div className="w-full max-w-3xl animate-fadeIn space-y-6">
                    <TaskBoard 
                      tasks={msg.content
                        .split("\n")
                        .filter(line => line.includes("[RESEARCH]"))
                        .map((line, i) => ({
                          id: `task_${i}`,
                          title: line.replace(/\[RESEARCH\]\s*/g, ""),
                          status: i === 0 && isLoading ? "running" : "pending"
                        }))
                      } 
                    />

                    {/* Interactive Approval Button (only show on the last message and when not loading) */}
                    {!isLoading && messages[messages.length - 1].id === msg.id && (
                      <div className="flex flex-col items-center gap-4 py-8 px-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl backdrop-blur-sm animate-fadeInUp">
                        <div className="text-center space-y-1">
                          <p className="text-sm font-bold text-blue-100">Research Strategy Ready</p>
                          <p className="text-[10px] text-blue-400 uppercase tracking-widest font-black">Authorization Required</p>
                        </div>
                        <button 
                          onClick={() => onSubmit("I approve the plan. Proceed with the research.")}
                          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-sm shadow-xl shadow-blue-900/40 transition-all flex items-center gap-2 group active:scale-95"
                        >
                          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" /> 
                          Approve & Execute Research
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Final Response Content */}
                {msg.content && msg.agent !== "plan_generator" && (
                  <div className={`prose prose-invert prose-blue max-w-4xl bg-neutral-900/40 border border-neutral-800/60 rounded-3xl p-8 shadow-2xl animate-fadeInUp ${msg.finalReportWithCitations ? 'border-l-4 border-l-blue-600' : ''}`}>
                    {msg.finalReportWithCitations && (
                      <div className="flex items-center gap-2 mb-6 text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                        <FileText className="w-4 h-4" /> Comprehensive Research Report
                      </div>
                    )}
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({children}) => <p className="text-neutral-300 leading-8 text-lg mb-6">{children}</p>,
                        h1: ({children}) => <h1 className="text-3xl font-bold text-white mt-12 mb-6 tracking-tight border-b border-neutral-800 pb-4">{children}</h1>,
                        h2: ({children}) => <h2 className="text-2xl font-semibold text-neutral-100 mt-10 mb-4 tracking-tight">{children}</h2>,
                        h3: ({children}) => <h3 className="text-xl font-medium text-neutral-200 mt-8 mb-3">{children}</h3>,
                        ul: ({children}) => <ul className="list-disc list-outside pl-6 space-y-3 mb-6 text-neutral-300 italic">{children}</ul>,
                        li: ({children}) => <li className="pl-2">{children}</li>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-blue-600 bg-blue-600/5 p-6 rounded-r-xl my-8 italic text-neutral-400">{children}</blockquote>,
                        a: ({href, children}) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 font-semibold no-underline hover:text-blue-300 hover:underline transition-all"
                          >
                            {children}
                          </a>
                        )
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>

                    {/* Source Cards Grid */}
                    {msg.finalReportWithCitations && (
                      <div className="mt-12 pt-8 border-t border-neutral-800">
                        <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-4">Verified Sources & References</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Array.from(new Set(
                            Array.from(msg.content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g)).map(m => m[2])
                          )).map((url) => {
                            const domain = new URL(url).hostname;
                            return (
                              <a 
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition-all group"
                              >
                                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center border border-neutral-700 overflow-hidden shrink-0">
                                  <img 
                                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                                    alt="" 
                                    className="w-4 h-4"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-neutral-200 truncate group-hover:text-blue-300 transition-colors">
                                    {domain}
                                  </p>
                                  <p className="text-[9px] text-neutral-500 truncate">{url}</p>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="mt-8 flex items-center gap-4 text-neutral-500 font-medium">
            <div className="p-2 bg-neutral-900 rounded-lg flex items-center justify-center border border-neutral-800 shadow-inner">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-neutral-400">Synthesizing findings...</div>
              <div className="flex items-center gap-1">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-1.5 h-1.5 bg-neutral-700 rounded-full animate-bounce" style={{animationDelay: `${delay}ms`}}></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Area */}
      <footer className="px-6 py-4 border-t border-white/5 bg-neutral-900/10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Neural Link</span>
            <span className="text-[10px] text-emerald-400 font-mono">ENCRYPTED_AES256</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Active Nodes</span>
            <span className="text-[10px] text-blue-400 font-mono">1.2.9_STABLE</span>
          </div>
        </div>
        
        <div className="max-w-md flex-1 px-8 h-10">
           <InputForm onSubmit={onSubmit} isLoading={isLoading} context="chat" />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">System Live</span>
        </div>
      </footer>
    </div>
  );
};
