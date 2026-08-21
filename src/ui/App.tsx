import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import NewEventPage from './NewEventPage';
import SettingsPage from './settings/SettingsPage';
import EditorPage from './editor/EditorPage';
import PreflightPage from './preflight/PreflightPage';
import RunPage from './run/RunPage';
import ImportPage from './share/ImportPage';
import ImportPlanPage from './wizard/ImportPlanPage';
import OutlineReviewPage from './wizard/OutlineReviewPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewEventPage />} />
      <Route path="/new/plan" element={<ImportPlanPage />} />
      <Route path="/new/outline" element={<OutlineReviewPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/event/:eventId/edit" element={<EditorPage />} />
      <Route path="/event/:eventId/preflight" element={<PreflightPage />} />
      <Route path="/event/:eventId/run" element={<RunPage />} />
    </Routes>
  );
}
