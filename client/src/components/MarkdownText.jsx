import React from 'react';

function renderInline(text, keyPrefix = 'in') {
  if (!text) return null;
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*|(https?:\/\/[^\s<>)]+))/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let partIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`${keyPrefix}-lnk-${partIdx++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-300 underline decoration-indigo-400/50 hover:text-indigo-200 break-all"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${partIdx++}`} className="font-bold text-white">
          {renderInline(match[4], `${keyPrefix}-bi-${partIdx}`)}
        </strong>
      );
    } else if (match[5]) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${partIdx++}`}
          className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/70 text-indigo-200 font-mono text-[0.9em]"
        >
          {match[5]}
        </code>
      );
    } else if (match[6]) {
      nodes.push(
        <em key={`${keyPrefix}-em-${partIdx++}`} className="italic text-slate-200">
          {match[6]}
        </em>
      );
    } else if (match[7]) {
      nodes.push(
        <a
          key={`${keyPrefix}-url-${partIdx++}`}
          href={match[7]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-300 underline decoration-indigo-400/50 hover:text-indigo-200 break-all"
        >
          {match[7]}
        </a>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export default function MarkdownText({ text = '', className = '' }) {
  if (!text || typeof text !== 'string') return null;

  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-2 break-words ${className}`}>
      {segments.map((seg, segIdx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const code = seg.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```$/, '');
          return (
            <pre
              key={`code-${segIdx}`}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-200 overflow-x-auto whitespace-pre"
            >
              {code}
            </pre>
          );
        }

        const lines = seg.split(/\r?\n/);
        const blocks = [];
        let listBuffer = null;

        const flushList = () => {
          if (!listBuffer) return;
          const Tag = listBuffer.ordered ? 'ol' : 'ul';
          blocks.push(
            <Tag
              key={`list-${segIdx}-${blocks.length}`}
              className={`${listBuffer.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 text-slate-200`}
            >
              {listBuffer.items.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  {renderInline(item, `li-${segIdx}-${blocks.length}-${i}`)}
                </li>
              ))}
            </Tag>
          );
          listBuffer = null;
        };

        lines.forEach((rawLine, lineIdx) => {
          const line = rawLine.trimEnd();
          if (!line.trim()) {
            flushList();
            return;
          }

          if (/^---+$/.test(line.trim())) {
            flushList();
            blocks.push(<hr key={`hr-${segIdx}-${lineIdx}`} className="border-slate-800 my-2" />);
            return;
          }

          const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
          if (headingMatch) {
            flushList();
            const level = headingMatch[1].length;
            const sizeClass = level === 1 ? 'text-sm font-black text-white' : level === 2 ? 'text-[13px] font-bold text-indigo-200' : 'text-xs font-bold text-indigo-300';
            blocks.push(
              <div key={`h-${segIdx}-${lineIdx}`} className={`${sizeClass} pt-1`}>
                {renderInline(headingMatch[2], `h-${segIdx}-${lineIdx}`)}
              </div>
            );
            return;
          }

          const ulMatch = line.match(/^\s*(?:[-*•])\s+(.+)$/);
          if (ulMatch) {
            if (!listBuffer || listBuffer.ordered) {
              flushList();
              listBuffer = { ordered: false, items: [] };
            }
            listBuffer.items.push(ulMatch[1]);
            return;
          }

          const olMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
          if (olMatch) {
            if (!listBuffer || !listBuffer.ordered) {
              flushList();
              listBuffer = { ordered: true, items: [] };
            }
            listBuffer.items.push(olMatch[1]);
            return;
          }

          flushList();
          blocks.push(
            <p key={`p-${segIdx}-${lineIdx}`} className="leading-relaxed">
              {renderInline(line, `p-${segIdx}-${lineIdx}`)}
            </p>
          );
        });

        flushList();
        return <React.Fragment key={`seg-${segIdx}`}>{blocks}</React.Fragment>;
      })}
    </div>
  );
}
