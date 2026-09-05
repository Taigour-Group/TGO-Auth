import { Link } from 'react-router-dom';
import { Logo, Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="grid min-h-full grid-rows-[auto_1fr] p-5">
      <header className="flex justify-center py-3">
        <Logo />
      </header>
      <main className="grid place-items-center text-center">
        <div>
          <div className="text-6xl font-bold tracking-tight text-ink">404</div>
          <p className="mt-2 text-ink-muted">We couldn’t find that page.</p>
          <Link to="/" className="mt-6 inline-block no-underline hover:no-underline">
            <Button variant="primary">Back to home</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
