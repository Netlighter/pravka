import { RangeSetBuilder, StateField } from "@codemirror/state";
import { GutterMarker, gutter } from "@codemirror/view";
import { parseConfig, type Block } from "../parse/parse";

const palette = ["#2ee6c6", "#5b9dff", "#ffb020", "#ff5cad", "#86e36a", "#c792ea", "#ff8a4c"];

class StrategyMarker extends GutterMarker {
  color: string;
  constructor(color: string) {
    super();
    this.color = color;
  }
  eq(other: GutterMarker) {
    return other instanceof StrategyMarker && this.color === other.color;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-strategy-mark";
    el.style.background = this.color;
    el.style.boxShadow = `0 0 8px ${this.color}66`;
    return el;
  }
}

const strategyField = StateField.define<Block[]>({
  create(state) {
    return parseConfig(state.doc.toString()).blocks;
  },
  update(value, tr) {
    return tr.docChanged ? parseConfig(tr.state.doc.toString()).blocks : value;
  },
});

export function strategyGutter() {
  return [
    strategyField,
    gutter({
      class: "cm-strategy-gutter",
      markers(view) {
        const blocks = view.state.field(strategyField);
        const builder = new RangeSetBuilder<GutterMarker>();
        for (const range of view.visibleRanges) {
          let pos = range.from;
          while (pos <= range.to) {
            const line = view.state.doc.lineAt(pos);
            const block = blocks.find((item) => item.from <= line.from && line.from < item.to + 1);
            if (block) builder.add(line.from, line.from, new StrategyMarker(colorFor(block)));
            pos = line.to + 1;
          }
        }
        return builder.finish();
      },
      initialSpacer: () => new StrategyMarker("#2ee6c6"),
    }),
  ];
}

export function colorFor(block: Block) {
  return palette[block.index % palette.length]!;
}

