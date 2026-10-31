"use client";
import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
function inline(value: string) {
  return value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("`") ? (
      <code
        key={index}
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.88em]"
      >
        {part.slice(1, -1)}
      </code>
    ) : part.startsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}
export function HighlightedCode({ code }: { code: string }) {
  // React text nodes provide escaping. No raw HTML or executable Markdown.
  const tokens = code.split(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:async|await|def|return|class|import|from|for|in|if|else|const|let|function|public|static|void|new|try|var|record|interface|private|final|true|false|null|None|True|False)\b|\b\d+\b|#[^\n]*)/g,
  );
  return (
    <pre className="overflow-x-auto p-5 text-[13px] leading-7">
      <code>
        {tokens.map((token, index) => (
          <span
            key={index}
            className={
              token.startsWith("#")
                ? "text-slate-400"
                : /^['"]/.test(token)
                  ? "text-emerald-300"
                  : /^\d+$/.test(token)
                    ? "text-amber-300"
                    : /^\w+$/.test(token)
                      ? "text-violet-300"
                      : ""
            }
          >
            {token}
          </span>
        ))}
      </code>
    </pre>
  );
}
export function CodeExample({
  language,
  code,
  expectedOutput,
}: {
  language: string;
  code: string;
  expectedOutput?: string;
}) {
  const [copied, setCopied] = useState(false),
    [output, setOutput] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="my-6 min-w-0 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-2 text-xs">
        <span className="font-mono text-slate-400">{language}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setError("");
            } catch {
              setError("Select and copy the code below.");
            }
          }}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 hover:bg-slate-800"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <HighlightedCode code={code} />
      {expectedOutput !== undefined && (
        <div className="border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={() => setOutput(!output)}
            aria-expanded={output}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-800 px-4 text-xs font-semibold hover:bg-slate-700"
          >
            <Terminal className="h-4 w-4" />
            {output ? "Hide output" : "Try example output"}
          </button>
          {output && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-slate-400">
                Expected output preview · this page does not execute code
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-emerald-300">
                {expectedOutput || "(no console output)"}
              </pre>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="status" className="p-3 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
export function LessonMarkdown({ content }: { content: string }) {
  const blocks = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="min-w-0 space-y-5 text-[15px] leading-8 text-foreground/85">
      {blocks.map((block, index) => {
        if (block.startsWith("```")) {
          const [language, ...lines] = block.slice(3, -3).split("\n");
          return (
            <CodeExample
              key={index}
              language={language || "code"}
              code={lines.join("\n")}
            />
          );
        }
        return (
          <div key={index} className="space-y-5">
            {block
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, pi) => {
                if (paragraph.startsWith("> "))
                  return (
                    <aside
                      key={pi}
                      className="rounded-xl border-l-4 border-indigo-500 bg-indigo-50/50 p-4 text-sm dark:bg-indigo-950/30"
                    >
                      {inline(paragraph.replace(/^> /gm, ""))}
                    </aside>
                  );
                if (paragraph.trim().startsWith("|")) {
                  const rows = paragraph
                    .trim()
                    .split("\n")
                    .filter((line) => !/^\|[\s:|-]+\|$/.test(line));
                  const cells = (line: string) =>
                    line
                      .trim()
                      .replace(/^\||\|$/g, "")
                      .split(/\|(?=(?:[^`]*`[^`]*`)*[^`]*$)/)
                      .map((v) => v.trim());
                  return (
                    <div key={pi} className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr>
                            {cells(rows[0]).map((cell, i) => (
                              <th key={i} className="border bg-muted p-3">
                                {inline(cell)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(1).map((row, i) => (
                            <tr key={i}>
                              {cells(row).map((cell, j) => (
                                <td key={j} className="border p-3 align-top">
                                  {inline(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                if (paragraph.startsWith("### "))
                  return (
                    <h3
                      key={pi}
                      className="pt-3 text-lg font-bold text-foreground"
                    >
                      {inline(paragraph.slice(4))}
                    </h3>
                  );
                if (paragraph.startsWith("## "))
                  return (
                    <h2
                      key={pi}
                      className="pt-5 text-xl font-bold tracking-tight text-foreground"
                    >
                      {inline(paragraph.slice(3))}
                    </h2>
                  );
                if (paragraph.startsWith("# "))
                  return (
                    <h2
                      key={pi}
                      className="pt-5 text-2xl font-bold text-foreground"
                    >
                      {inline(paragraph.slice(2))}
                    </h2>
                  );
                if (/^[-*] /.test(paragraph))
                  return (
                    <ul key={pi} className="list-disc space-y-2 pl-6">
                      {paragraph.split("\n").map((line, li) => (
                        <li key={li}>{inline(line.replace(/^[-*] /, ""))}</li>
                      ))}
                    </ul>
                  );
                return <p key={pi}>{inline(paragraph)}</p>;
              })}
          </div>
        );
      })}
    </div>
  );
}
