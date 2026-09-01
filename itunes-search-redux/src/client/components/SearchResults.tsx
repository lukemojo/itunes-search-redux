import { useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useInfiniteReveal } from '../hooks/useInfiniteReveal';
import { useAppDispatch, useAppSelector } from '../store';
import {
  loadMore,
  revealMore,
  selectError,
  selectHasMore,
  selectShouldLoadMore,
  selectStatus,
  selectTerm,
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
  color: #b91c1c;
`;

/** The results area: status/error notices, the revealed list, and the scroll sentinel. */
export function SearchResults() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStatus);
  const term = useAppSelector(selectTerm);
  const error = useAppSelector(selectError);
  const visible = useAppSelector(selectVisibleResults);
  const hasMore = useAppSelector(selectHasMore);
  const shouldLoadMore = useAppSelector(selectShouldLoadMore);

  // Fetching on scroll is triggered by the sentinel when the observer sees it enter the viewport
  // The sentinel is only rendered while more content exists
  useEffect(() => {
    if (shouldLoadMore) dispatch(loadMore());
  }, [shouldLoadMore, dispatch]);

  // The sentinel is only rendered while more content exists, so the hook
  // automatically disconnects when the sentinel disappears.
  const reveal = useCallback(() => dispatch(revealMore()), [dispatch]);
  const sentinelRef = useInfiniteReveal(reveal, hasMore);

  if (status === 'idle') return null;
  if (status === 'loading') return <StatusMessage role="status">Searching…</StatusMessage>;
  if (status === 'failed') return <ErrorMessage role="alert">{error}</ErrorMessage>;
  if (visible.length === 0)
    return <StatusMessage role="status">No results found for “{term}”</StatusMessage>;

  return (
    <>
      <ResultList aria-label="Search results">
        {visible.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </ResultList>
      {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
    </>
  );
}
