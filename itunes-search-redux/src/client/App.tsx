import styled from 'styled-components';
import { SearchForm } from './components/SearchForm';
import { SearchResults } from './components/SearchResults';

const Header = styled.header`
  display: flex;
  background: ${({ theme }) => theme.colors.paper};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  grid-column-start: 1;
  grid-column-end: 3;
  height: 4rem;
  align-items: center;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-template-rows: auto auto 1fr auto;
  gap: 0;
  height: 100vh;
  overflow: hidden;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  letter-spacing: -0.02em;
  padding-left: ${({ theme }) => theme.typography.spacing(8)};
`;

const Nav = styled.nav`
  background: ${({ theme }) => theme.colors.paper};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  justify-content: center;
  gap: 0;
  grid-column-start: 1;
  grid-column-end: 1;
  grid-row-start: 2;
  grid-row-end: 4;
  padding: 3rem 0;
  width: ${({ theme }) => theme.sizing.sidebarWidth};
  @media (max-width: 768px) {
    display: none;
  }
`;

const FormWrapper = styled.div`
  margin: 0 auto;
  max-width: 40rem;
  padding: ${({ theme }) => theme.typography.spacing(12)} 2rem;
  position: sticky;
  top: 0;
  z-index: 1;
  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.typography.spacing(6)} 2rem;
  }
`;

const Main = styled.main`
  overflow-y: auto;
  padding: 0 2rem;
  grid-column-start: 2;
  grid-row-start: 2;
  grid-row-end: 4;
  @media (max-width: 768px) {
    padding: 0;
  }
`;

const MainColumn = styled.div`
  max-width: 72rem;
  margin: 0 auto;
  padding-bottom: ${({ theme }) => theme.typography.spacing(12)};
`;

const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 6rem;
`;

const IconLink = styled.a`
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 0.275rem;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0.5rem;
`;

const SearchIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    x="0px"
    y="0px"
    width="100"
    height="100"
    viewBox="0 0 48 48"
  >
    <path
      fill="#ffffff"
      d="M 20.5 6 C 12.509634 6 6 12.50964 6 20.5 C 6 28.49036 12.509634 35 20.5 35 C 23.956359 35 27.133709 33.779044 29.628906 31.75 L 39.439453 41.560547 A 1.50015 1.50015 0 1 0 41.560547 39.439453 L 31.75 29.628906 C 33.779044 27.133709 35 23.956357 35 20.5 C 35 12.50964 28.490366 6 20.5 6 z M 20.5 9 C 26.869047 9 32 14.130957 32 20.5 C 32 23.602612 30.776198 26.405717 28.791016 28.470703 A 1.50015 1.50015 0 0 0 28.470703 28.791016 C 26.405717 30.776199 23.602614 32 20.5 32 C 14.130953 32 9 26.869043 9 20.5 C 9 14.130957 14.130953 9 20.5 9 z"
    ></path>
  </svg>
);

const LogoIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="48"
    viewBox="0 0 44 48"
    width="44"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g fill="#7c3aed">
      <path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z" />
      <path
        d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z"
        opacity=".5"
      />
    </g>
  </svg>
)

export default function App() {
  return (
    <Layout>
      <Header>
        <LogoWrapper>
          {LogoIcon}
        </LogoWrapper>
        <Title>iTunes Search</Title>
      </Header>

      <Nav>
        <IconLink href="/" aria-label="Search">
          {SearchIcon}
        </IconLink>
      </Nav>

      <Main tabIndex={0} role="region" aria-label="Search and results">
        <MainColumn>
          <FormWrapper>
            <SearchForm />
          </FormWrapper>

          <SearchResults />
        </MainColumn>
      </Main>
    </Layout>
  );
}
