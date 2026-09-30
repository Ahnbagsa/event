import { useEffect, useState } from 'react';
import { getProfile, saveProfile } from '../../db/profileRepo';

export default function ProfileForm() {
  const [schoolName, setSchoolName] = useState('');
  const [principalTitle, setPrincipalTitle] = useState('교장');
  const [principalName, setPrincipalName] = useState('');
  const [vicePrincipalName, setVicePrincipalName] = useState('');
  const [foundedDate, setFoundedDate] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getProfile().then((profile) => {
      if (profile === null) return;
      setSchoolName(profile.schoolName);
      setPrincipalTitle(profile.principal.title);
      setPrincipalName(profile.principal.name);
      setVicePrincipalName(profile.vicePrincipal?.name ?? '');
      setFoundedDate(profile.foundedDate ?? '');
    });
  }, []);

  async function handleSave() {
    setSaved(false);
    if (schoolName.trim() === '') {
      setError('학교명을 입력해 주세요.');
      return;
    }
    setError('');
    await saveProfile({
      id: 'singleton',
      schoolName: schoolName.trim(),
      principal: { title: principalTitle.trim(), name: principalName.trim() },
      vicePrincipal:
        vicePrincipalName.trim() === ''
          ? null
          : { title: '교감', name: vicePrincipalName.trim() },
      foundedDate: foundedDate === '' ? null : foundedDate,
      updatedAt: Date.now(),
    });
    setSaved(true);
  }

  const field = 'w-full rounded-xl border border-line px-3 py-2';

  return (
    <section className="mx-auto max-w-xl space-y-4 p-4">
      <h2 className="text-xl font-bold">학교 프로필</h2>
      <p className="text-sm text-ink-soft">
        한 번 입력해 두면 모든 행사 대본에 자동으로 쓰입니다.
      </p>

      <div>
        <label className="block text-sm font-medium" htmlFor="schoolName">학교명</label>
        <input id="schoolName" className={field} value={schoolName}
               onChange={(e) => setSchoolName(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <div className="w-28">
          <label className="block text-sm font-medium" htmlFor="principalTitle">직함</label>
          <input id="principalTitle" className={field} value={principalTitle}
                 onChange={(e) => setPrincipalTitle(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium" htmlFor="principalName">교장 성함</label>
          <input id="principalName" className={field} value={principalName}
                 onChange={(e) => setPrincipalName(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="vicePrincipalName">교감 성함 (선택)</label>
        <input id="vicePrincipalName" className={field} value={vicePrincipalName}
               onChange={(e) => setVicePrincipalName(e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="foundedDate">개교기념일 (선택)</label>
        <input id="foundedDate" type="date" className={field} value={foundedDate}
               onChange={(e) => setFoundedDate(e.target.value)} />
      </div>

      {error !== '' && <p className="text-danger">{error}</p>}
      {saved && <p className="text-ok">저장했습니다.</p>}

      <button className="rounded-full bg-accent font-semibold px-4 py-2 text-white"
              onClick={() => void handleSave()}>
        저장
      </button>
    </section>
  );
}
