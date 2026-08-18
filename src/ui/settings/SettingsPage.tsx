import { Link } from 'react-router-dom';
import ProfileForm from './ProfileForm';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <header className="flex items-center gap-3 p-4">
        <Link to="/" className="text-blue-600">← 홈</Link>
        <h1 className="text-lg font-bold">설정</h1>
      </header>
      <ProfileForm />
    </div>
  );
}
