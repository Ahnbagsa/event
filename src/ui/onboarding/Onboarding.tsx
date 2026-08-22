import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Notice from '../kit/Notice';
import Button from '../kit/Button';
import { getProfile } from '../../db/profileRepo';
import { getAvailableRoles } from '../../db/audioRepo';
import { getSettings, saveSettings } from '../../db/settingsRepo';

type Step = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** 이것 없이도 행사를 치를 수 있는가. */
  optional: boolean;
};

/**
 * 처음 앱을 연 사람에게 무엇부터 하면 되는지 보여 준다.
 *
 * 이 앱은 계정도 서버도 없이 모든 것을 각자 기기에 담는다. 그래서 다른 선생님이
 * 주소를 열면 학교명도 음원도 없는 백지 앱을 만난다. 무엇을 해야 하는지
 * 알려 주지 않으면 그냥 닫는다.
 *
 * 세 걸음 모두 건너뛸 수 있다. 강제로 붙잡으면 안내가 아니라 관문이 된다.
 */
export default function Onboarding() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    void (async () => {
      const [profile, roles, settings] = await Promise.all([
        getProfile(),
        getAvailableRoles(),
        getSettings(),
      ]);

      setDismissed(settings.onboardingDismissed === true);
      setSteps([
        {
          id: 'profile',
          label: '학교명과 교장 선생님 성함 넣기',
          hint: '멘트에 학교 이름이 들어갑니다.',
          done: profile !== null && profile.schoolName.trim() !== '',
          optional: false,
        },
        {
          id: 'audio',
          label: '음원 챙기기',
          hint: '맹세·애국가·묵념곡은 이미 준비된 것 중에서 고르면 됩니다. 교가는 직접 올려 주세요.',
          done: roles.size > 0,
          optional: false,
        },
        {
          id: 'ai',
          label: 'AI로 멘트 자동 작성 (건너뛰어도 됩니다)',
          hint: '넣지 않아도 멘트를 직접 쓰고 행사를 진행할 수 있습니다.',
          done: settings.geminiApiKey.trim() !== '',
          optional: true,
        },
      ]);
    })();
  }, []);

  async function handleDismiss() {
    setDismissed(true);
    await saveSettings({ ...(await getSettings()), onboardingDismissed: true });
  }

  if (steps === null || dismissed) return null;

  // 꼭 필요한 걸음이 다 끝났으면 더 붙잡지 않는다.
  if (steps.every((step) => step.done || step.optional)) return null;

  return (
    <Notice data-testid="onboarding" className="mb-4">
      <p className="font-medium">👋 처음이시라면 이것부터 해 주세요</p>
      <p className="mt-1">
        이 앱은 모든 자료를 <strong>이 기기 안에만</strong> 담습니다. 어디로도 보내지 않는 대신,
        학교마다 한 번씩 채워 주셔야 합니다.
      </p>

      <ol className="mt-2 space-y-2">
        {steps.map((step) => (
          <li key={step.id} data-testid={`step-${step.id}`}
              className="flex flex-wrap items-baseline gap-x-2">
            <span aria-hidden="true">{step.done ? '✅' : '⬜'}</span>
            <span className="min-w-0 flex-1">
              <span className={step.done ? 'text-ink-soft line-through' : 'font-medium'}>
                {step.label}
              </span>
              {!step.done && <span className="block text-ink-soft">{step.hint}</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 font-medium text-white hover:bg-accent-strong"
        >
          설정으로 가기
        </Link>
        <Button onClick={() => void handleDismiss()}>나중에 하기</Button>
      </div>
    </Notice>
  );
}
