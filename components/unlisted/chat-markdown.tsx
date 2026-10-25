import { Fragment, type ReactNode } from "react";

type Block = { kind: "paragraph"; lines: string[] } | { kind: "list"; items: string[] } | { kind: "heading"; text: string };

const BULLET = /^[\-*•]\s+/;
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?$/;
const PROPERTY_TITLE = /^\s*(?:\d+[.)]\s+|[-•]\s+|->\s+|→\s+)\*\*(.+?)\*\*\s*$/;

function headingText(line: string): string | null {
  const match = line.match(HEADING) ?? line.match(PROPERTY_TITLE);
  return match ? match[1].replace(/^\d+[.)]\s+/, "").replace(/^\*\*(.+)\*\*$/, "$1") : null;
}

function splitBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = headingText(line);
    if (heading !== null) {
      blocks.push({ kind: "heading", text: heading });
      index += 1;
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (index < lines.length && BULLET.test(lines[index]) && headingText(lines[index]) === null) {
        items.push(lines[index].replace(BULLET, ""));
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !BULLET.test(lines[index]) && headingText(lines[index]) === null) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let plainStart = 0;
  let token = 0;

  function flushPlain(until: number) {
    if (until <= plainStart) return;
    nodes.push(text.slice(plainStart, until));
    plainStart = until;
  }

  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const markdownLink = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    const bareLink = rest.match(/^https?:\/\/[^\s<>]+/);
    if (markdownLink || bareLink) {
      const raw = markdownLink?.[2] ?? bareLink![0].replace(/[.,;:!?)]*$/, "");
      try {
        const url = new URL(raw);
        const host = url.hostname.replace(/^www\./, "");
        const label = markdownLink && !/^https?:\/\//i.test(markdownLink[1])
          ? markdownLink[1] : host.includes("google.com") && url.pathname.includes("maps") ? "Google Maps" : host;
        flushPlain(cursor);
        nodes.push(<a key={`${keyPrefix}-a-${token++}`} href={url.href} title={url.href} target="_blank" rel="noopener noreferrer" className="font-medium text-clay-dark underline underline-offset-4 [overflow-wrap:anywhere]">{label}</a>);
        cursor += markdownLink ? markdownLink[0].length : raw.length;
        plainStart = cursor;
        continue;
      } catch { /* Incomplete URLs remain readable while a reply types out. */ }
    }
    const pair = text.slice(cursor, cursor + 2);
    if (pair === "**" || pair === "__") {
      const close = text.indexOf(pair, cursor + 2);
      if (close !== -1) {
        flushPlain(cursor);
        const inner = text.slice(cursor + 2, close);
        nodes.push(
          <strong key={`${keyPrefix}-b-${token++}`} className="font-semibold">
            {parseInline(inner, `${keyPrefix}-b${token}`)}
          </strong>,
        );
        cursor = close + 2;
        plainStart = cursor;
        continue;
      }
    }

    const mark = text[cursor];
    if (mark === "*" || mark === "_") {
      const close = text.indexOf(mark, cursor + 1);
      if (close > cursor + 1) {
        flushPlain(cursor);
        const inner = text.slice(cursor + 1, close);
        nodes.push(
          <em key={`${keyPrefix}-i-${token++}`} className="italic">
            {parseInline(inner, `${keyPrefix}-i${token}`)}
          </em>,
        );
        cursor = close + 1;
        plainStart = cursor;
        continue;
      }
    }

    cursor += 1;
  }

  flushPlain(text.length);
  return nodes;
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
      {blocks.map((block, blockIndex) => {
        if (block.kind === "heading") {
          return (
            <h3 key={blockIndex} className="flex items-start gap-2 pt-4 text-lg leading-snug font-bold text-ink first:pt-0 [&_strong]:font-bold">
              <svg aria-hidden="true" className="mt-1 shrink-0 text-clay" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
              <span>{parseInline(block.text, `h${blockIndex}`)}</span>
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={blockIndex} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{parseInline(item, `l${blockIndex}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {parseInline(line, `p${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
