import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  CircleX,
  ClipboardPaste,
  Code2,
  Copy,
  Download,
  FileUp,
  Info,
  ListTree,
  Minus,
  Plus,
  Search,
  Wand2,
  TextWrap,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CATEGORY_META, FLAGS, type FlagCategory, type FlagDef } from "./data/catalog";
import { DEFAULT_SAMPLE, SAMPLES } from "./data/sample";
import { chromeOf, applyChrome } from "./editor/chrome";
import { editorExtensions } from "./editor/extensions";
import { colorFor } from "./editor/gutter";
import { THEMES, isThemeId, type ThemeId } from "./editor/themes";
import { formatConfig } from "./parse/format";
import { lineAt, parseConfig } from "./parse/parse";
import { validateConfig, type Severity } from "./parse/validate";
import { Menu } from "./ui/Menu";
import { Splitter } from "./ui/Splitter";

const STORAGE_KEY = "pravka:source";
const PREV_KEY = "pravka:previous";
const PREFS_KEY = "pravka:prefs";
const SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;
const LEFT_DEFAULT = 248;
const RIGHT_DEFAULT = 300;
const PANEL_DEFAULT = 176;

type MobilePane = "toc" | "editor" | "docs";

type Prefs = {
  theme: ThemeId;
  wrap: boolean;
  scale: number;
  panelOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  panelHeight: number;
  mobilePane: MobilePane;
};

const defaultPrefs = (): Prefs => ({
  theme: "zapret",
  wrap: true,
  scale: 1,
  panelOpen: true,
  leftWidth: LEFT_DEFAULT,
  rightWidth: RIGHT_DEFAULT,
  panelHeight: PANEL_DEFAULT,
  mobilePane: "editor",
});

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota */
  }
}

function loadInitial() {
  return readStorage(STORAGE_KEY) || DEFAULT_SAMPLE.source;
}

function loadPrevious() {
  return readStorage(PREV_KEY);
}

function loadPrefs(): Prefs {
  const fallback = defaultPrefs();
  try {
    const raw = readStorage(PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const pane = parsed.mobilePane;
    return {
      theme: parsed.theme && isThemeId(parsed.theme) ? parsed.theme : fallback.theme,
      wrap: parsed.wrap !== false,
      scale: SCALES.includes(parsed.scale as (typeof SCALES)[number]) ? parsed.scale! : fallback.scale,
      panelOpen: parsed.panelOpen !== false,
      leftWidth: clamp(parsed.leftWidth ?? fallback.leftWidth, 168, 420),
      rightWidth: clamp(parsed.rightWidth ?? fallback.rightWidth, 220, 460),
      panelHeight: clamp(parsed.panelHeight ?? fallback.panelHeight, 96, 420),
      mobilePane: pane === "toc" || pane === "docs" || pane === "editor" ? pane : fallback.mobilePane,
    };
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const [leftWidth, setLeftWidth] = useState(prefs.leftWidth);
  const [rightWidth, setRightWidth] = useState(prefs.rightWidth);
  const [panelHeight, setPanelHeight] = useState(prefs.panelHeight);
  const [mobilePane, setMobilePane] = useState<MobilePane>(prefs.mobilePane);
  const [previous, setPrevious] = useState(loadPrevious);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const parsed = useMemo(() => parseConfig(source), [source]);
  const issues = useMemo(() => validateConfig(parsed), [parsed]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const infos = issues.filter((issue) => issue.severity === "info");
  const visibleIssues = issues.filter((issue) => issueFilter === "all" || issue.severity === issueFilter);
  const kind = parsed.batch ? "config.bat" : parsed.flags.length ? "winws-args.txt" : "untitled";
  const extensions = useMemo(() => editorExtensions({ theme, wrap }), [theme, wrap]);

  const persistSource = useCallback((text: string) => writeStorage(STORAGE_KEY, text), []);

  const replaceSource = useCallback(
    (next: string) => {
      const current = sourceRef.current;
      if (next === current) return;
      writeStorage(PREV_KEY, current);
      setPrevious(current);
      setSource(next);
      persistSource(next);
    },
    [persistSource],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => persistSource(source), 120);
    return () => window.clearTimeout(timer);
  }, [source, persistSource]);

  useEffect(() => {
    const flush = () => persistSource(sourceRef.current);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [persistSource]);

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
    applyChrome(theme);
  }, [theme, scale]);

  useEffect(() => {
    writeStorage(
      PREFS_KEY,
      JSON.stringify({ theme, wrap, scale, panelOpen, leftWidth, rightWidth, panelHeight, mobilePane }),
    );
  }, [theme, wrap, scale, panelOpen, leftWidth, rightWidth, panelHeight, mobilePane]);

  const jump = useCallback((from: number) => {
    setMobilePane("editor");
    const go = () => {
      const view = editorRef.current?.view;
      if (!view) return;
      view.focus();
      view.dispatch({
        selection: { anchor: from },
        scrollIntoView: true,
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
  }, []);

  const onFormat = () => replaceSource(formatConfig(parsed));
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
      if (typeof reader.result === "string") replaceSource(reader.result.replaceAll("\r\n", "\n"));
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
            <FileUp /> <span className="btn-label">Открыть</span>
          </button>
          <button type="button" className="btn" onClick={onDownload}>
            <Download /> <span className="btn-label">Сохранить</span>
          </button>
          <button type="button" className="btn primary" onClick={onFormat}>
            <Wand2 /> <span className="btn-label">Форматировать</span>
          </button>
          <button type="button" className="btn" onClick={onCopy}>
            {copied ? <Check /> : <Copy />} <span className="btn-label">{copied ? "Скопировано" : "Копировать"}</span>
          </button>
          <button type="button" className="btn" onClick={() => navigator.clipboard.readText().then(replaceSource)}>
            <ClipboardPaste /> <span className="btn-label">Вставить</span>
          </button>
          <Menu
            label="Примеры"
            options={[
              ...(previous
                ? [{ id: "previous", label: "Последние правки", hint: "Вернуть текст до замены" }]
                : []),
              ...SAMPLES.map((sample) => ({ id: sample.id, label: sample.title, hint: sample.hint })),
            ]}
            onSelect={(id) => {
              if (id === "previous") {
                const draft = loadPrevious();
                if (draft) replaceSource(draft);
                return;
              }
              const sample = SAMPLES.find((item) => item.id === id);
              if (sample) replaceSource(sample.source);
            }}
          />
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
          <Menu
            value={theme}
            align="right"
            title="Тема редактора"
            options={THEMES.map((item) => {
              const chrome = chromeOf(item.id);
              return {
                id: item.id,
                label: item.label,
                hint: item.dark ? "тёмная" : "светлая",
                swatch: chrome["--editor"],
                accent: chrome["--accent"],
              };
            })}
            onSelect={(id) => {
              if (isThemeId(id)) setTheme(id);
            }}
          />
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

      <nav className="mobile-nav" aria-label="Разделы">
        <button type="button" className={mobilePane === "toc" ? "on" : ""} onClick={() => setMobilePane("toc")}>
          <ListTree /> Блоки
        </button>
        <button type="button" className={mobilePane === "editor" ? "on" : ""} onClick={() => setMobilePane("editor")}>
          <Code2 /> Текст
        </button>
        <button type="button" className={mobilePane === "docs" ? "on" : ""} onClick={() => setMobilePane("docs")}>
          <BookOpen /> Справка
        </button>
      </nav>

      <div className="workbench" data-pane={mobilePane}>
        <aside className="card sidebar pane-toc" style={{ width: `calc(${leftWidth}px * var(--ui-scale))` }}>
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

        <Splitter axis="x" onDelta={(delta) => setLeftWidth((width) => clamp(width + delta / scale, 168, 420))} />

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

        <Splitter axis="x" onDelta={(delta) => setRightWidth((width) => clamp(width - delta / scale, 220, 460))} />

        <aside className="card sidebar docs" style={{ width: `calc(${rightWidth}px * var(--ui-scale))` }}>
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

      <section
        className={`card panel ${panelOpen ? "open" : ""}`}
        style={{ "--panel-h": `${panelHeight}px` } as CSSProperties}
      >
        {panelOpen && (
          <Splitter
            axis="y"
            className="panel-resizer"
            onDelta={(delta) => setPanelHeight((height) => clamp(height - delta / scale, 96, 420))}
          />
        )}
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
            <ChevronDown className={panelOpen ? undefined : "is-collapsed"} />
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
