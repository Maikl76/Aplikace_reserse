import Help from './pages/Help';
import Home from './pages/Home';
import ProjectPage from './pages/ProjectPage';
import { useHashRoute } from './ui';

export default function App() {
  const route = useHashRoute();
  const section = route[0] ?? '';
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0f5c63" />
            <path d="M8 9h16M8 16h11M8 23h6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="23" cy="21" r="3.2" fill="none" stroke="#f2b84b" strokeWidth="2.2" />
          </svg>
          Průvodce přehledem
        </a>
        <nav aria-label="Hlavní navigace">
          <a href="#/" className={section === '' || section === 'p' ? 'active' : ''}>
            Moje projekty
          </a>
          <a href="#/napoveda/typy" className={route[1] === 'typy' ? 'active' : ''}>
            Typy přehledů
          </a>
          <a href="#/napoveda/slovnicek" className={route[1] === 'slovnicek' ? 'active' : ''}>
            Slovníček
          </a>
          <a href="#/napoveda/o-aplikaci" className={route[1] === 'o-aplikaci' ? 'active' : ''}>
            O aplikaci
          </a>
        </nav>
      </header>
      {section === 'p' && route[1] ? <ProjectPage id={route[1]} step={route[2]} /> : section === 'napoveda' ? <Help tab={route[1] ?? 'typy'} /> : <Home />}
    </>
  );
}
