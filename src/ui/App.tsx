import { Routes, Route, Link } from 'react-router-dom';
import SettingsPage from './settings/SettingsPage';
import EditorPage from './editor/EditorPage';
import PreflightPage from './preflight/PreflightPage';

function Placeholder() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">행사박사</h1>
      <Link to="/settings" className="text-blue-600">설정으로 이동</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/event/:eventId/edit" element={<EditorPage />} />
      <Route path="/event/:eventId/preflight" element={<PreflightPage />} />
    </Routes>
  );
}
