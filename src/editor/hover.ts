import { hoverTooltip } from "@codemirror/view";
import { FLAG_BY_NAME, CATEGORY_META } from "../data/catalog";
import { tokenize } from "../parse/tokenize";

export const zapretHover = hoverTooltip((view, pos) => {
  const tokens = tokenize(view.state.doc.toString());
  const token = tokens.find((item) => item.from <= pos && pos < item.to);
  if (!token) return null;
  const name = token.flag;
  const def = name ? FLAG_BY_NAME.get(name) : undefined;
  if (!def) {
    if (token.type === "junk") {
      return {
        pos: token.from,
        end: token.to,
        create() {
          const dom = document.createElement("div");
          dom.className = "hover-card";
          dom.textContent = "Лишний текст в командной строке winws. Удалите или превратите в флаг.";
          return { dom };
        },
      };
    }
    return null;
  }

  return {
    pos: token.from,
    end: token.to,
    create() {
      const dom = document.createElement("div");
      dom.className = "hover-card";
      const cat = CATEGORY_META[def.category];
      const chips = def.values?.length
        ? `<div class="hover-values-label">Варианты</div><div class="hover-values">${def.values.map((value) => `<code>${escapeHtml(value)}</code>`).join("")}</div>`
        : "";
      dom.innerHTML = `
        <div class="hover-kicker">${cat.label}</div>
        <div class="hover-title">${def.syntax}</div>
        <div class="hover-body">${escapeHtml(def.summary)}</div>
        ${chips}
        ${def.hint ? `<div class="hover-hint">${escapeHtml(def.hint)}</div>` : ""}
      `;
      return { dom };
    },
  };
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
