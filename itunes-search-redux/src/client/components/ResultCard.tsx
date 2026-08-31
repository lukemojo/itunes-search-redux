import type { ResultKind, SearchResult } from '../../shared/types';

/** Display labels for the kind badge on each row. */
const KIND_LABELS: Record<ResultKind, string> = {
  artist: 'Artist',
  album: 'Album',
  song: 'Song',
};

/** One result row: artwork (when present), kind badge, title, subtitle. */
export function ResultCard({ result }: { result: SearchResult }) {
  return (
    <li>
      <article>
        {result.artworkUrl && (
          <img src={result.artworkUrl} alt="" width={60} height={60} loading="lazy" />
        )}
        <div>
          <span aria-label={`Type: ${KIND_LABELS[result.kind]}`}>{KIND_LABELS[result.kind]}</span>
          <h2>{result.title}</h2>
          {result.subtitle && <p>{result.subtitle}</p>}
        </div>
      </article>
    </li>
  );
}
