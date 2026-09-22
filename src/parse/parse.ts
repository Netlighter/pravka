import { tokenize, type Token } from "./tokenize";

export interface FlagUse {
  name: string;
  value?: string;
  from: number;
  to: number;
  raw: string;
}

export interface Block {
  index: number;
  from: number;
  to: number;
  line: number;
  skipped: boolean;
  flags: FlagUse[];
  tcp?: string;
  udp?: string;
  l7?: string;
  l3?: string;
  desync?: string;
  fooling?: string;
  hostlists: string[];
  hostDomains: string[];
  ipsets: string[];
  fakes: string[];
  title: string;
  subtitle: string;
}

export interface RangeMark {
  from: number;
  to: number;
  line: number;
}

export interface ParsedConfig {
  source: string;
  tokens: Token[];
  flags: FlagUse[];
  globals: FlagUse[];
  blocks: Block[];
  preamble: RangeMark | null;
  batch: boolean;
  winwsFrom: number | null;
}

export function parseConfig(source: string): ParsedConfig {
  const tokens = tokenize(source);
  const flags = collectFlags(source, tokens);
  const batch = /^\s*@?echo\b/im.test(source) || /winws\.exe/i.test(source);
  const winws = tokens.find((token) => token.type === "exe" && /winws/i.test(token.text));

  const chunks: FlagUse[][] = [[]];
  for (const flag of flags) {
    if (flag.name === "new") {
      chunks.push([]);
      continue;
    }
    chunks[chunks.length - 1]!.push(flag);
  }

  const first = chunks[0] ?? [];
  const globals = first.filter((flag) => flag.name.startsWith("wf-") || flag.name === "ssid-filter" || flag.name === "nlm-filter" || flag.name === "nlm-list" || flag.name === "debug" || flag.name === "dry-run" || flag.name === "comment");
  const firstBlockFlags = first.filter((flag) => !globals.includes(flag));

  const blocks: Block[] = [];
  let runningFrom = flags[0]?.from ?? winws?.to ?? 0;

  const material = [firstBlockFlags, ...chunks.slice(1)];
  material.forEach((chunk, index) => {
    if (index === 0 && chunk.length === 0 && material.length > 1) return;
    const from = chunk[0]?.from ?? runningFrom;
    const last = chunk[chunk.length - 1];
    const to = last?.to ?? from;
    blocks.push(makeBlock(index, from, to, chunk, source));
    runningFrom = to;
  });

  const firstCode = globals[0]?.from ?? blocks[0]?.from ?? 0;
  const preamble =
    firstCode > 0 && /\S/.test(source.slice(0, firstCode))
      ? { from: 0, to: firstCode, line: 1 }
      : null;

  return {
    source,
    tokens,
    flags,
    globals,
    blocks,
    preamble,
    batch,
    winwsFrom: winws?.from ?? null,
  };
}

function collectFlags(source: string, tokens: Token[]): FlagUse[] {
  const flags: FlagUse[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token.type.startsWith("flag-") || !token.flag) continue;
    let value: string | undefined;
    let to = token.to;
    if (tokens[i + 1]?.type === "operator" && tokens[i + 1]?.text === "=") {
      const parts: string[] = [];
      let j = i + 2;
      while (j < tokens.length) {
        const next = tokens[j]!;
        if (next.type.startsWith("flag-") || next.type === "continuation" || next.type === "comment" || next.type === "junk") break;
        if (next.type === "keyword" || next.type === "exe") break;
        if (next.from > to && /[\n]/.test(source.slice(to, next.from)) && source.slice(to, next.from).includes("\n") && !source.slice(0, next.from).trimEnd().endsWith("^")) {
          break;
        }
        parts.push(next.text);
        to = next.to;
        j += 1;
      }
      value = parts.join("").replace(/^["']|["']$/g, "");
    }
    flags.push({
      name: token.flag,
      value,
      from: token.from,
      to,
      raw: source.slice(token.from, to),
    });
  }
  return flags;
}

function makeBlock(index: number, from: number, to: number, flags: FlagUse[], source: string): Block {
  const pick = (name: string) => flags.find((flag) => flag.name === name)?.value;
  const all = (name: string) => flags.filter((flag) => flag.name === name).map((flag) => flag.value).filter(Boolean) as string[];
  const tcp = pick("filter-tcp");
  const udp = pick("filter-udp");
  const l7 = pick("filter-l7");
  const l3 = pick("filter-l3");
  const desync = pick("dpi-desync");
  const fooling = pick("dpi-desync-fooling");
  const hostlists = [...all("hostlist"), ...all("hostlist-exclude")];
  const hostDomains = [...all("hostlist-domains"), ...all("hostlist-exclude-domains")];
  const ipsets = [...all("ipset"), ...all("ipset-exclude"), ...all("ipset-ip")];
  const fakes = flags
    .filter((flag) => flag.name.startsWith("dpi-desync-fake-") && flag.value)
    .map((flag) => `${flag.name.replace("dpi-desync-fake-", "")}:${baseName(flag.value!)}`);

  const titleParts: string[] = [];
  if (tcp) titleParts.push(`TCP ${shortPorts(tcp)}`);
  if (udp) titleParts.push(`UDP ${shortPorts(udp)}`);
  if (l7) titleParts.push(l7);
  if (!titleParts.length) titleParts.push(`Блок ${index + 1}`);

  const sub: string[] = [];
  if (desync) sub.push(desync);
  if (fooling) sub.push(fooling);
  if (hostDomains.length) sub.push(hostDomains[0]!);
  else if (hostlists.length) sub.push(baseName(hostlists[0]!));
  else if (ipsets.length) sub.push(baseName(ipsets[0]!));

  return {
    index,
    from,
    to,
    line: lineAt(source, from),
    skipped: flags.some((flag) => flag.name === "skip"),
    flags,
    tcp,
    udp,
    l7,
    l3,
    desync,
    fooling,
    hostlists,
    hostDomains,
    ipsets,
    fakes,
    title: titleParts.join(" · "),
    subtitle: sub.join(" · ") || "без desync",
  };
}

function shortPorts(value: string) {
  if (value.length <= 22) return value;
  return `${value.slice(0, 20)}…`;
}

function baseName(path: string) {
  return path.replace(/^["']|["']$/g, "").split(/[\\/]/).pop() ?? path;
}

export function lineAt(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}
