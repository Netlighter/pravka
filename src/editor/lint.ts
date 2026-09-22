import { linter, type Diagnostic } from "@codemirror/lint";
import { parseConfig } from "../parse/parse";
import { validateConfig } from "../parse/validate";

export const zapretLinter = linter((view) => {
  const parsed = parseConfig(view.state.doc.toString());
  const issues = validateConfig(parsed);
  return issues.map<Diagnostic>((issue) => ({
    from: clamp(issue.from, view.state.doc.length),
    to: Math.max(clamp(issue.to, view.state.doc.length), clamp(issue.from, view.state.doc.length) + 1),
    severity: issue.severity,
    message: issue.message,
    source: "zapret",
  }));
});

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(value, max));
}
