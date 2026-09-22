import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  CircleX,
  ClipboardPaste,
  Copy,
  Download,
  FileUp,
  Info,
  Minus,
  Plus,
  Search,
  Wand2,
  TextWrap,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, FLAGS, type FlagCategory, type FlagDef } from "./data/catalog";
import { SAMPLES } from "./data/sample";
import { editorExtensions } from "./editor/extensions";
import { colorFor } from "./editor/gutter";
import { applyChrome } from "./editor/chrome";
import { THEMES, isThemeId, type ThemeId } from "./editor/themes";
import { formatConfig } from "./parse/format";
import { lineAt, parseConfig } from "./parse/parse";
import { validateConfig, type Severity } from "./parse/validate";

const STORAGE_KEY = "pravka:source";
const PREFS_KEY = "pravka:prefs";
const SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

type Prefs = {
  theme: ThemeId;
  wrap: boolean;
  scale: number;
  panelOpen: boolean;
};

function loadInitial() {
  try {
    return localStorage.getItem(STORAGE_KEY) || SAMPLES[1]?.source || SAMPLES[0]!.source;
  } catch {
    return SAMPLES[1]?.source || SAMPLES[0]!.source;
  }
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { theme: "zapret", wrap: true, scale: 1, panelOpen: true };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: parsed.theme && isThemeId(parsed.theme) ? parsed.theme : "zapret",
      wrap: parsed.wrap !== false,
      scale: SCALES.includes(parsed.scale as (typeof SCALES)[number]) ? parsed.scale! : 1,
      panelOpen: parsed.panelOpen !== false,
    };
  } catch {
    return { theme: "zapret", wrap: true, scale: 1, panelOpen: true };
  }
}

const bootPrefs = loadPrefs();
applyChrome(bootPrefs.theme);
document.documentElement.style.setProperty("--ui-scale", String(bootPrefs.scale));

function nearestScale(value: number, direction: 1 | -1) {
  const next = SCALES.find((scale) => (direction > 0 ? scale > value + 0.001 : scale >= value));
  if (direction > 0) return next ?? SCALES[SCALES.length - 1]!;
  const prev = [...SCALES].reverse().find((scale) => scale < value - 0.001);
  return prev ?? SCALES[0]!;
}

export default function App() {
  const prefs = useMemo(loadPrefs, []);
  const [source, setSource] = useState(loadInitial);
  const [query, setQuery] = useState("");
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [panelOpen, setPanelOpen] = useState(prefs.panelOpen);
  const [issueFilter, setIssueFilter] = useState<"all" | Severity>("all");
  const [theme, setTheme] = useState<ThemeId>(prefs.theme);
  const [wrap, setWrap] = useState(prefs.wrap);
  const [scale, setScale] = useState(prefs.scale);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseConfig(source), [source]);
  const issues = useMemo(() => validateConfig(parsed), [parsed]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const infos = issues.filter((issue) => issue.severity === "info");
  const visibleIssues = issues.filter((issue) => issueFilter === "all" || issue.severity === issueFilter);
  const kind = parsed.batch ? "config.bat" : parsed.flags.length ? "winws-args.txt" : "untitled";
  const extensions = useMemo(() => editorExtensions({ theme, wrap }), [theme, wrap]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, source);
      } catch {
        /* ignore quota */
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [source]);

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
    applyChrome(theme);
  }, [theme, scale]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, wrap, scale, panelOpen }));
    } catch {
      /* ignore quota */
    }
  }, [theme, wrap, scale, panelOpen]);

  const jump = useCallback((from: number) => {
    const view = editorRef.current?.view;
    if (!view) return;
    view.focus();
    view.dispatch({
      selection: { anchor: from },
      scrollIntoView: true,
    });
  }, []);

  const onFormat = () => setSource(formatConfig(parsed));
  const onCopy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  const onDownload = () => {
    const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = parsed.batch ? "zapret-config.bat" : "winws-args.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  const onOpen = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSource(reader.result.replaceAll("\r\n", "\n"));
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        onDownload();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "f") {
        event.preventDefault();
        onFormat();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "m") {
        event.preventDefault();
        setPanelOpen((open) => !open);
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && key === "z") {
        event.preventDefault();
        setWrap((value) => !value);
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setScale((value) => nearestScale(value, 1));
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        setScale((value) => nearestScale(value, -1));
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "0") {
        event.preventDefault();
        setScale(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const filteredFlags = FLAGS.filter((flag) => {
    if (!query.trim()) return true;
    const hay = `${flag.name} ${flag.syntax} ${flag.summary} ${flag.hint ?? ""} ${flag.values?.join(" ") ?? ""}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });
  const grouped = [...new Set(filteredFlags.map((flag) => flag.category))];

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          Prav<span>ka</span>
        </div>
        <div className="title-actions">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <FileUp /> Открыть
          </button>
          <button type="button" className="btn" onClick={onDownload}>
            <Download /> Сохранить
          </button>
          <button type="button" className="btn primary" onClick={onFormat}>
            <Wand2 /> Форматировать
          </button>
          <button type="button" className="btn" onClick={onCopy}>
            {copied ? <Check /> : <Copy />} {copied ? "Скопировано" : "Копировать"}
          </button>
          <button type="button" className="btn" onClick={() => navigator.clipboard.readText().then(setSource)}>
            <ClipboardPaste /> Вставить
          </button>
          <select
            className="ghost-select"
            defaultValue=""
            onChange={(event) => {
              const sample = SAMPLES.find((item) => item.id === event.target.value);
              if (sample) setSource(sample.source);
              event.target.value = "";
            }}
          >
            <option value="" disabled>
              Примеры
            </option>
            {SAMPLES.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.title}
              </option>
            ))}
          </select>
        </div>
        <div className="title-tools">
          <button
            type="button"
            className={`btn icon ${wrap ? "on" : ""}`}
            onClick={() => setWrap((value) => !value)}
            title="Перенос строк · Ctrl+Alt+Z"
            aria-label="Перенос строк"
          >
            <TextWrap />
          </button>
          <select
            className="ghost-select"
            value={theme}
            onChange={(event) => {
              if (isThemeId(event.target.value)) setTheme(event.target.value);
            }}
            title="Тема редактора"
            aria-label="Тема редактора"
          >
            {THEMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="zoom">
            <button
              type="button"
              className="btn icon"
              onClick={() => setScale((value) => nearestScale(value, -1))}
              title="Уменьшить · Ctrl+-"
              aria-label="Уменьшить масштаб"
            >
              <Minus />
            </button>
            <span className="zoom-value">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className="btn icon"
              onClick={() => setScale((value) => nearestScale(value, 1))}
              title="Увеличить · Ctrl+="
              aria-label="Увеличить масштаб"
            >
              <Plus />
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".bat,.cmd,.txt"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onOpen(file);
            event.target.value = "";
          }}
        />
      </header>

      <div className="workbench">
        <aside className="card sidebar">
          <div className="side-title">Оглавление</div>
          <div className="toc">
            {!parsed.flags.length && <div className="empty-hint">Нет флагов — вставьте конфиг или откройте файл.</div>}
            {parsed.preamble && (
              <button type="button" className="toc-item" onClick={() => jump(parsed.preamble!.from)}>
                <span className="toc-idx">·</span>
                <span className="toc-body">
                  <strong>Шапка</strong>
                  <span>до аргументов winws</span>
                </span>
                <span className="toc-line">{parsed.preamble.line}</span>
              </button>
            )}
            {parsed.globals.length > 0 && (
              <button type="button" className="toc-item" onClick={() => jump(parsed.globals[0]!.from)}>
                <span className="toc-idx">·</span>
                <span className="toc-body">
                  <strong>Ядро</strong>
                  <span>{parsed.globals.map((flag) => `--${flag.name}`).join(" ")}</span>
                </span>
                <span className="toc-line">{lineAt(source, parsed.globals[0]!.from)}</span>
              </button>
            )}
            {parsed.blocks.map((block) => (
              <button
                type="button"
                key={block.index}
                className={`toc-item ${activeBlock === block.index ? "active" : ""} ${block.skipped ? "skipped" : ""}`}
                onClick={() => {
                  setActiveBlock(block.index);
                  jump(block.from);
                }}
              >
                <span className="toc-idx" style={{ color: colorFor(block) }}>
                  {block.index + 1}
                </span>
                <span className="toc-body">
                  <strong>
                    {block.title}
                    {block.skipped ? " · skip" : ""}
                  </strong>
                  <span>{block.subtitle}</span>
                </span>
                <span className="toc-line">{block.line}</span>
              </button>
            ))}
          </div>
        </aside>

        <section
          className="card editor-col"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) onOpen(file);
          }}
        >
          <div className="editor-head">
            <strong>{kind}</strong>
            <span className="editor-meta">
              {parsed.blocks.length} блоков · {parsed.flags.length} флагов
            </span>
          </div>
          <div className="editor-wrap">
            <CodeMirror
              ref={editorRef}
              value={source}
              height="100%"
              theme="none"
              basicSetup={false}
              extensions={[extensions]}
              onChange={setSource}
            />
          </div>
        </section>

        <aside className="card sidebar docs">
          <div className="side-title">
            <BookOpen /> Справочник
          </div>
          <label className="search">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Флаг или режим"
            />
          </label>
          <div className="flag-scroll">
            {grouped.map((category) => (
              <FlagGroup key={category} category={category} flags={filteredFlags.filter((flag) => flag.category === category)} />
            ))}
          </div>
        </aside>
      </div>

      <section className={`card panel ${panelOpen ? "open" : ""}`}>
        <div className="panel-bar">
          <div className="panel-title">
            Проблемы
            {issues.length > 0 && <span className="count">{issues.length}</span>}
          </div>
          <div className="panel-filters">
            <FilterChip label="Все" active={issueFilter === "all"} count={issues.length} onClick={() => setIssueFilter("all")} />
            <FilterChip label="Ошибки" active={issueFilter === "error"} count={errors.length} tone="error" onClick={() => setIssueFilter("error")} />
            <FilterChip label="Предупреждения" active={issueFilter === "warning"} count={warnings.length} tone="warning" onClick={() => setIssueFilter("warning")} />
            <FilterChip label="Сведения" active={issueFilter === "info"} count={infos.length} tone="info" onClick={() => setIssueFilter("info")} />
          </div>
          <button
            type="button"
            className="btn icon panel-toggle"
            onClick={() => setPanelOpen((open) => !open)}
            aria-label={panelOpen ? "Свернуть панель" : "Развернуть панель"}
            title="Ctrl+Shift+M"
          >
            <ChevronDown style={panelOpen ? undefined : { transform: "rotate(180deg)" }} />
          </button>
        </div>
        {panelOpen && (
          <div className="problems">
            {visibleIssues.length === 0 && <div className="problems-empty">Проблем в текущем фильтре нет.</div>}
            {visibleIssues.map((issue, index) => (
              <button
                key={`${issue.from}-${index}`}
                type="button"
                className={`problem ${issue.severity}`}
                onClick={() => {
                  setPanelOpen(true);
                  jump(issue.from);
                }}
              >
                <SeverityIcon severity={issue.severity} />
                <span className="problem-msg">{issue.message}</span>
                <span className="problem-line">:{lineAt(source, issue.from)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "error") return <CircleX />;
  if (severity === "warning") return <CircleAlert />;
  return <Info />;
}

function FilterChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: Severity;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`filter-chip ${active ? "on" : ""} ${tone ?? ""}`} onClick={onClick}>
      {label}
      <span>{count}</span>
    </button>
  );
}

function FlagGroup({ category, flags }: { category: FlagCategory; flags: FlagDef[] }) {
  if (!flags.length) return null;
  return (
    <div className="flag-group">
      <div className="flag-cat">{CATEGORY_META[category].label}</div>
      {flags.map((flag) => (
        <article key={flag.name} className={`flag-card cat-${flag.category}`}>
          <code>--{flag.name}</code>
          <p>{flag.summary}</p>
          {flag.values?.length ? (
            <div className="value-chips">
              {flag.values.map((value) => (
                <code key={value}>{value}</code>
              ))}
            </div>
          ) : null}
          <div className="syntax">{flag.syntax}</div>
        </article>
      ))}
    </div>
  );
}
