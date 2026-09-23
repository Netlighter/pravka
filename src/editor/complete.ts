import { autocompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { CATEGORY_META, FLAGS, type FlagDef } from "../data/catalog";
import {
  DESYNC_MODES,
  FOOLING,
  L7_PROTOS,
  SPLIT_MARKERS,
  IP_ID_MODES,
  FAKE_TLS_MODS,
} from "../data/enums";

function flagInfo(flag: FlagDef) {
  return () => {
    const root = document.createElement("div");
    root.className = "cm-zapret-info";
    const syntax = document.createElement("div");
    syntax.className = "hover-kicker";
    syntax.textContent = flag.syntax;
    const summary = document.createElement("p");
    summary.className = "hover-body";
    summary.textContent = flag.summary;
    root.append(syntax, summary);
    if (flag.values?.length) {
      const label = document.createElement("div");
      label.className = "hover-values-label";
      label.textContent = "Варианты";
      const chips = document.createElement("div");
      chips.className = "value-chips";
      for (const value of flag.values) {
        const chip = document.createElement("code");
        chip.textContent = value;
        chips.append(chip);
      }
      root.append(label, chips);
    }
    if (flag.hint) {
      const hint = document.createElement("p");
      hint.className = "hover-hint";
      hint.textContent = flag.hint;
      root.append(hint);
    }
    return root;
  };
}

const flagCompletions: Completion[] = FLAGS.map((flag) => ({
  label: `--${flag.name}`,
  type: "keyword",
  detail: CATEGORY_META[flag.category].label,
  info: flagInfo(flag),
  apply: flag.args === "none" ? `--${flag.name}` : `--${flag.name}=`,
}));

const valueMap: Record<string, string[]> = {
  "dpi-desync": [...DESYNC_MODES],
  "dpi-desync-fooling": [...FOOLING],
  "dup-fooling": [...FOOLING],
  "filter-l7": [...L7_PROTOS],
  "filter-l3": ["ipv4", "ipv6"],
  "wf-l3": ["ipv4", "ipv6"],
  "ip-id": [...IP_ID_MODES.filter((v) => v !== "same")],
  "dup-ip-id": ["same", "zero", "seq", "rnd"],
  "dpi-desync-fake-tls-mod": [...FAKE_TLS_MODS],
  "dpi-desync-any-protocol": ["0", "1"],
  "dpi-desync-skip-nosni": ["0", "1"],
  "wf-filter-lan": ["0", "1"],
  "dpi-desync-split-pos": [...SPLIT_MARKERS, "1", "midsld", "method+2"],
  "dpi-desync-cutoff": ["n2", "n3", "n4", "d2", "s1"],
};

function completeZapret(context: CompletionContext) {
  const flagMatch = context.matchBefore(/--[A-Za-z0-9-]*/);
  if (flagMatch && (flagMatch.from !== flagMatch.to || context.explicit)) {
    return {
      from: flagMatch.from,
      options: flagCompletions,
      validFor: /^--[A-Za-z0-9-]*$/,
    };
  }

  const valueMatch = context.matchBefore(/--([A-Za-z0-9-]+)=([^ \n^"]*)$/);
  if (valueMatch) {
    const inner = context.matchBefore(/[A-Za-z0-9_+-]*$/);
    const flagName = /--([A-Za-z0-9-]+)=/.exec(valueMatch.text)?.[1];
    const values = flagName ? valueMap[flagName] : undefined;
    if (inner && values) {
      return {
        from: inner.from,
        options: values.map((value) => ({
          label: value,
          type: "constant",
          apply: value,
        })),
      };
    }
  }

  return null;
}

export const zapretCompletion = autocompletion({
  override: [completeZapret],
  icons: false,
});
