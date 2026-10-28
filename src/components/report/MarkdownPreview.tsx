import Markdown from "react-markdown";

const MARKER = /\[À compléter\s*:([^\]]*)\]/gi;
const SENTINEL = "\u2691 À compléter :";

/** Renders Markdown and highlights "[À compléter : …]" markers left by the model. */
export function MarkdownPreview({
  content,
  empty = "Rien à afficher pour l'instant.",
}: {
  content: string;
  empty?: string;
}) {
  if (!content.trim()) return <p className="text-sm text-stone-400 italic dark:text-stone-500">{empty}</p>;
  const marked = content.replace(MARKER, (_match, text: string) => `\`${SENTINEL}${text.replace(/`/g, "'")}\``);
  return (
    <div className="prose prose-stone dark:prose-invert max-w-none">
      <Markdown
        components={{
          code: ({ children, ...props }) => {
            const text = String(children);
            if (text.startsWith(SENTINEL)) {
              return (
                <mark className="rounded bg-amber-200 px-1 py-0.5 font-sans text-sm text-amber-950 not-italic dark:bg-amber-700 dark:text-amber-50">
                  {text.slice(1).trim()}
                </mark>
              );
            }
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {marked}
      </Markdown>
    </div>
  );
}
