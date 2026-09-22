import type { FlagUse, ParsedConfig } from "./parse";

export function formatConfig(parsed: ParsedConfig): string {
  const { source, flags, winwsFrom } = parsed;
  if (!flags.length) return source;

  const firstFlag = flags[0]!;
  const prefixEnd = winwsFrom != null
    ? findArgsStart(source, winwsFrom)
    : firstFlag.from;
  const prefix = source.slice(0, prefixEnd).replace(/\s+$/, "");

  const last = flags[flags.length - 1]!;
  let suffix = source.slice(last.to);
  suffix = suffix.replace(/^\s+/, "");
  if (suffix.startsWith("^")) suffix = suffix.replace(/^\^\s*/, "");
  suffix = suffix.trim();
  if (suffix && !/^(::|rem\b|@rem\b)/i.test(suffix)) {
    suffix = `:: ${suffix.replaceAll("\n", " ")}`;
  }

  const globals: FlagUse[] = [];
  const strategies: FlagUse[][] = [[]];
  for (const flag of flags) {
    if (flag.name === "new") {
      strategies.push([]);
      continue;
    }
    const isGlobal =
      strategies.length === 1 &&
      strategies[0]!.length === 0 &&
      (flag.name.startsWith("wf-") ||
        flag.name === "ssid-filter" ||
        flag.name === "nlm-filter" ||
        flag.name === "nlm-list" ||
        flag.name === "debug");
    if (isGlobal) globals.push(flag);
    else strategies[strategies.length - 1]!.push(flag);
  }

  const lines: string[] = [];
  if (globals.length) {
    lines.push(renderFlags(globals));
  }

  const nonempty = strategies.filter((chunk, index) => chunk.length > 0 || index === 0);
  nonempty.forEach((chunk, index) => {
    if (!chunk.length) return;
    const body = renderFlags(chunk);
    const more = index < nonempty.length - 1 && nonempty.slice(index + 1).some((c) => c.length);
    lines.push(more ? `${body} --new` : body);
  });

  const wrapped = wrapLines(lines);
  const head = prefix ? `${prefix} ` : "";
  const tail = suffix.trim() ? `\n${suffix.trimEnd()}\n` : "\n";
  return `${head}${wrapped}${tail}`;
}

function findArgsStart(source: string, exeFrom: number) {
  let i = exeFrom;
  while (i < source.length && source[i] !== "\n") {
    if (source.startsWith("--", i)) return i;
    i += 1;
  }
  const next = source.indexOf("--", exeFrom);
  return next === -1 ? exeFrom : next;
}

function renderFlags(flags: FlagUse[]) {
  return flags
    .map((flag) => {
      if (flag.value === undefined) return `--${flag.name}`;
      const needsQuote = /[\s]/.test(flag.value) || /[%]/.test(flag.value) || /[\\/]/.test(flag.value);
      const value = needsQuote && !/^".*"$/.test(flag.value) ? `"${flag.value}"` : flag.value;
      return `--${flag.name}=${value}`;
    })
    .join(" ");
}

function wrapLines(lines: string[]) {
  return lines
    .map((line, index) => (index < lines.length - 1 ? `${line} ^` : line))
    .join("\n");
}
