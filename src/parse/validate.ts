import { FLAG_BY_NAME, REPEATABLE } from "../data/catalog";
import {
  DESYNC_MODES,
  FOOLING,
  L3,
  L7_PROTOS,
  SPLIT_MARKERS,
  IP_ID_MODES,
} from "../data/enums";
import type { Block, FlagUse, ParsedConfig } from "./parse";

export type Severity = "error" | "warning" | "info";

export interface Issue {
  severity: Severity;
  from: number;
  to: number;
  message: string;
  flag?: string;
}

const DESYNC = new Set<string>(DESYNC_MODES);
const FOOL = new Set<string>(FOOLING);
const PROTOS = new Set<string>(L7_PROTOS);
const MARKERS = new Set<string>(SPLIT_MARKERS);
const IPID = new Set<string>(IP_ID_MODES);

const PORT_ATOM = /^(~?\d{1,5}(?:-\d{1,5})?|\*|%~?[\w]+%|%[\w]+%)$/;
const CUTOFF = /^[nds]\d+$/i;
const HEX_OR_FILE = /^(?:!\+?\d*|0x[0-9a-fA-F]+|[+]\d+@.+|.+)$/;

export function validateConfig(parsed: ParsedConfig): Issue[] {
  const issues: Issue[] = [];
  const { tokens, flags, blocks, globals } = parsed;

  for (const token of tokens) {
    if (token.type === "flag-unknown" && token.flag) {
      issues.push({
        severity: "error",
        from: token.from,
        to: token.to,
        message: `Неизвестный флаг --${token.flag}. Проверьте написание по документации nfqws/winws.`,
        flag: token.flag,
      });
    }
    if (token.type === "junk") {
      issues.push({
        severity: "error",
        from: token.from,
        to: token.to,
        message: `Лишний текст в аргументах winws: «${token.text}». Это не флаг и не значение — winws так не запустится.`,
      });
    }
  }

  for (const flag of flags) {
    const def = FLAG_BY_NAME.get(flag.name);
    if (!def) continue;
    if (def.args === "required" && (flag.value === undefined || flag.value === "")) {
      issues.push({
        severity: "error",
        from: flag.from,
        to: flag.to,
        message: `--${flag.name} требует значение: ${def.syntax}`,
        flag: flag.name,
      });
    }
    if (def.linuxOnly && parsed.batch) {
      issues.push({
        severity: "warning",
        from: flag.from,
        to: flag.to,
        message: `--${flag.name} относится к Linux/nfqws и обычно игнорируется или недоступен в winws.`,
        flag: flag.name,
      });
    }
    if (flag.value) checkValue(flag, issues);
  }

  const seenGlobal = new Map<string, FlagUse>();
  for (const flag of globals) {
    if (REPEATABLE.has(flag.name)) continue;
    const prev = seenGlobal.get(flag.name);
    if (prev) {
      issues.push({
        severity: "warning",
        from: flag.from,
        to: flag.to,
        message: `--${flag.name} уже задан. Повтор перезапишет предыдущее значение.`,
        flag: flag.name,
      });
    } else {
      seenGlobal.set(flag.name, flag);
    }
  }

  const hasRaw = flags.some((flag) => flag.name === "wf-raw");
  if (hasRaw) {
    for (const name of ["wf-tcp", "wf-udp", "wf-raw-part"] as const) {
      const hit = flags.find((flag) => flag.name === name);
      if (hit) {
        issues.push({
          severity: "warning",
          from: hit.from,
          to: hit.to,
          message: `--wf-raw полностью замещает --${name}. Этот флаг не будет использован.`,
          flag: name,
        });
      }
    }
  }

  const lastFlag = flags[flags.length - 1];
  if (lastFlag?.name === "new") {
    issues.push({
      severity: "warning",
      from: lastFlag.from,
      to: lastFlag.to,
      message: "Хвостовой --new не открывает новый блок — его можно убрать.",
      flag: "new",
    });
  }

  blocks.forEach((block) => checkBlock(block, issues));
  return issues;
}

function checkValue(flag: FlagUse, issues: Issue[]) {
  const value = flag.value!;
  switch (flag.name) {
    case "dpi-desync": {
      for (const part of splitList(value)) {
        if (!DESYNC.has(part)) {
          issues.push({
            severity: "error",
            from: flag.from,
            to: flag.to,
            message: `Неизвестный режим desync «${part}». Допустимо: ${DESYNC_MODES.join(", ")}.`,
            flag: flag.name,
          });
        }
      }
      break;
    }
    case "dpi-desync-fooling":
    case "dup-fooling": {
      for (const part of splitList(value)) {
        if (!FOOL.has(part)) {
          issues.push({
            severity: "error",
            from: flag.from,
            to: flag.to,
            message: `Неизвестный fooling «${part}». Допустимо: ${FOOLING.join(", ")}.`,
            flag: flag.name,
          });
        }
      }
      break;
    }
    case "filter-l7": {
      for (const part of splitList(value)) {
        if (!PROTOS.has(part)) {
          issues.push({
            severity: "error",
            from: flag.from,
            to: flag.to,
            message: `Неизвестный L7-протокол «${part}». Допустимо: ${L7_PROTOS.join(", ")}.`,
            flag: flag.name,
          });
        }
      }
      break;
    }
    case "filter-l3":
    case "wf-l3": {
      for (const part of splitList(value)) {
        if (!L3.includes(part as (typeof L3)[number])) {
          issues.push({
            severity: "error",
            from: flag.from,
            to: flag.to,
            message: `Ожидается ipv4 или ipv6, получено «${part}».`,
            flag: flag.name,
          });
        }
      }
      break;
    }
    case "filter-tcp":
    case "filter-udp":
    case "wf-tcp":
    case "wf-udp": {
      for (const part of splitList(value)) {
        if (!PORT_ATOM.test(part)) {
          issues.push({
            severity: "error",
            from: flag.from,
            to: flag.to,
            message: `Некорректный порт/диапазон «${part}». Ожидается 443, 19294-19344, ~80 или *.`,
            flag: flag.name,
          });
        }
      }
      break;
    }
    case "dpi-desync-split-pos":
    case "dpi-desync-split-seqovl":
    case "dpi-desync-hostfakesplit-midhost": {
      for (const part of splitList(value)) {
        if (!isSplitMarker(part)) {
          issues.push({
            severity: "error",
            from: flag.from,
            to: flag.to,
            message: `Некорректный маркер сплита «${part}». Число, -N или method|host|endhost|sld|endsld|midsld|sniext[±N].`,
            flag: flag.name,
          });
        }
      }
      break;
    }
    case "dpi-desync-cutoff":
    case "dpi-desync-start":
    case "dup-cutoff":
    case "dup-start":
    case "orig-mod-cutoff":
    case "orig-mod-start":
    case "wssize-cutoff": {
      if (!CUTOFF.test(value) && !/^\d+$/.test(value)) {
        issues.push({
          severity: "error",
          from: flag.from,
          to: flag.to,
          message: `--${flag.name} ожидает [n|d|s]N, например n4 или d2.`,
          flag: flag.name,
        });
      }
      break;
    }
    case "ip-id":
    case "dup-ip-id": {
      if (!IPID.has(value) && !(flag.name === "dup-ip-id" && value === "same")) {
        issues.push({
          severity: "error",
          from: flag.from,
          to: flag.to,
          message: `Неизвестный режим ip-id «${value}».`,
          flag: flag.name,
        });
      }
      break;
    }
    case "dpi-desync-any-protocol":
    case "dpi-desync-skip-nosni":
    case "wf-filter-lan": {
      if (value !== "0" && value !== "1") {
        issues.push({
          severity: "error",
          from: flag.from,
          to: flag.to,
          message: `--${flag.name} принимает только 0 или 1.`,
          flag: flag.name,
        });
      }
      break;
    }
    default: {
      if (flag.name.startsWith("dpi-desync-fake-") && !HEX_OR_FILE.test(value)) {
        issues.push({
          severity: "warning",
          from: flag.from,
          to: flag.to,
          message: `Подозрительное значение фейка. Ожидается файл, @file, 0xHEX или !.`,
          flag: flag.name,
        });
      }
    }
  }
}

function checkBlock(block: Block, issues: Issue[]) {
  const names = new Map<string, FlagUse>();
  for (const flag of block.flags) {
    if (REPEATABLE.has(flag.name) || flag.name.startsWith("dpi-desync-fake-")) {
      names.set(flag.name, flag);
      continue;
    }
    const prev = names.get(flag.name);
    if (prev && flag.name !== "skip") {
      issues.push({
        severity: "warning",
        from: flag.from,
        to: flag.to,
        message: `В этом блоке --${flag.name} повторяется и перезапишет предыдущее значение.`,
        flag: flag.name,
      });
    }
    names.set(flag.name, flag);
  }

  if (block.skipped) {
    const skip = block.flags.find((flag) => flag.name === "skip");
    issues.push({
      severity: "info",
      from: skip?.from ?? block.from,
      to: skip?.to ?? Math.min(block.from + 6, block.to),
      message: `Блок ${block.index + 1} помечен --skip и не будет применяться.`,
      flag: "skip",
    });
  }

  if (!block.tcp && !block.udp && !block.l7 && block.flags.length) {
    const first = block.flags[0];
    issues.push({
      severity: "info",
      from: first?.from ?? block.from,
      to: first?.to ?? Math.min(block.from + 12, block.to),
      message: `Блок ${block.index + 1} без --filter-tcp/--filter-udp/--filter-l7 сработает на весь попавший трафик.`,
    });
  }

  const desync = block.desync?.split(",") ?? [];
  const splitModes = ["multisplit", "multidisorder", "fakedsplit", "fakeddisorder", "hostfakesplit"];
  const needsSplit = desync.filter((mode) => splitModes.includes(mode));
  const desyncFlag = block.flags.find((flag) => flag.name === "dpi-desync");
  if (needsSplit.length && !block.flags.some((flag) => flag.name === "dpi-desync-split-pos")) {
    const span = spanInFlag(desyncFlag, needsSplit[0], block.from, block.to);
    issues.push({
      severity: "warning",
      from: span.from,
      to: span.to,
      message: `Режим ${desync.join(",")} обычно нуждается в --dpi-desync-split-pos.`,
      flag: "dpi-desync-split-pos",
    });
  }

  if (desync.includes("fake") && !block.flags.some((flag) => flag.name.startsWith("dpi-desync-fake-"))) {
    const span = spanInFlag(desyncFlag, "fake", block.from, block.to);
    issues.push({
      severity: "info",
      from: span.from,
      to: span.to,
      message: "dpi-desync=fake без своего payload возьмёт встроенный стандартный фейк.",
      flag: "dpi-desync",
    });
  }

  if (block.fooling?.split(",").includes("ts")) {
    const fool = block.flags.find((flag) => flag.name === "dpi-desync-fooling");
    if (fool) {
      issues.push({
        severity: "info",
        from: fool.from,
        to: fool.to,
        message: "fooling=ts работает только если в системе включены TCP timestamps (enable_timestamps.cmd).",
        flag: "dpi-desync-fooling",
      });
    }
  }

  const seqovl = block.flags.find((flag) => flag.name === "dpi-desync-split-seqovl");
  if (seqovl?.value && desync.includes("multisplit") && /^-/.test(seqovl.value)) {
    issues.push({
      severity: "error",
      from: seqovl.from,
      to: seqovl.to,
      message: "Для split --dpi-desync-split-seqovl должен быть положительным. Отрицательные значения — только для disorder.",
      flag: "dpi-desync-split-seqovl",
    });
  }

  if (block.flags.some((flag) => flag.name === "dpi-desync-any-protocol") &&
      !block.flags.some((flag) => flag.name === "dpi-desync-cutoff")) {
    const any = block.flags.find((flag) => flag.name === "dpi-desync-any-protocol");
    if (any?.value === "1") {
      issues.push({
        severity: "warning",
        from: any.from,
        to: any.to,
        message: "any-protocol=1 без cutoff будет дурить весь поток. Для игр обычно добавляют --dpi-desync-cutoff=n4.",
        flag: "dpi-desync-any-protocol",
      });
    }
  }
}

function spanInFlag(flag: FlagUse | undefined, needle: string | undefined, fallbackFrom: number, fallbackTo: number) {
  if (!flag) return { from: fallbackFrom, to: Math.min(fallbackFrom + 12, fallbackTo) };
  if (needle) {
    const at = flag.raw.indexOf(needle);
    if (at >= 0) return { from: flag.from + at, to: flag.from + at + needle.length };
  }
  return { from: flag.from, to: flag.to };
}

function splitList(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function isSplitMarker(part: string) {
  if (/^-?\d+$/.test(part)) return true;
  const match = /^(method|host|endhost|sld|endsld|midsld|sniext)([+-]\d+)?$/.test(part);
  return match || MARKERS.has(part);
}
