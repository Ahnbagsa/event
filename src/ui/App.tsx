import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<main className="p-8 text-2xl">행사박사</main>} />
    </Routes>
  );
}
