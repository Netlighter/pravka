import { Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MenuOption = {
  id: string;
  label: string;
  hint?: string;
  swatch?: string;
  accent?: string;
};

export function Menu({
  label,
  value,
  options,
  onSelect,
  align = "left",
  title,
}: {
  label?: string;
  value?: string;
  options: MenuOption[];
  onSelect: (id: string) => void;
  align?: "left" | "right";
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0, minWidth: 200, maxHeight: 320 });
  const selected = options.find((option) => option.id === value);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const minWidth = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
    let left = align === "right" ? rect.right - minWidth : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - minWidth - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const maxHeight = Math.min(360, Math.max(spaceBelow, spaceAbove, 160));
    const top = spaceBelow >= 180 || spaceBelow >= spaceAbove ? rect.bottom + 6 : Math.max(8, rect.top - 6 - maxHeight);
    setBox({ top, left, minWidth, maxHeight });
  }, [open, align, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: PointerEvent) => {
      const node = event.target as Node;
      if (rootRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClose = () => setOpen(false);
    const onScroll = (event: Event) => {
      const node = event.target;
      if (node instanceof Node && menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className={`btn menu-trigger ${open ? "on" : ""}`}
        onClick={() => setOpen((value) => !value)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.swatch && (
          <span
            className="menu-swatch"
            style={{ background: selected.swatch, boxShadow: `inset 0 0 0 1.5px ${selected.accent ?? "var(--line)"}` }}
          />
        )}
        <span className="menu-label">{selected?.label ?? label ?? "…"}</span>
        <ChevronDown />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="menu-pop"
            style={{ top: box.top, left: box.left, minWidth: box.minWidth, maxHeight: box.maxHeight }}
            role="listbox"
          >
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === value}
                className={`menu-item ${option.id === value ? "on" : ""}`}
                onClick={() => {
                  onSelect(option.id);
                  setOpen(false);
                }}
              >
                {option.swatch ? (
                  <span
                    className="menu-swatch"
                    style={{ background: option.swatch, boxShadow: `inset 0 0 0 1.5px ${option.accent ?? "var(--line)"}` }}
                  />
                ) : null}
                <span className="menu-item-text">
                  <strong>{option.label}</strong>
                  {option.hint ? <em>{option.hint}</em> : null}
                </span>
                {option.id === value ? <Check /> : null}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
