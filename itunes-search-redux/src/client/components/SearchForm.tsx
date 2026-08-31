import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useAppDispatch } from '../store';
import { searchItunes } from '../store/searchSlice';

/** How long typing must pause before a search fires automatically. */
export const DEBOUNCE_MS = 400;
/** Auto-search needs at least this many characters; explicit submit has no minimum. */
export const MIN_TERM_LENGTH = 2;

/**
 * The search input: search-as-you-type (debounced), with submit/Enter
 * searching immediately. A ref tracks the last dispatched term so the armed
 * debounce timer never duplicates a submit, and identical terms don't refire.
 */
export function SearchForm() {
  const dispatch = useAppDispatch();
  // State to hold the current value of the search input
  const [term, setTerm] = useState('');
  // Ref to track the last searched term to prevent duplicate searches
  const lastSearched = useRef('');

  useEffect(() => {
    // Trim the term and check if it meets the minimum length requirement for auto-search
    const trimmed = term.trim();
    if (trimmed.length < MIN_TERM_LENGTH) return;

    const timer = setTimeout(() => {
      // Re-checked at fire time: a submit may have searched this term already
      if (trimmed === lastSearched.current) return;
      lastSearched.current = trimmed;
      dispatch(searchItunes(trimmed));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer); // retyping (or unmount) resets the pause
  }, [term, dispatch]);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    // Trim the term and check if it is empty or the same as the last searched term
    const trimmed = term.trim();
    if (!trimmed || trimmed === lastSearched.current) return;
    lastSearched.current = trimmed;

    // Dispatch the search action with the trimmed term
    dispatch(searchItunes(trimmed));
  };

  return (
    <form role="search" onSubmit={onSubmit}>
      <label htmlFor="search-term">Search artists, albums and songs</label>
      <input
        id="search-term"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="e.g. Radiohead"
      />
      <button type="submit">Search</button>
    </form>
  );
}
