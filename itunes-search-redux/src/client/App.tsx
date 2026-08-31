import { SearchForm } from './components/SearchForm';
import { SearchResults } from './components/SearchResults';

/** The whole page: search form in the header, results in main. */
export default function App() {
  return (
    <>
      <header>
        <h1>iTunes Search</h1>
        <SearchForm />
      </header>
      <main>
        <SearchResults />
      </main>
    </>
  );
}
