// ** import types
import type { KeyboardEvent } from "react";
import type { Artifact } from "@repo/db";

// ** import core packages
import { Editor } from "@monaco-editor/react";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  Globe,
  Github,
  PanelLeft,
  Pencil,
  Plus,
  Terminal as TerminalIcon,
  UserPlus,
  MoreHorizontal,
  Square,
  Play,
  RotateCw,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

// ** import components
import { VibeAssistantThread } from "@/components/assistant/vibe-assistant-thread";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModeToggle } from "@/components/ui/mode-toggle";

// ** import hooks
import { useProjectActions } from "@/pages/project/hooks/use-project-actions";
import { useProjectData } from "@/pages/project/hooks/use-project-data";

// ** import apis
import { getModels } from "@/rest-api/models";

export default function Project() {
  const ASSISTANT_PANEL_WIDTH_KEY = "project-assistant-panel-width";
  const DEFAULT_ASSISTANT_PANEL_WIDTH = 380;
  const MIN_ASSISTANT_PANEL_WIDTH = 300;
  const MAX_ASSISTANT_PANEL_WIDTH = 560;

  const { id: projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const { project, workspace, threads, executions, artifacts, isLoading } =
    useProjectData(projectId);
  const {
    renameProject,
    runPrompt,
    isPromptRunning,
    cancelPrompt,
    undoToPrompt,
    renameThread,
    deleteThread,
  } = useProjectActions({
    projectId,
    workspaceId: workspace?.id,
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [hasManuallySelectedThread, setHasManuallySelectedThread] =
    useState(false);

  // Automatically select latest thread on load
  useEffect(() => {
    if (threads.length > 0 && !activeThreadId && !hasManuallySelectedThread) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId, hasManuallySelectedThread]);

  const activeExecutions = useMemo(() => {
    if (!activeThreadId) return [];
    return executions.filter((exec) => exec.threadId === activeThreadId);
  }, [executions, activeThreadId]);

  const { data: modelsRes } = useQuery({
    queryKey: ["models"],
    queryFn: () => getModels().then((res) => res.data),
    placeholderData: [],
  });
  const models = (modelsRes || []) as { id: string; displayName: string }[];

  const isAnyExecutionRunning = useMemo(
    () =>
      activeExecutions.some(
        (exec) => exec.status === "queued" || exec.status === "running",
      ),
    [activeExecutions],
  );

  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(true);
  const [assistantPanelWidth, setAssistantPanelWidth] = useState(
    DEFAULT_ASSISTANT_PANEL_WIDTH,
  );
  const [isResizingAssistantPanel, setIsResizingAssistantPanel] =
    useState(false);
  const [localProjectName, setLocalProjectName] = useState("");
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [selectedFile, setSelectedFile] = useState<Artifact | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"app" | "code">("code");
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const splitLayoutRef = useRef<HTMLDivElement | null>(null);

  const latestExecution = useMemo(
    () => activeExecutions[activeExecutions.length - 1],
    [activeExecutions],
  );
  const editorTheme = resolvedTheme === "light" ? "vs" : "vs-dark";

  const detectLanguage = (file: Artifact | null) => {
    if (!file) return "typescript";
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "typescript";
    if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "javascript";
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".css")) return "css";
    if (lower.endsWith(".md")) return "markdown";
    if (lower.endsWith(".html")) return "html";
    return "plaintext";
  };

  const getEditorContent = (file: Artifact | null) => {
    if (!file) return "// Select a file to view source content...";

    try {
      const metadata = file.metadata ? JSON.parse(file.metadata) : null;
      if (metadata?.content && typeof metadata.content === "string") {
        return metadata.content;
      }
    } catch {
      // fallback to raw metadata
    }

    return file.metadata || `// ${file.name}\n// Content preview unavailable.`;
  };

  const previewSource = useMemo(() => {
    const htmlArtifact = artifacts.find((artifact) =>
      artifact.name.toLowerCase().endsWith(".html"),
    );

    if (!htmlArtifact) return null;

    try {
      const metadata = htmlArtifact.metadata
        ? JSON.parse(htmlArtifact.metadata)
        : null;
      if (metadata?.content && typeof metadata.content === "string") {
        return metadata.content;
      }
    } catch {
      return null;
    }

    return null;
  }, [artifacts]);

  useEffect(() => {
    if (project?.name && !isEditingProjectName)
      setLocalProjectName(project.name);
  }, [project, isEditingProjectName]);

  useEffect(() => {
    const storedWidth = window.localStorage.getItem(ASSISTANT_PANEL_WIDTH_KEY);
    if (!storedWidth) return;
    const parsedWidth = Number.parseInt(storedWidth, 10);
    if (Number.isNaN(parsedWidth)) return;
    setAssistantPanelWidth(
      Math.min(
        MAX_ASSISTANT_PANEL_WIDTH,
        Math.max(MIN_ASSISTANT_PANEL_WIDTH, parsedWidth),
      ),
    );
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      ASSISTANT_PANEL_WIDTH_KEY,
      String(assistantPanelWidth),
    );
  }, [assistantPanelWidth]);

  // Set default selected file
  useEffect(() => {
    if (artifacts.length > 0 && !selectedFile) {
      const mainFile =
        artifacts.find(
          (a) => a.name.includes("App") || a.name.includes("index"),
        ) || artifacts[0];
      setSelectedFile(mainFile);
    }
  }, [artifacts, selectedFile]);

  const handleFinishRename = () => {
    if (localProjectName.trim() && localProjectName !== project?.name) {
      renameProject(localProjectName.trim());
    }
    setIsEditingProjectName(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleFinishRename();
    if (e.key === "Escape") {
      setLocalProjectName(project?.name || "");
      setIsEditingProjectName(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["artifacts"] });
    queryClient.invalidateQueries({ queryKey: ["executions"] });
  };

  const handleAssistantResizeStart = () => {
    if (!isAssistantPanelOpen) return;

    const handleMouseMove = (event: MouseEvent) => {
      const splitLayoutElement = splitLayoutRef.current;
      if (!splitLayoutElement) return;

      const bounds = splitLayoutElement.getBoundingClientRect();
      const nextWidth = event.clientX - bounds.left;
      setAssistantPanelWidth(
        Math.min(
          MAX_ASSISTANT_PANEL_WIDTH,
          Math.max(MIN_ASSISTANT_PANEL_WIDTH, nextWidth),
        ),
      );
    };

    const handleMouseUp = () => {
      setIsResizingAssistantPanel(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    setIsResizingAssistantPanel(true);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground font-medium animate-in fade-in duration-700">
        Spawning environment...
      </div>
    );

  return (
    <ProtectedRoute>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
        <div ref={splitLayoutRef} className="flex flex-1 min-h-0">
          {/* Assistant Sidebar */}
          <aside
            className={`relative flex flex-col border-r border-border/40 bg-card/40 transition-[width] duration-200 ease-out ${isAssistantPanelOpen ? "overflow-visible" : "overflow-hidden border-transparent"}`}
            style={{
              width: isAssistantPanelOpen ? `${assistantPanelWidth}px` : "0px",
            }}
          >
            <div className="h-[38px] flex items-center justify-between px-3 border-b border-border/40 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to="/apps"
                  className="p-1.5 hover:bg-secondary/80 rounded-md transition-colors group"
                >
                  <ArrowLeft className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                {isEditingProjectName ? (
                  <input
                    autoFocus
                    value={localProjectName}
                    onChange={(e) => setLocalProjectName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent outline-none border-b border-foreground/30 text-[13px] font-semibold text-foreground px-0.5 w-[140px]"
                  />
                ) : (
                  <div
                    className="flex items-center gap-1 group cursor-pointer"
                    onClick={() => setIsEditingProjectName(true)}
                  >
                    <span className="text-[13px] font-semibold truncate max-w-[140px] text-foreground/90">
                      {project?.name}
                    </span>
                    <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <VibeAssistantThread
                executions={activeExecutions}
                threads={threads}
                activeThreadId={activeThreadId}
                onSelectThread={(id) => {
                  setActiveThreadId(id);
                  setHasManuallySelectedThread(true);
                }}
                onSendPrompt={(prompt, modelId) =>
                  runPrompt(
                    {
                      prompt,
                      modelId,
                      threadId: activeThreadId || undefined,
                    },
                    {
                      onSuccess: (res: any) => {
                        if (!activeThreadId && res?.data?.threadId) {
                          setActiveThreadId(res.data.threadId);
                        }
                      },
                    },
                  )
                }
                isSending={isPromptRunning || isAnyExecutionRunning}
                models={models}
                runningModelId={
                  isAnyExecutionRunning ? latestExecution?.modelId : undefined
                }
                onUndoToMessage={(execId, promptText) => {
                  if (
                    window.confirm(
                      "Are you sure you want to revert the codebase to before this prompt? This action will undo all code changes made by this prompt and any subsequent prompts. You can still view them in history.",
                    )
                  ) {
                    undoToPrompt(execId);
                  }
                }}
                onRenameThread={(threadId, title) =>
                  renameThread({ threadId, title })
                }
                onDeleteThread={(threadId) => deleteThread(threadId)}
              />
            </div>
          </aside>

          {isAssistantPanelOpen ? (
            <div
              className={[
                "group relative z-20 w-1 cursor-col-resize select-none bg-transparent transition-colors",
                isResizingAssistantPanel
                  ? "bg-primary/25"
                  : "hover:bg-primary/20",
              ].join(" ")}
              onMouseDown={handleAssistantResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize assistant panel"
            >
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/50 group-hover:bg-primary/45" />
            </div>
          ) : null}

          {/* Main Workspace */}
          <main className="flex-1 flex flex-col min-w-0 bg-background">
            {/* Toolbar */}
            <header className="h-[38px] border-b border-border/40 bg-card/40 flex items-center justify-between px-3 z-10 shadow-sm">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsAssistantPanelOpen(!isAssistantPanelOpen)}
                  className="size-7 flex items-center justify-center hover:bg-secondary/50 rounded-md transition-all active:scale-95"
                  title="Toggle Assistant"
                >
                  <PanelLeft
                    className={`size-3.5 transition-colors ${isAssistantPanelOpen ? "text-primary" : "text-muted-foreground"}`}
                  />
                </button>
                <div className="flex items-center bg-secondary/30 rounded-md p-0.5 border border-border/40 mx-1">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("app")}
                    className={[
                      "px-2.5 py-0.5 text-[11px] font-semibold rounded-[4px] border transition-all h-6",
                      workspaceTab === "app"
                        ? "bg-background text-foreground border-border/50"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    App
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("code")}
                    className={[
                      "px-2.5 py-0.5 text-[11px] font-semibold rounded-[4px] border transition-all h-6",
                      workspaceTab === "code"
                        ? "bg-background text-foreground border-border/50"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    Code
                  </button>
                </div>
                <button className="size-7 flex items-center justify-center hover:bg-secondary/50 rounded-md transition-colors">
                  <Plus className="size-3.5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center mr-1">
                  {latestExecution?.status === "running" ||
                  latestExecution?.status === "queued" ? (
                    <span className="flex items-center gap-1.5 px-2 h-6 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-wider animate-pulse border border-amber-500/20">
                      <Loader2 className="size-3 animate-spin" /> running
                    </span>
                  ) : null}
                </div>
                <button className="size-7 flex items-center justify-center hover:bg-secondary/50 rounded-md transition-colors">
                  <Github className="size-3.5 text-muted-foreground" />
                </button>
                <div className="h-4 w-px bg-border/40 mx-0.5" />
                <button className="flex items-center gap-1.5 px-3 h-7 bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98] rounded-md text-[11px] font-bold transition-all shadow-sm border border-primary/50">
                  <Globe className="size-3.5" /> Deploy
                </button>
                <button className="size-7 flex items-center justify-center hover:bg-secondary/50 rounded-md transition-colors">
                  <MoreHorizontal className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            </header>

            {/* Editor Area */}
            <div className="flex-1 flex min-h-0 bg-background">
              {/* Explorer */}
              {workspaceTab === "code" ? (
                <div className="w-56 border-r border-border/40 bg-card/30 flex flex-col">
                  <div className="h-[32px] flex items-center justify-between px-4 border-b border-border/40 text-[10px] uppercase font-bold text-muted-foreground tracking-widest bg-muted/20">
                    Explorer
                    <RotateCw
                      onClick={handleRefresh}
                      className="size-3 cursor-pointer hover:text-primary transition-all active:rotate-180"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto py-3 scrollbar-none">
                    <div className="px-4 py-1.5 text-[11px] text-muted-foreground flex items-center gap-2 hover:bg-secondary/30 cursor-pointer group">
                      <ChevronDown className="size-3 group-hover:text-foreground transition-colors" />
                      <Folder className="size-3.5 text-muted-foreground/80" />
                      <span className="font-semibold group-hover:text-foreground tracking-tight">
                        src
                      </span>
                    </div>
                    {artifacts.length === 0 ? (
                      <div className="px-8 py-3 text-[11px] text-muted-foreground/50 italic font-medium">
                        No files synthesized
                      </div>
                    ) : (
                      artifacts.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => setSelectedFile(file)}
                          className={`px-8 py-1.5 text-[12px] flex items-center gap-2 cursor-pointer transition-all border-r-2 ${selectedFile?.id === file.id ? "text-primary bg-primary/5 border-primary font-semibold shadow-[inset_-4px_0_8px_-4px_rgba(59,130,246,0.3)]" : "text-muted-foreground/80 hover:bg-secondary/20 border-transparent hover:text-foreground"}`}
                        >
                          <FileCode
                            className={`size-3.5 ${selectedFile?.id === file.id ? "text-primary" : "text-muted-foreground/40"}`}
                          />
                          <span className="truncate">{file.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {/* Central Editor */}
              <div className="flex-1 flex flex-col min-w-0 bg-background">
                {workspaceTab === "app" ? (
                  <div className="flex-1 overflow-hidden border-l border-border/40 bg-card/20">
                    {previewSource ? (
                      <iframe
                        title="App preview"
                        sandbox="allow-scripts allow-same-origin"
                        srcDoc={previewSource}
                        className="h-full w-full bg-white"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Preview not available yet
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="h-[32px] flex items-center bg-card/30 px-1 border-b border-border/40 gap-0.5">
                      {selectedFile ? (
                        <div className="h-full flex items-center gap-2.5 px-4 bg-card border-t-2 border-primary text-[11px] font-bold text-foreground animate-in slide-in-from-top-1 duration-300">
                          <FileCode className="size-3.5 text-primary" />
                          {selectedFile.name}
                        </div>
                      ) : (
                        <div className="h-full flex items-center gap-2.5 px-4 italic text-muted-foreground text-[11px] opacity-50">
                          No file open
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-1 px-2 text-[10px] text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => setEditorWordWrap((prev) => !prev)}
                          className="rounded px-1.5 py-0.5 hover:bg-secondary/40 hover:text-foreground transition-colors"
                        >
                          Wrap {editorWordWrap ? "On" : "Off"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditorFontSize((prev) => Math.max(prev - 1, 11))
                          }
                          className="rounded px-1.5 py-0.5 hover:bg-secondary/40 hover:text-foreground transition-colors"
                        >
                          A-
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditorFontSize((prev) => Math.min(prev + 1, 16))
                          }
                          className="rounded px-1.5 py-0.5 hover:bg-secondary/40 hover:text-foreground transition-colors"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 pt-1 overflow-hidden relative">
                      {!selectedFile && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <div className="flex flex-col items-center gap-4 text-muted-foreground/20">
                            <FileCode className="size-16" />
                            <span className="text-sm font-bold tracking-widest uppercase">
                              Workspace Ready
                            </span>
                          </div>
                        </div>
                      )}
                      <Editor
                        theme={editorTheme}
                        language={detectLanguage(selectedFile)}
                        value={getEditorContent(selectedFile)}
                        loading={
                          <div className="p-3 text-xs text-muted-foreground">
                            Loading editor...
                          </div>
                        }
                        options={{
                          fontSize: editorFontSize,
                          fontFamily:
                            "'JetBrains Mono', 'Fira Code', monospace",
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          lineNumbers: "on",
                          padding: { top: 12 },
                          renderLineHighlight: "all",
                          automaticLayout: true,
                          wordWrap: editorWordWrap ? "on" : "off",
                          bracketPairColorization: { enabled: true },
                          guides: { indentation: true },
                          scrollbar: {
                            vertical: "visible",
                            horizontal: "visible",
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                          },
                          readOnly: true,
                          cursorSmoothCaretAnimation: "on",
                          smoothScrolling: true,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Terminal Area */}
            <footer className="h-48 border-t border-border/40 bg-card/20 flex flex-col z-20">
              <div className="h-[32px] flex items-center px-4 border-b border-border/40 gap-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2 text-primary border-b-2 border-primary h-full px-1">
                  <TerminalIcon className="size-3" /> Terminal
                </div>
                <span className="hover:text-foreground cursor-pointer transition-colors flex items-center h-full">
                  Output
                </span>
                <span className="hover:text-foreground cursor-pointer transition-colors flex items-center h-full">
                  Debug
                </span>

                <div className="ml-auto flex items-center gap-5">
                  {(latestExecution?.status === "running" ||
                    latestExecution?.status === "queued") && (
                    <button
                      onClick={() => cancelPrompt(latestExecution.id)}
                      className="flex items-center gap-1.5 text-destructive hover:text-white hover:bg-destructive/20 px-2 py-0.5 rounded transition-all"
                    >
                      <Square className="size-3 fill-current" /> Stop
                    </button>
                  )}
                  <button
                    onClick={() =>
                      runPrompt({
                        prompt: "Re-run current logic",
                        modelId: latestExecution?.modelId || "gemini-2.0-flash",
                      })
                    }
                    className="flex items-center gap-1.5 text-emerald-500 hover:text-foreground hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-all"
                  >
                    <Play className="size-3 fill-current" /> Run
                  </button>
                </div>
              </div>
              <div className="flex-1 p-5 font-mono text-[12px] bg-background overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
                <div className="flex gap-2.5 items-center mb-3">
                  <span className="px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-500 text-[10px] font-black tracking-tighter shadow-sm border border-emerald-500/20">
                    AGENT_ACTIVE
                  </span>
                  <span className="text-muted-foreground/40 text-[10px] tracking-wide">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-1.5 text-muted-foreground/90">
                  <div className="flex gap-2 items-center">
                    <span className="text-emerald-500 font-bold opacity-80">
                      ➜
                    </span>
                    <span className="text-primary font-bold tracking-tight">
                      vibecode
                    </span>
                    <span className="text-muted-foreground/50 font-bold">
                      on
                    </span>
                    <span className="text-muted-foreground font-bold">
                      session/{projectId.substring(0, 6)}
                    </span>
                    <span className="text-foreground italic font-medium ml-1">
                      vibe start --watch
                    </span>
                  </div>

                  {latestExecution ? (
                    <div className="mt-3 space-y-2 border-l border-border/30 pl-4 ml-1">
                      {latestExecution.errorMessage && (
                        <div className="text-red-400 bg-red-400/5 p-3 rounded-md border border-red-400/20 mt-3 font-sans text-xs">
                          <span className="font-bold flex items-center gap-2 mb-1">
                            <Square className="size-3 fill-current" /> Error
                            Stack:
                          </span>
                          {latestExecution.errorMessage}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 text-center py-8">
                      <div className="inline-block px-4 py-2 rounded-lg border border-border/40 bg-card/40 text-muted-foreground/60 text-[11px] font-bold tracking-[0.3em] uppercase">
                        No active processes
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
