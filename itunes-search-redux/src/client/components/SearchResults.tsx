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
  const hasMore = useAppSelector(selectHasMore);
  const shouldLoadMore = useAppSelector(selectShouldLoadMore);

  // Prefetch is state-driven: whenever the reveal window
  // nears the end of loaded data, extend it
  useEffect(() => {
    if (shouldLoadMore) dispatch(loadMore());
  }, [shouldLoadMore, dispatch]);

  // The sentinel is only rendered while more content exists, so the hook
  // automatically disconnects when the sentinel disappears.
  const reveal = useCallback(() => dispatch(revealMore()), [dispatch]);
  const sentinelRef = useInfiniteReveal(reveal, hasMore);

  const successString = `Showing ${visible.length} of ${hasMore ? 'more than ' : ''}${visible.length} results for “${term}”`;
  const noResultsString = `No results found for “${term}”`;

  const getStatusText = () => {
    if (status === 'loading') return 'Searching…';
    if (visible.length === 0) return noResultsString;
    if (visible.length > 0) return successString;
  };

  if (status === 'idle') return null;
  if (status === 'failed') return <ErrorMessage role="alert">{error}</ErrorMessage>;

  const statusText = getStatusText();

  return (
    <>
      <StatusMessage role="status">{statusText}</StatusMessage>

      {status !== 'loading' && visible.length !== 0 && (
        <>
          <ResultList aria-label="Search results" role="list">
            {visible.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </ResultList>
          {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
          {hasMore && (
            <LoadMoreButton onClick={() => dispatch(revealMore())}>Load more</LoadMoreButton>
          )}
        </>
      )}
    </>
  );
}
