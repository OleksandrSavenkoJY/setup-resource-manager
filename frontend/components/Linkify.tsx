import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

// Trailing punctuation usually belongs to the sentence, not to the URL.
function splitTrailing(url: string): [string, string] {
  const m = url.match(/[.,;:!?)\]]+$/);
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, ""];
}

export default function Linkify({ text }: { text?: string | null }) {
  if (!text) return <>-</>;
  return (
    <>
      {text.split(URL_RE).map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const [url, tail] = splitTrailing(part);
        return (
          <Fragment key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {url}
            </a>
            {tail}
          </Fragment>
        );
      })}
    </>
  );
}
