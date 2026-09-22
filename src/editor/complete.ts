import { autocompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { FLAGS, CATEGORY_META } from "../data/catalog";
import {
  DESYNC_MODES,
  FOOLING,
  L7_PROTOS,
  SPLIT_MARKERS,
  IP_ID_MODES,
  FAKE_TLS_MODS,
} from "../data/enums";

const flagCompletions: Completion[] = FLAGS.map((flag) => ({
  label: `--${flag.name}`,
  type: "keyword",
  detail: CATEGORY_META[flag.category].label,
  info: [
    flag.syntax,
    flag.summary,
    flag.values?.length ? `Варианты:\n${flag.values.map((value) => `• ${value}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n"),
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
