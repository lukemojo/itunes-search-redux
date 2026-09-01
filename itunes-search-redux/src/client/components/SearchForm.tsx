import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../store';
import { searchItunes } from '../store/searchSlice';

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
  // Dispatch function to send actions to the Redux store
  const dispatch = useAppDispatch();
  // State to hold the current value of the search input
  const [term, setTerm] = useState('');
  // Ref to track the last searched term to prevent duplicate searches
  const lastSearched = useRef('');

  useEffect(() => {
    // Trim the term and check if it meets the minimum length requirement for auto-search
    const trimmed = term.trim();

    // If the trimmed term is too short, do not set a debounce timer
    if (trimmed.length < MIN_TERM_LENGTH) return;

    // Set a debounce timer to dispatch the search action after a pause in typing
    const timer = setTimeout(() => {
      // Re-checked at fire time: a submit may have searched this term already
      if (trimmed === lastSearched.current) return;

      // Update the last searched term and dispatch the search action
      lastSearched.current = trimmed;

      // Dispatch the search action with the trimmed term
      dispatch(searchItunes(trimmed));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer); // retyping (or unmount) resets the pause
  }, [term, dispatch]);

  return (
    <Form role="search">
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
