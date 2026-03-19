// ** import types
import type { KeyboardEvent } from "react";
import type { Artifact, Execution } from "@repo/db";

// ** import core packages
import { Editor } from "@monaco-editor/react";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  FileCode,
  Folder,
  Github,
  Pencil,
  Plus,
  Terminal as TerminalIcon,
  MoreHorizontal,
  Square,
  Play,
  RotateCw,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

// ** import components
import { VibeAssistantThread } from "@/components/assistant/vibe-assistant-thread";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ExecutionCenterView } from "@/components/project/execution-workspace";
import { WorkspaceAppPreview } from "@/components/project/workspace-app-preview";
import { useExecutionData } from "@/components/project/use-execution-data";
import { WorkspaceInspector } from "@/components/project/workspace-inspector";
import { WorkspaceTopbar } from "@/components/project/workspace-topbar";
import {
  getAvailableWorkspaceSources,
  getDefaultWorkspaceSource,
  type WorkspaceMode,
  type WorkspaceSource,
} from "@/components/project/workspace-types";

// ** import hooks
import { useProjectActions } from "@/pages/project/hooks/use-project-actions";
import { useProjectData } from "@/pages/project/hooks/use-project-data";

// ** import apis
import { getArtifacts } from "@/rest-api/artifacts";
import { getModels } from "@/rest-api/models";

export default function Project() {
  const ASSISTANT_PANEL_WIDTH_KEY = "project-assistant-panel-width";
  const DEFAULT_ASSISTANT_PANEL_WIDTH = 380;
  const MIN_ASSISTANT_PANEL_WIDTH = 300;
  const MAX_ASSISTANT_PANEL_WIDTH = 560;

  const { id: projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const { project, workspace, threads, executions, isLoading } =
    useProjectData(projectId);
  const {
    renameProject,
    runPrompt,
    isPromptRunning,
    cancelPrompt,
    renameThread,
    deleteThread,
  } = useProjectActions({
    projectId,
    workspaceId: workspace?.id,
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(
    null,
  );
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
  const [isContextualInspectorOpen, setIsContextualInspectorOpen] =
    useState(true);
  const [assistantPanelWidth, setAssistantPanelWidth] = useState(
    DEFAULT_ASSISTANT_PANEL_WIDTH,
  );
  const [isResizingAssistantPanel, setIsResizingAssistantPanel] =
    useState(false);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [localProjectName, setLocalProjectName] = useState("");
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [selectedFile, setSelectedFile] = useState<Artifact | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("code");
  const [workspaceSource, setWorkspaceSource] =
    useState<WorkspaceSource>("execution_draft");
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const splitLayoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeExecutions.length === 0) {
      setSelectedExecutionId(null);
      return;
    }

    const hasSelectedExecution = activeExecutions.some(
      (execution) => execution.id === selectedExecutionId,
    );

    if (!hasSelectedExecution) {
      setSelectedExecutionId(
        activeExecutions[activeExecutions.length - 1]?.id ?? null,
      );
    }
  }, [activeExecutions, selectedExecutionId]);

  const selectedExecution = useMemo(
    () =>
      activeExecutions.find(
        (execution) => execution.id === selectedExecutionId,
      ) ?? null,
    [activeExecutions, selectedExecutionId],
  );
  const latestExecution = useMemo(
    () => activeExecutions[activeExecutions.length - 1] ?? null,
    [activeExecutions],
  );
  const previousExecution = useMemo<Execution | null>(() => {
    if (!selectedExecution) return null;
    const selectedIndex = activeExecutions.findIndex(
      (execution) => execution.id === selectedExecution.id,
    );
    if (selectedIndex <= 0) return null;
    return activeExecutions[selectedIndex - 1] ?? null;
  }, [activeExecutions, selectedExecution]);
  const { data: artifactsRes } = useQuery({
    queryKey: ["artifacts", selectedExecution?.id],
    queryFn: () =>
      selectedExecution?.id
        ? getArtifacts(selectedExecution.id)
        : Promise.resolve({ data: [] }),
    enabled: !!selectedExecution?.id,
  });
  const artifacts = useMemo(
    () =>
      (artifactsRes?.data || []).filter((artifact) => artifact.type === "file"),
    [artifactsRes?.data],
  );
  const { data: previousArtifactsRes } = useQuery({
    queryKey: ["artifacts", previousExecution?.id],
    queryFn: () =>
      previousExecution?.id
        ? getArtifacts(previousExecution.id)
        : Promise.resolve({ data: [] }),
    enabled: !!previousExecution?.id,
  });
  const previousArtifacts = useMemo(
    () =>
      (previousArtifactsRes?.data || []).filter(
        (artifact) => artifact.type === "file",
      ),
    [previousArtifactsRes?.data],
  );
  const displayedArtifacts = useMemo(
    () => (artifacts.length > 0 ? artifacts : previousArtifacts),
    [artifacts, previousArtifacts],
  );
  const editorTheme = resolvedTheme === "light" ? "vs" : "vs-dark";

  useEffect(() => {
    if (
      selectedExecution?.status === "running" ||
      selectedExecution?.status === "queued"
    ) {
      setWorkspaceMode("timeline");
    }

    // Auto-expand terminal on error
    if (selectedExecution?.status === "failed") {
      setIsTerminalExpanded(true);
    }
  }, [selectedExecution?.id, selectedExecution?.status]);

  const availableWorkspaceSources = useMemo(
    () => getAvailableWorkspaceSources(selectedExecution ?? null),
    [selectedExecution],
  );

  useEffect(() => {
    const nextSource = getDefaultWorkspaceSource(selectedExecution ?? null);
    setWorkspaceSource((current) =>
      availableWorkspaceSources.includes(current) ? current : nextSource,
    );
  }, [availableWorkspaceSources, selectedExecution]);

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

  const getVisibleEditorContext = (file: Artifact | null) => {
    if (!file) return undefined;

    const content = getEditorContent(file);

    return {
      activeFilePath: file.filePath || file.name,
      visibleContent: content.slice(0, 4000),
    };
  };

  const previewSource = useMemo(() => {
    const htmlArtifact = displayedArtifacts.find((artifact) =>
      artifact.name.toLowerCase().endsWith(".html"),
    );

    if (!htmlArtifact) return null;

    const resolveAssetPath = (basePath: string, target: string) => {
      if (
        !target ||
        /^(https?:)?\/\//i.test(target) ||
        target.startsWith("/")
      ) {
        return target.replace(/^\//, "");
      }

      const cleanTarget = target.split("?")[0]?.split("#")[0] || target;
      const baseParts = basePath.split("/").filter(Boolean);
      baseParts.pop();

      for (const part of cleanTarget.split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") {
          baseParts.pop();
          continue;
        }
        baseParts.push(part);
      }

      return baseParts.join("/");
    };

    const readArtifact = (filePath: string) => {
      const match = displayedArtifacts.find(
        (artifact) =>
          artifact.filePath === filePath || artifact.name === filePath,
      );
      if (!match?.metadata) return null;

      try {
        const metadata = JSON.parse(match.metadata) as { content?: unknown };
        return typeof metadata.content === "string" ? metadata.content : null;
      } catch {
        return null;
      }
    };

    try {
      const metadata = htmlArtifact.metadata
        ? JSON.parse(htmlArtifact.metadata)
        : null;
      if (metadata?.content && typeof metadata.content === "string") {
        let html = metadata.content as string;

        html = html.replace(
          /<link\s+([^>]*?)rel=["']stylesheet["']([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
          (
            full,
            before: string,
            middle: string,
            href: string,
            after: string,
          ) => {
            if (/^(https?:)?\/\//i.test(href)) return full;
            const css = readArtifact(
              resolveAssetPath(
                htmlArtifact.filePath || htmlArtifact.name,
                href,
              ),
            );
            if (!css) return full;
            const attrs = `${before}${middle}${after}`.trim();
            return `<style data-preview-inline="${href}"${attrs ? ` ${attrs}` : ""}>${css}</style>`;
          },
        );

        html = html.replace(
          /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)><\/script>/gi,
          (full, before: string, src: string, after: string) => {
            if (/^(https?:)?\/\//i.test(src)) return full;
            const js = readArtifact(
              resolveAssetPath(htmlArtifact.filePath || htmlArtifact.name, src),
            );
            if (!js) return full;
            const attrs = `${before}${after}`.trim();
            return `<script data-preview-inline="${src}"${attrs ? ` ${attrs}` : ""}>${js}<\/script>`;
          },
        );

        html = html.replace("</head>", `<base href="about:srcdoc" />\n</head>`);

        html = html.replace(
          "</body>",
          `<script>
document.addEventListener("click", function (event) {
  var link = event.target instanceof Element ? event.target.closest("a") : null;
  if (!link) return;
  var href = link.getAttribute("href") || "";
  if (!href || href.startsWith("#") || href.startsWith("javascript:") || /^(https?:|mailto:|tel:)/i.test(href)) {
    return;
  }
  event.preventDefault();
});
</script>\n</body>`,
        );

        return html;
      }
    } catch {
      return null;
    }

    return null;
  }, [displayedArtifacts]);

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
    if (displayedArtifacts.length === 0) {
      setSelectedFile(null);
      return;
    }

    if (
      selectedFile &&
      displayedArtifacts.some((artifact) => artifact.id === selectedFile.id)
    ) {
      return;
    }

    const mainFile =
      displayedArtifacts.find(
        (a) => a.name.includes("App") || a.name.includes("index"),
      ) || displayedArtifacts[0];
    setSelectedFile(mainFile);
  }, [displayedArtifacts, selectedFile]);

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
  const executionData = useExecutionData({
    execution: selectedExecution,
    previousExecution,
    artifacts,
    previousArtifacts,
  });

  const onOpenFile = (path: string) => {
    const match = displayedArtifacts.find(
      (artifact) => artifact.filePath === path || artifact.name === path,
    );
    if (match) {
      setSelectedFile(match);
    }
  };

  const handleWorkspacePrimaryAction = () => {
    if (workspaceSource === "main") {
      setWorkspaceMode("app");
      return;
    }

    if (
      workspaceSource === "execution_draft" &&
      selectedExecution?.mergedCommitHash &&
      availableWorkspaceSources.includes("main")
    ) {
      setWorkspaceSource("main");
      return;
    }

    setWorkspaceMode("review");
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
            className={`relative flex flex-col border-r border-border/30 bg-card/15 transition-[width] duration-200 ease-out ${isAssistantPanelOpen ? "overflow-visible" : "overflow-hidden border-transparent"}`}
            style={{
              width: isAssistantPanelOpen ? `${assistantPanelWidth}px` : "0px",
            }}
          >
            <div className="flex h-8 min-w-0 items-center justify-between border-b border-border/30 px-2.5">
              <div className="flex items-center gap-2">
                <Link
                  to="/apps"
                  className="group rounded-md p-1.5 transition-colors hover:bg-secondary/50"
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
                    className="bg-transparent outline-none border-b border-foreground/30 text-sm font-semibold text-foreground px-0.5 w-36"
                  />
                ) : (
                  <div
                    className="flex items-center gap-1 group cursor-pointer"
                    onClick={() => setIsEditingProjectName(true)}
                  >
                    <span className="max-w-36 truncate text-sm font-medium text-foreground/90">
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
                selectedExecutionId={selectedExecutionId}
                onSelectThread={(id) => {
                  setActiveThreadId(id);
                  setHasManuallySelectedThread(true);
                }}
                onSelectExecution={setSelectedExecutionId}
                onShowTimeline={(execId) => {
                  setSelectedExecutionId(execId);
                  setWorkspaceMode("timeline");
                }}
                onSendPrompt={(prompt, modelId) =>
                  runPrompt(
                    {
                      prompt,
                      modelId,
                      threadId: activeThreadId || undefined,
                      editorContext: getVisibleEditorContext(selectedFile),
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
            <WorkspaceTopbar
              execution={selectedExecution}
              workspaceMode={workspaceMode}
              workspaceSource={workspaceSource}
              sourceOptions={availableWorkspaceSources}
              isAssistantPanelOpen={isAssistantPanelOpen}
              isInspectorOpen={isContextualInspectorOpen}
              onWorkspaceModeChange={setWorkspaceMode}
              onWorkspaceSourceChange={setWorkspaceSource}
              onToggleAssistant={() =>
                setIsAssistantPanelOpen(!isAssistantPanelOpen)
              }
              onToggleInspector={() =>
                setIsContextualInspectorOpen(!isContextualInspectorOpen)
              }
              onPrimaryAction={handleWorkspacePrimaryAction}
            />

            {/* Editor Area */}
            <div className="flex-1 flex min-h-0 bg-background">
              {/* Explorer + Editor (Code Mode) */}
              {workspaceMode === "code" ? (
                <>
                  <div className="flex w-52 shrink-0 flex-col border-r border-border/30 bg-card/15">
                    <div className="flex h-8 items-center justify-between border-b border-border/30 bg-muted/10 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                      Explorer
                      <RotateCw
                        onClick={handleRefresh}
                        className="size-3 cursor-pointer hover:text-primary transition-all active:rotate-180"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
                      <div className="group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/20">
                        <ChevronDown className="size-3 group-hover:text-foreground transition-colors" />
                        <Folder className="size-3.5 text-muted-foreground/80" />
                        <span className="font-semibold group-hover:text-foreground tracking-tight">
                          src
                        </span>
                      </div>
                      {displayedArtifacts.length === 0 ? (
                        <div className="px-8 py-3 text-xs text-muted-foreground/50 italic font-medium">
                          No files synthesized
                        </div>
                      ) : (
                        displayedArtifacts.map((file) => (
                          <div
                            key={file.id}
                            onClick={() => setSelectedFile(file)}
                            className={`flex cursor-pointer items-center gap-2 border-r-2 px-6 py-1.5 text-xs transition-colors ${selectedFile?.id === file.id ? "border-primary bg-primary/6 font-medium text-primary" : "border-transparent text-muted-foreground/80 hover:bg-secondary/15 hover:text-foreground"}`}
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

                  <div className="flex-1 flex flex-col min-w-0 bg-background">
                    <div className="flex h-8 items-center gap-0.5 border-b border-border/30 bg-card/15 px-1">
                      {selectedFile ? (
                        <div className="flex h-full items-center gap-2.5 border-t-2 border-primary bg-card/60 px-4 text-xs font-medium text-foreground animate-in slide-in-from-top-1 duration-300">
                          <FileCode className="size-3.5 text-primary" />
                          {selectedFile.name}
                        </div>
                      ) : (
                        <div className="h-full flex items-center gap-2.5 px-4 italic text-muted-foreground text-xs opacity-50">
                          No file open
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-1 px-2 text-xs text-muted-foreground">
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
                  </div>
                </>
              ) : null}

              {/* App Mode */}
              {workspaceMode === "app" ? (
                <WorkspaceAppPreview
                  execution={selectedExecution}
                  workspaceSource={workspaceSource}
                  previewSource={previewSource}
                  hasPreviewArtifact={displayedArtifacts.some((artifact) =>
                    artifact.name.toLowerCase().endsWith(".html"),
                  )}
                  onOpenCode={() => setWorkspaceMode("code")}
                  onOpenReview={() => setWorkspaceMode("review")}
                  onRun={() =>
                    runPrompt({
                      prompt: "Re-run current logic",
                      modelId:
                        selectedExecution?.modelId || "gemini-3-flash-preview",
                      threadId: activeThreadId || undefined,
                      editorContext: getVisibleEditorContext(selectedFile),
                    })
                  }
                />
              ) : null}

              {/* Dynamic Center View for Details/Timeline/Review */}
              {["details", "timeline", "review"].includes(workspaceMode) ? (
                <ExecutionCenterView
                  workspaceMode={workspaceMode}
                  data={executionData}
                  editorTheme={editorTheme}
                  onOpenFile={onOpenFile}
                />
              ) : null}

              {/* Contextual Inspector */}
              {isContextualInspectorOpen && (
                <WorkspaceInspector
                  workspaceMode={workspaceMode}
                  workspaceSource={workspaceSource}
                  execution={selectedExecution}
                  selectedFile={selectedFile}
                  executionData={executionData}
                  onOpenFile={onOpenFile}
                />
              )}
            </div>

            {/* Terminal Area */}
            <footer
              className={[
                "border-t border-border/40 bg-card/20 flex flex-col z-20 transition-all duration-300 ease-in-out",
                isTerminalExpanded ? "h-64" : "h-10",
              ].join(" ")}
            >
              <div
                className="h-10 flex items-center px-4 border-b border-border/40 gap-6 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/30 select-none shrink-0"
                onClick={() => setIsTerminalExpanded((prev) => !prev)}
              >
                <div className="flex items-center gap-2 text-primary border-b-2 border-primary h-full px-1">
                  <TerminalIcon className="size-3.5" /> Terminal
                </div>
                <span className="hover:text-foreground transition-colors flex items-center h-full">
                  Output
                </span>
                <span className="hover:text-foreground transition-colors flex items-center h-full">
                  Debug
                </span>

                <div className="ml-auto flex items-center gap-5">
                  {(selectedExecution?.status === "running" ||
                    selectedExecution?.status === "queued") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelPrompt(selectedExecution.id);
                      }}
                      className="flex items-center gap-1.5 text-destructive hover:text-destructive-foreground hover:bg-destructive/20 px-2.5 py-1 rounded transition-all"
                    >
                      <Square className="size-3.5 fill-current" /> Stop
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      runPrompt({
                        prompt: "Re-run current logic",
                        modelId:
                          selectedExecution?.modelId ||
                          "gemini-3-flash-preview",
                        threadId: activeThreadId || undefined,
                        editorContext: getVisibleEditorContext(selectedFile),
                      });
                    }}
                    className="flex items-center gap-1.5 text-vibe-success hover:text-foreground hover:bg-vibe-success/20 px-2.5 py-1 rounded transition-all"
                  >
                    <Play className="size-3.5 fill-current" /> Run
                  </button>
                </div>
              </div>

              {isTerminalExpanded && (
                <div className="flex-1 p-5 font-mono text-xs bg-background overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
                  <div className="flex gap-2.5 items-center mb-3">
                    <span className="px-2 py-0.5 rounded-sm bg-vibe-success/10 text-vibe-success text-[10px] font-black tracking-tighter shadow-sm border border-vibe-success/20">
                      AGENT_ACTIVE
                    </span>
                    <span className="text-muted-foreground/40 text-[10px] tracking-wide">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-muted-foreground/90">
                    <div className="flex gap-2 items-center">
                      <span className="text-vibe-success font-bold opacity-80">
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

                    {selectedExecution?.status === "running" ||
                    selectedExecution?.status === "queued" ? (
                      <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 font-sans text-xs text-foreground/80">
                        <div className="flex items-center gap-2 font-medium text-foreground/90">
                          <Bot className="size-3.5 text-primary" />
                          Timeline is live in the right inspector panel.
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          Open the Timeline tab to inspect thoughts, tool calls,
                          sub-agents, and changes.
                        </div>
                      </div>
                    ) : null}

                    {selectedExecution ? (
                      <div className="mt-3 space-y-2 border-l border-border/30 pl-4 ml-1">
                        {selectedExecution.errorMessage && (
                          <div className="text-red-400 bg-red-400/5 p-3 rounded-md border border-red-400/20 mt-3 font-sans text-xs">
                            <span className="font-bold flex items-center gap-2 mb-1">
                              <Square className="size-3 fill-current" /> Error
                              Stack:
                            </span>
                            {selectedExecution.errorMessage}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-6 text-center py-8">
                        <div className="inline-block px-4 py-2 rounded-lg border border-border/40 bg-card/40 text-muted-foreground/60 text-xs font-bold tracking-widest uppercase">
                          No active processes
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </footer>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
