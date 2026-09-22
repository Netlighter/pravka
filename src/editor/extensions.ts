import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import { drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, EditorView } from "@codemirror/view";
import { zapretCompletion } from "./complete";
import { strategyGutter } from "./gutter";
import { zapretHighlight } from "./highlight";
import { zapretHover } from "./hover";
import { zapretLinter } from "./lint";
import { createEditorTheme, type ThemeId } from "./themes";

export function editorExtensions(opts: { theme: ThemeId; wrap: boolean } = { theme: "zapret", wrap: true }): Extension {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    EditorState.tabSize.of(2),
    opts.wrap ? EditorView.lineWrapping : [],
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
    createEditorTheme(opts.theme),
    zapretHighlight(),
    zapretCompletion,
    zapretHover,
    zapretLinter,
    strategyGutter(),
  ];
}
