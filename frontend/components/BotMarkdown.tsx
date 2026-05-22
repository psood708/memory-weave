'use client';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p:          ({ children }) => <p className="md-p">{children}</p>,
  strong:     ({ children }) => <strong className="md-strong">{children}</strong>,
  em:         ({ children }) => <em className="md-em">{children}</em>,
  code:       ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock
      ? <code className={`md-code-block ${className ?? ''}`}>{children}</code>
      : <code className="md-code">{children}</code>;
  },
  pre:        ({ children }) => <pre className="md-pre">{children}</pre>,
  ul:         ({ children }) => <ul className="md-ul">{children}</ul>,
  ol:         ({ children }) => <ol className="md-ol">{children}</ol>,
  li:         ({ children }) => <li className="md-li">{children}</li>,
  h1:         ({ children }) => <h1 className="md-h md-h1">{children}</h1>,
  h2:         ({ children }) => <h2 className="md-h md-h2">{children}</h2>,
  h3:         ({ children }) => <h3 className="md-h md-h3">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
  a:          ({ href, children }) => <a className="md-a" href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  hr:         () => <hr className="md-hr" />,
  table:      ({ children }) => <div className="md-table-wrap"><table className="md-table">{children}</table></div>,
  th:         ({ children }) => <th className="md-th">{children}</th>,
  td:         ({ children }) => <td className="md-td">{children}</td>,
};

export default function BotMarkdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
