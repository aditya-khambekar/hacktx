import { Fragment, type ReactNode } from "react";

type Block = { kind: "paragraph"; lines: string[] } | { kind: "list"; items: string[] };

const BULLET = /^[\-*•]\s+/;

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

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (index < lines.length && BULLET.test(lines[index])) {
        items.push(lines[index].replace(BULLET, ""));
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !BULLET.test(lines[index])) {
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
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
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
