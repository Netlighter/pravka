import { FLAG_BY_NAME, type FlagCategory } from "../data/catalog";
import {
  BATCH_KEYWORDS,
  DESYNC_MODES,
  FOOLING,
  L7_PROTOS,
  SPLIT_MARKERS,
} from "../data/enums";

export type TokenType =
  | "comment"
  | "keyword"
  | "variable"
  | "string"
  | "continuation"
  | "operator"
  | "number"
  | "port"
  | "path"
  | "exe"
  | "flag-control"
  | "flag-windivert"
  | "flag-filter"
  | "flag-hostlist"
  | "flag-ipset"
  | "flag-desync"
  | "flag-fake"
  | "flag-split"
  | "flag-dup"
  | "flag-orig"
  | "flag-http"
  | "flag-misc"
  | "flag-linux"
  | "flag-unknown"
  | "value-mode"
  | "value-proto"
  | "value-fooling"
  | "value-marker"
  | "value-bool"
  | "hex"
  | "junk"
  | "text";

export interface Token {
  type: TokenType;
  text: string;
  from: number;
  to: number;
  flag?: string;
}

const KEYWORDS = new Set(BATCH_KEYWORDS.map((k) => k.toLowerCase()));
const DESYNC = new Set<string>(DESYNC_MODES);
const FOOL = new Set<string>(FOOLING);
const PROTOS = new Set<string>(L7_PROTOS);
const MARKERS = new Set<string>(SPLIT_MARKERS);

const CATEGORY_TOKEN: Record<FlagCategory, TokenType> = {
  control: "flag-control",
  windivert: "flag-windivert",
  filter: "flag-filter",
  hostlist: "flag-hostlist",
  ipset: "flag-ipset",
  desync: "flag-desync",
  fake: "flag-fake",
  split: "flag-split",
  dup: "flag-dup",
  orig: "flag-orig",
  http: "flag-http",
  misc: "flag-misc",
  linux: "flag-linux",
};

function flagToken(name: string): TokenType {
  const def = FLAG_BY_NAME.get(name);
  if (!def) return "flag-unknown";
  return CATEGORY_TOKEN[def.category];
}

function peekWord(src: string, i: number) {
  let j = i;
  while (j < src.length && /[A-Za-z0-9_.-]/.test(src[j]!)) j += 1;
  return src.slice(i, j);
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let inWinwsArgs = false;
  let pendingValue: string | null = null;
  let lineStart = 0;
  let continued = false;

  const push = (
    type: TokenType,
    from: number,
    to: number,
    flag?: string,
  ) => {
    tokens.push({ type, text: source.slice(from, to), from, to, flag });
  };

  while (i < source.length) {
    const ch = source[i]!;

    if (ch === "\n") {
      const line = source.slice(lineStart, i);
      const trimmed = line.replace(/\s+$/, "");
      continued = /(?:^|[^\\])\^$/.test(trimmed) || / \^$/.test(trimmed) || trimmed.endsWith("^");
      if (!continued) {
        inWinwsArgs = false;
        pendingValue = null;
      }
      i += 1;
      lineStart = i;
      continue;
    }

    if (ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }

    const atLine = i === lineStart || source.slice(lineStart, i).trim() === "";

    if (atLine && source.startsWith("::", i)) {
      const end = endOfLine(source, i);
      push("comment", i, end);
      i = end;
      continue;
    }

    if (atLine) {
      const word = peekWord(source, i).toLowerCase();
      if (word === "rem" || word === "@rem") {
        const end = endOfLine(source, i);
        push("comment", i, end);
        i = end;
        continue;
      }
    }

    if (ch === "^") {
      const rest = source.slice(i + 1, endOfLine(source, i)).trim();
      if (rest === "" || rest.startsWith("\r")) {
        push("continuation", i, i + 1);
        i += 1;
        continue;
      }
    }

    if (ch === "%" || ch === "!") {
      const close = ch;
      let j = i + 1;
      while (j < source.length && source[j] !== close && source[j] !== "\n") j += 1;
      if (source[j] === close) {
        push("variable", i, j + 1);
        i = j + 1;
        continue;
      }
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < source.length && source[j] !== "\n") {
        if (source[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      const body = source.slice(i, j);
      const type: TokenType = /\.(exe|bin|txt|flt|dat)\b/i.test(body)
        ? "path"
        : pendingValue
          ? classifyValue(pendingValue, body.slice(1, -1) || body)
          : "string";
      if (/\.exe\b/i.test(body)) {
        push("exe", i, j);
        inWinwsArgs = /winws/i.test(body);
      } else {
        push(type, i, j, pendingValue ?? undefined);
      }
      pendingValue = null;
      i = j;
      continue;
    }

    if (source.startsWith("--", i)) {
      let j = i + 2;
      while (j < source.length && /[A-Za-z0-9-]/.test(source[j]!)) j += 1;
      const name = source.slice(i + 2, j);
      push(flagToken(name), i, j, name);
      inWinwsArgs = true;
      if (source[j] === "=") {
        push("operator", j, j + 1, name);
        pendingValue = name;
        i = j + 1;
        continue;
      }
      pendingValue = null;
      i = j;
      continue;
    }

    if (pendingValue) {
      const end = consumeValueAtom(source, i);
      const atom = source.slice(i, end);
      if (atom === ",") {
        push("operator", i, end, pendingValue);
        i = end;
        continue;
      }
      push(classifyValue(pendingValue, atom), i, end, pendingValue);
      if (source[end] !== ",") pendingValue = null;
      i = end;
      continue;
    }

    if (ch === "=" || ch === "," || ch === ">" || ch === "<" || ch === "|" || ch === "&") {
      push("operator", i, i + 1);
      i += 1;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const end = consumePortOrNumber(source, i);
      const text = source.slice(i, end);
      push(/[-,]/.test(text) ? "port" : "number", i, end);
      i = end;
      continue;
    }

    const word = peekWord(source, i);
    if (word) {
      const lower = word.toLowerCase();
      if (lower.endsWith(".exe") || lower === "winws" || lower === "winws.exe") {
        push("exe", i, i + word.length);
        inWinwsArgs = /winws/i.test(word);
      } else if (KEYWORDS.has(lower) || word.startsWith("@")) {
        push("keyword", i, i + word.length);
      } else if (/\.(txt|bin|flt|dat|cmd|bat)$/i.test(word) || /[\\/]/.test(word)) {
        push("path", i, i + word.length);
      } else if (inWinwsArgs) {
        push("junk", i, i + word.length);
      } else {
        push("text", i, i + word.length);
      }
      i += word.length;
      continue;
    }

    if (inWinwsArgs && !/[\s]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && source[j] !== "\n" && source[j] !== "^" && !source.startsWith("--", j)) {
        j += 1;
      }
      while (j > i && /[ \t]/.test(source[j - 1]!)) j -= 1;
      push("junk", i, j);
      pendingValue = null;
      i = j;
      continue;
    }

    i += 1;
  }

  return tokens;
}

function endOfLine(source: string, i: number) {
  let j = i;
  while (j < source.length && source[j] !== "\n") j += 1;
  return j;
}

function consumeValueAtom(source: string, i: number) {
  if (source[i] === ",") return i + 1;
  let j = i;
  while (
    j < source.length &&
    !/[\s^]/.test(source[j]!) &&
    source[j] !== "," &&
    source[j] !== '"'
  ) {
    j += 1;
  }
  return j;
}

function consumePortOrNumber(source: string, i: number) {
  let j = i;
  while (j < source.length && /[0-9,~*-]/.test(source[j]!)) j += 1;
  return j;
}

function classifyValue(flag: string, raw: string): TokenType {
  const value = raw.replace(/^["']|["']$/g, "");
  if (!value) return "text";
  if (/^0x[0-9a-fA-F]+$/.test(value)) return "hex";
  if (/^%\w+%$/.test(value) || /%/.test(value)) return "variable";
  if (value === "0" || value === "1") return "value-bool";
  if (/[\\/]/.test(value) || /\.(txt|bin|flt|dat|exe)$/i.test(value)) return "path";
  if (flag === "dpi-desync" && DESYNC.has(value)) return "value-mode";
  if ((flag === "dpi-desync-fooling" || flag === "dup-fooling") && FOOL.has(value)) {
    return "value-fooling";
  }
  if (flag === "filter-l7" && PROTOS.has(value)) return "value-proto";
  if (
    (flag === "dpi-desync-split-pos" ||
      flag === "dpi-desync-split-seqovl" ||
      flag === "dpi-desync-hostfakesplit-midhost") &&
    MARKERS.has(value.replace(/[+-]\d+$/, ""))
  ) {
    return "value-marker";
  }
  if (/^~?\d+(-\d+)?$/.test(value) || value === "*") return "port";
  if (/^-?\d+$/.test(value) || /^[nds]\d+$/i.test(value)) return "number";
  return "text";
}

export function tokensOverlapping(tokens: Token[], from: number, to: number) {
  return tokens.filter((token) => token.to > from && token.from < to);
}
