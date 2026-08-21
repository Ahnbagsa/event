import type { EventCeremony, SchoolProfile } from '../types';

function describeProfile(profile: SchoolProfile | null): string {
  if (profile === null) return '학교 정보가 등록되어 있지 않습니다.';
  const vice =
    profile.vicePrincipal === null
      ? ''
      : `\n- ${profile.vicePrincipal.title}: ${profile.vicePrincipal.name}`;
  return [
    `- 학교명: ${profile.schoolName}`,
    `- ${profile.principal.title}: ${profile.principal.name}`,
  ].join('\n') + vice;
}

const NO_INVENTION = [
  '아래 규칙을 반드시 지키세요.',
  '1. 주어지지 않은 사실을 지어내지 마세요. 학교명, 사람 이름, 날짜, 인원수, 수상자 이름은',
  '   아래 "학교 정보"와 사용자가 준 자료에 있는 값만 쓸 수 있습니다.',
  '2. 값을 모르면 비워 두지 말고 {{교장 성함}}처럼 이중 중괄호로 표시하세요.',
  '3. 한국 초등학교의 의식행사 관례를 따르세요.',
].join('\n');

export function buildOutlineInstruction(profile: SchoolProfile | null): string {
  return [
    '당신은 한국 초등학교의 행사 진행을 돕는 도우미입니다.',
    '사용자가 준 행사 계획서에서 식순(행사 순서)만 뽑아 JSON으로 정리하세요.',
    '멘트(사회자 대사)는 아직 만들지 마세요.',
    '',
    NO_INVENTION,
    '',
    '각 순서의 kind는 다음 중 하나여야 합니다.',
    '- speech: 사회자가 말만 하는 순서 (개식사, 폐식사 등)',
    '- audio: 음원을 트는 순서 (애국가 제창, 교가 제창, 국기에 대한 경례)',
    '- timer: 정해진 시간 동안 진행하는 순서 (묵념)',
    '- address: 다른 사람이 말하는 순서 (학교장 말씀, 전달 사항)',
    '',
    '학교 정보',
    describeProfile(profile),
  ].join('\n');
}

export function buildScriptInstruction(
  event: EventCeremony,
  profile: SchoolProfile | null,
): string {
  const modeRule =
    event.mode === 'broadcast'
      ? '이 행사는 교실에서 방송으로 진행합니다. "각 교실에서", "화면을 향해" 같은 표현을 쓰고, 강당 이동이나 무대 관련 표현은 절대 쓰지 마세요.'
      : '이 행사는 강당 등에서 대면으로 진행합니다. "자리에서 일어서 주시기 바랍니다" 같은 표현을 쓰세요.';

  const audienceRule = {
    lower: '듣는 사람은 1~2학년입니다. 문장을 짧게 하고 쉬운 낱말만 쓰세요.',
    upper: '듣는 사람은 고학년입니다. 표준적인 정중한 문체를 쓰세요.',
    all: '듣는 사람은 전교생입니다. 고학년 기준의 정중한 문체를 쓰되 저학년도 알아들을 낱말을 쓰세요.',
    withParents: '학부모와 내빈이 참석합니다. 격식을 높이고 내빈에 대한 감사 인사를 포함하세요.',
  }[event.audience];

  const toneRule = {
    formal: '정중하고 담백하게 쓰세요.',
    warm: '따뜻하고 다정한 느낌을 담으세요.',
    concise: '군더더기 없이 짧게 쓰세요.',
  }[event.tone];

  const targetRule =
    event.targetMinutes === null
      ? ''
      : `전체 행사가 약 ${event.targetMinutes}분에 맞도록 멘트 분량을 조절하세요.`;

  return [
    '당신은 한국 초등학교 행사의 사회자 대본을 쓰는 도우미입니다.',
    '각 순서마다 사회자가 마이크에 대고 그대로 읽을 문장만 쓰세요.',
    '무대 지시, 괄호 설명, 진행 요령은 절대 넣지 마세요.',
    '',
    NO_INVENTION,
    '',
    '국민의례, 국기에 대한 경례, 묵념 같은 의식 절차의 표준 표현은 임의로 바꾸지 마세요.',
    '',
    modeRule,
    audienceRule,
    toneRule,
    targetRule,
    '',
    `행사명: ${event.title}`,
    `날짜: ${event.date}`,
    `장소: ${event.place}`,
    '',
    '학교 정보',
    describeProfile(profile),
  ]
    .filter((line) => line !== '')
    .join('\n');
}
