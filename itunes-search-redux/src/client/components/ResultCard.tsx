import styled from 'styled-components';
import type { ResultKind, SearchResult } from '../../shared/types';

/** Display labels for the kind badge on each row. */
const KIND_LABELS: Record<ResultKind, string> = {
  artist: 'Artist',
  album: 'Album',
  song: 'Song',
};

const Card = styled.article`
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 1rem;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
  background: ${({ theme }) => theme.colors.paper};
`;

const Artwork = styled.img`
  flex-shrink: 0;
  border-radius: 8px;
`;

// Pill colour discriminates the result kind at a glance
const Badge = styled.span<{ $kind: ResultKind }>`
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  color: #fff;
  background: ${({ $kind }) =>
    $kind === 'artist' ? '#6e56cf' : $kind === 'album' ? '#0e7490' : '#be185d'};
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.heading};
  margin: 0.2rem 0 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  letter-spacing: ${({ theme }) => theme.typography.spacing(0.4)};
  font-weight: ${({ theme }) => theme.typography.fontWeight.normal};
`;

const Subtitle = styled.p`
  margin: 0.1rem 0 0;
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: #6e6e73;
`;

const getBlankImage = (kind: ResultKind) => {
  switch (kind) {
    case 'artist':
      return '/images/blank-artist.png';
    case 'album':
      return '/images/blank-album.png';
    case 'song':
      return '/images/blank-song.png';
  }
};

export function ResultCard({ result }: { result: SearchResult }) {
  return (
    <li>
      <Card>
        <Artwork
          src={result.artworkUrl ?? getBlankImage(result.kind)}
          alt=""
          width={60}
          height={60}
          loading="lazy"
        />
        <div>
          <Title>{result.title}</Title>
          {result.subtitle && <Subtitle>{result.subtitle}</Subtitle>}
          <Badge $kind={result.kind} aria-label={`Type: ${KIND_LABELS[result.kind]}`}>
            {KIND_LABELS[result.kind]}
          </Badge>
        </div>
      </Card>
    </li>
  );
}
