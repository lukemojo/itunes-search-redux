import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../store';
import { searchItunes, selectStatus } from '../store/searchSlice';

const Form = styled.form`
  display: flex;
  gap: 0.5rem;
`;

// Visually hidden but kept in the DOM so screen readers still announce the input's purpose
const HiddenLabel = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`;

const Input = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0.6rem 1rem;
  border: 1px solid #555555;
  border-radius: 999px;
  font-size: 1rem;
  background: #000;
  color: ${({ theme }) => theme.colors.text};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
    background: #000;
  }
  box-shadow: 1px 0px 20px 8px rgba(0, 0, 0, 0.2);
`;

/** How long typing must pause before a search fires automatically. */
export const DEBOUNCE_MS = 400;
/** Auto-search needs at least this many characters; explicit submit has no minimum. */
export const MIN_TERM_LENGTH = 2;

/**
 * The search form, search as you type
 */
export function SearchForm() {
  const dispatch = useAppDispatch();
  const [term, setTerm] = useState('');
  // Last dispatched term — stops the debounce timer duplicating an Enter
  // search, and identical search terms refiring
  const lastSearched = useRef('');
  const status = useAppSelector(selectStatus);

  // Forget the last searched term if the search failed, so a retry can be attempted
  useEffect(() => {
    if (status === 'failed') lastSearched.current = '';
  }, [status]);

  // Clear search results when the term is cleared
  useEffect(() => {
    const trimmed = term.trim();

    if (trimmed === '') {
      lastSearched.current = trimmed;
      dispatch({ type: 'search/clearSearch' });
    }
  }, [term, dispatch]);

  // Debounced search dispatch
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < MIN_TERM_LENGTH) return;

    const timer = setTimeout(() => {
      // Re-checked at fire time: Enter may have searched this term already
      if (trimmed === lastSearched.current) return;
      lastSearched.current = trimmed;
      dispatch(searchItunes(trimmed));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer); // retyping (or unmount) resets the pause
  }, [term, dispatch]);

  // Enter submits the form, this is the only way to search single-character terms
  // This primarily exists as a fallback and safeguard for hitting the enter key
  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    const trimmed = term.trim();
    if (!trimmed || trimmed === lastSearched.current) return;
    lastSearched.current = trimmed;

    dispatch(searchItunes(trimmed));
  };

  return (
    <Form role="search" onSubmit={onSubmit} autoComplete="off">
      <HiddenLabel htmlFor="search-term">Search artists, albums and songs</HiddenLabel>
      <Input
        id="search-term"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="What are you looking for?"
      />
    </Form>
  );
}
