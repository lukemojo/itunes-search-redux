import { useCallback } from 'react';
import styled from 'styled-components';
import { useInfiniteReveal } from '../hooks/useInfiniteReveal';
import { useAppDispatch, useAppSelector } from '../store';
import {
  revealMore,
  selectError,
  selectHasMore,
  selectStatus,
  selectTerm,
  selectTotalCount,
  selectVisibleResults,
} from '../store/searchSlice';
import { ResultCard } from './ResultCard';

const ResultList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
`;

const StatusMessage = styled.p`
  text-align: center;
  color: #6e6e73;
`;

const ErrorMessage = styled(StatusMessage)`
  color: ${({ theme }) => theme.colors.error};
`;

const LoadMoreButton = styled.button`
  display: block;
  margin: 1rem auto;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border: none;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primary}cc;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

/** The results area: status/error notices, the revealed list, and the scroll sentinel. */
export function SearchResults() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStatus);
  const term = useAppSelector(selectTerm);
  const error = useAppSelector(selectError);
  const visible = useAppSelector(selectVisibleResults);
  const total = useAppSelector(selectTotalCount);
  const hasMore = useAppSelector(selectHasMore);

  // The sentinel is only rendered while more content exists, so the hook
  // automatically disconnects when the sentinel disappears.
  const reveal = useCallback(() => dispatch(revealMore()), [dispatch]);
  const sentinelRef = useInfiniteReveal(reveal, hasMore);

  if (status === 'idle') return null;
  if (status === 'failed') return <ErrorMessage role="alert">{error}</ErrorMessage>;
  if (status === 'loading') return <StatusMessage role="status">Searching…</StatusMessage>;
  if (total === 0) {
    return <StatusMessage role="status">{`No results found for “${term}”`}</StatusMessage>;
  }

  return (
    <>
      <StatusMessage role="status">
        {`Showing ${visible.length} of ${total} results for “${term}”`}
      </StatusMessage>

      <ResultList aria-label="Search results">
        {visible.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </ResultList>

      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden="true" />
          <LoadMoreButton onClick={reveal}>Load more</LoadMoreButton>
        </>
      )}
    </>
  );
}
