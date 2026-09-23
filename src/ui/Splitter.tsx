import { useRef } from "react";

export function Splitter({
  axis,
  onDelta,
  className = "",
}: {
  axis: "x" | "y";
  onDelta: (delta: number) => void;
  className?: string;
}) {
  const last = useRef(0);
  const dragging = useRef(false);

  return (
    <div
      className={`splitter splitter-${axis} ${className}`}
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onPointerDown={(event) => {
        dragging.current = true;
        last.current = axis === "x" ? event.clientX : event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        document.body.classList.add("is-resizing");
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const pos = axis === "x" ? event.clientX : event.clientY;
        onDelta(pos - last.current);
        last.current = pos;
      }}
      onPointerUp={() => {
        dragging.current = false;
        document.body.classList.remove("is-resizing");
      }}
      onPointerCancel={() => {
        dragging.current = false;
        document.body.classList.remove("is-resizing");
      }}
    />
  );
}
