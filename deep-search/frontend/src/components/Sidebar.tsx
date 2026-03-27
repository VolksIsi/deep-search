import React from 'react';
import { Settings, FolderUp, History, Database, BrainCircuit, Globe } from 'lucide-react';

interface SidebarProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onFileUpload: (files: FileList) => void;
  uploadedFiles: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  selectedModel, 
  setSelectedModel, 
  onFileUpload,
  uploadedFiles 
}) => {
  const models = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'gpt-4o', name: 'GPT-4o', icon: <BrainCircuit className="w-4 h-4 text-green-500" /> },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', icon: <BrainCircuit className="w-4 h-4 text-orange-500" /> },
  ];

  return (
    <aside className="w-72 bg-neutral-900/50 backdrop-blur-xl border-r border-neutral-800 flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Deep Search
          </h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 block">
              AI MODEL
            </label>
            <div className="space-y-1">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    selectedModel === model.id 
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                  }`}
                >
                  {model.icon}
                  <span className="text-sm font-medium">{model.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 block">
              KNOWLEDGE BASE (RAG)
            </label>
            <div 
              className="border-2 border-dashed border-neutral-800 rounded-xl p-4 transition-colors hover:border-neutral-700 group cursor-pointer relative"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) onFileUpload(e.dataTransfer.files);
              }}
            >
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={(e) => e.target.files && onFileUpload(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <FolderUp className="w-6 h-6 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                <p className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors text-center">
                  Drop documents here to chat with them
                </p>
              </div>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 rounded-md border border-neutral-700/50">
                    <Database className="w-3 h-3 text-neutral-500" />
                    <span className="text-xs text-neutral-400 truncate flex-1">{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-neutral-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 rounded-lg transition-all">
          <History className="w-4 h-4" />
          <span className="text-sm font-medium">History</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 rounded-lg transition-all">
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
};
