import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { tokenize } from "../parse/tokenize";

const marks = new Map<string, ReturnType<typeof Decoration.mark>>();

function mark(type: string) {
  let deco = marks.get(type);
  if (!deco) {
    deco = Decoration.mark({ class: `tok-${type}` });
    marks.set(type, deco);
  }
  return deco;
}

function build(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  const tokens = tokenize(view.state.doc.toString());
  const from = view.viewport.from;
  const to = view.viewport.to;
  for (const token of tokens) {
    if (token.to <= from) continue;
    if (token.from >= to) break;
    if (token.to <= token.from) continue;
    builder.add(token.from, token.to, mark(token.type));
  }
  return builder.finish();
}

export function zapretHighlight(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );
}
