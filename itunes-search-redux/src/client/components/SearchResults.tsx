import { useCallback, useEffect } from 'react';
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

/** The results area: status/error notices, the revealed list, and the scroll sentinel. */
export function SearchResults() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStatus);
  const term = useAppSelector(selectTerm);
  const error = useAppSelector(selectError);
  const visible = useAppSelector(selectVisibleResults);
  const hasMore = useAppSelector(selectHasMore);
  const shouldLoadMore = useAppSelector(selectShouldLoadMore);

  // Prefetch is state-driven, not scroll-driven: whenever the reveal window
  // nears the end of loaded data, extend it.
  useEffect(() => {
    if (shouldLoadMore) dispatch(loadMore());
  }, [shouldLoadMore, dispatch]);

  // The sentinel is only rendered while more content exists, so the hook
  // automatically disconnects when the sentinel disappears.
  const reveal = useCallback(() => dispatch(revealMore()), [dispatch]);
  const sentinelRef = useInfiniteReveal(reveal, hasMore);

  if (status === 'idle') return null;
  if (status === 'loading') return <p role="status">Searching…</p>;
  if (status === 'failed') return <p role="alert">{error}</p>;
  if (visible.length === 0) return <p role="status">No results found for “{term}”</p>;

  return (
    <>
      <ul aria-label="Search results">
        {visible.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </ul>
      {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
    </>
  );
}
