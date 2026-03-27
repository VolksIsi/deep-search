import React, { useState } from "react";
import { Search, Sparkles, Globe, Mic, Plus } from "lucide-react";

interface WelcomeScreenProps {
  handleSubmit: (query: string, model: string, effort: string) => void;
  isLoading: boolean;
  onCancel: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  handleSubmit,
  isLoading,
}) => {
  const [query, setQuery] = useState("");
  const [model] = useState("gemini-2.0-flash");
  const [effort] = useState("high");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSubmit(query, model, effort);
    }
  };

  const suggestions = [
    "What is the future of humanoid robotics in 2026?",
    "Analyze the impact of quantum computing on modern cybersecurity",
    "Comprehensive report on the shift towards sodium-ion batteries",
    "Investigate the role of AI agents in clinical drug discovery",
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-neutral-950 w-full">
      {/* Animated Background Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden blur-[120px] opacity-20">
        <div className="absolute top-1/2 left-1/4 w-[50%] h-[50%] bg-blue-600 rounded-full animate-pulse mix-blend-screen transition-all duration-1000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[40%] h-[40%] bg-indigo-800 rounded-full animate-pulse mix-blend-screen transition-all duration-1000" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/4 right-1/2 w-[30%] h-[30%] bg-purple-700 rounded-full animate-pulse mix-blend-screen transition-all duration-1000" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="w-full max-w-4xl space-y-16 animate-fadeInUp relative z-10 p-4">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4 scale-110">
            <div className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">ALLMIGHTY SEARCH</span>
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
            How can I refine your <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              deep research
            </span> today?
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto font-medium">
            Next-gen agentic research engine with real-time web scraping, MCP tool-use, and document (RAG) capabilities.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition-opacity duration-300"></div>
          <form 
            onSubmit={onSubmit}
            className="relative bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden focus-within:border-neutral-700 transition-all"
          >
            <div className="p-4 flex items-start gap-4">
              <div className="p-3 bg-neutral-800 rounded-2xl hidden sm:block">
                <Search className="w-6 h-6 text-neutral-400" />
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything for deep research..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-xl text-white py-2 resize-none h-32 placeholder-neutral-600 outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
              />
            </div>
            
            <div className="px-4 py-3 bg-neutral-900/50 border-t border-neutral-800/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button type="button" title="Add source" className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
                <button type="button" title="Web Search" className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors">
                  <Globe className="w-5 h-5" />
                </button>
                <button type="button" title="Voice Search" className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors">
                  <Mic className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-neutral-800 mx-1"></div>
                <div className="px-2 py-1 bg-blue-600/10 border border-blue-500/20 rounded-md text-[10px] font-bold text-blue-400">
                  {model.toUpperCase()}
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${
                  query.trim() 
                    ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 translate-y-0" 
                    : "bg-neutral-800 text-neutral-600 scale-[0.98]"
                }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Research</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setQuery(s)}
              className="px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 hover:bg-neutral-800/50 transition-all text-left group"
            >
              <p className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                {s}
              </p>
              <div className="mt-2 text-[10px] font-semibold text-neutral-500 uppercase flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Explore Topic <Plus className="w-2.5 h-2.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};