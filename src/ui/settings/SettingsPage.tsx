import PageHeader from '../kit/PageHeader';
import ProfileForm from './ProfileForm';
import AudioDrawer from './AudioDrawer';
import StorageNotice from './StorageNotice';
import ApiKeyForm from './ApiKeyForm';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="설정" backTo="/" backLabel="← 홈" />
      <ProfileForm />
      <StorageNotice />
      <AudioDrawer />
      <ApiKeyForm />
    </div>
  );
}
