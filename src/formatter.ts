import { EnvKeyInfo } from './dictionary';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface EnvEntry {
  /** KEY 이름 */
  key: string;
  /** = 이후 원본 값 문자열 */
  rawValue: string;
  /** 사전에서 가져온 그룹명 (미등록이면 '기타') */
  group: string;
  /** 사전에서 가져온 설명 (없으면 undefined) */
  description?: string;
  /**
   * 이 KEY 바로 위에 있던 사용자 작성 주석 줄들
   * (자동 생성된 # [Group] 스타일 주석은 제거되고 재생성됨)
   */
  userComments: string[];
}

// ─── 그룹 정렬 우선순위 ────────────────────────────────────────────────────────
export const GROUP_ORDER: string[] = [
  'Application Environment',
  'Database & Cache',
  'Security & Authentication',
  'Cloud Provider API',
  'AI & LLM Integration',
  'Third-Party Integration',
  'CI/CD & Hosting Platforms',
  'Framework & Build Configuration',
  'Scanned From Source',
  'Custom',
  'Others',
];

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
/** 자동 생성 주석인지 판별 (# [Group] ... 형태) */
function isAutoComment(line: string): boolean {
  return /^#\s*\[/.test(line.trim());
}

/** 그룹 섹션 헤더 생성 */
function makeGroupHeader(groupName: string): string {
  const BAR_TOTAL = 60;
  const inner     = ` ${groupName} `;
  const dashes    = '─'.repeat(Math.max(4, BAR_TOTAL - inner.length));
  return `# ── ${groupName} ${dashes}`;
}

/** 키 설명 주석 생성 */
function makeDescComment(description: string): string {
  // 너무 길면 60자에서 줄바꿈
  const MAX = 80;
  if (description.length <= MAX) {
    return `# ${description}`;
  }
  // 단어 경계 기준으로 분할
  const lines: string[] = [];
  let current = '';
  for (const word of description.split(' ')) {
    if (current.length + word.length + 1 > MAX) {
      lines.push(`# ${current.trim()}`);
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  }
  if (current.trim()) { lines.push(`# ${current.trim()}`); }
  return lines.join('\n');
}

// ─── 핵심 포매터 ──────────────────────────────────────────────────────────────
/**
 * .env 파일 텍스트를 받아 그룹별로 정렬하고 섹션 주석을 붙여 반환한다.
 *
 * @param text      원본 파일 전체 텍스트
 * @param dictionary 내장 + 커스텀 병합 사전
 */
export function formatEnvDocument(
  text: string,
  dictionary: Record<string, EnvKeyInfo>
): string {
  const lines      = text.split(/\r?\n/);
  const KEY_REGEX  = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

  const entries: EnvEntry[]    = [];
  const pendingComments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw     = lines[i];
    const trimmed = raw.trim();

    if (trimmed === '') {
      // 빈 줄 — 누적 주석을 다음 키에 붙이되, 연속 빈줄이면 리셋
      if (pendingComments.length > 0) {
        // 다음 비어있지 않은 줄이 KEY=VALUE 가 아니면 버림
        const next = lines.slice(i + 1).find(l => l.trim() !== '');
        if (!next || !KEY_REGEX.test(next.trim())) {
          pendingComments.length = 0;
        }
      }
      continue;
    }

    if (trimmed.startsWith('#')) {
      // 자동 생성 주석(섹션 헤더·description)은 수집하지 않음
      if (!isAutoComment(trimmed) && !trimmed.startsWith('# ──')) {
        pendingComments.push(raw);
      }
      continue;
    }

    const match = KEY_REGEX.exec(trimmed);
    if (!match) {
      // KEY=VALUE 도 주석도 아닌 줄은 그냥 버림(비어있지 않은 알 수 없는 줄)
      pendingComments.length = 0;
      continue;
    }

    const key    = match[1];
    const info   = dictionary[key];
    const group  = info?.group ?? 'Others';

    entries.push({
      key,
      rawValue:     match[2],
      group,
      description:  info?.description,
      userComments: pendingComments.splice(0), // 이동 후 초기화
    });
  }

  // ── 그룹별로 묶기 ────────────────────────────────────────────────────────
  const groupMap = new Map<string, EnvEntry[]>();
  for (const entry of entries) {
    if (!groupMap.has(entry.group)) { groupMap.set(entry.group, []); }
    groupMap.get(entry.group)!.push(entry);
  }

  // ── 그룹 정렬: 우선순위 목록 → 나머지 알파벳 순 ─────────────────────────
  const sortedGroups: string[] = [
    ...GROUP_ORDER.filter(g => groupMap.has(g)),
    ...[...groupMap.keys()]
      .filter(g => !GROUP_ORDER.includes(g))
      .sort((a, b) => a.localeCompare(b, 'ko')),
  ];

  // ── 출력 조립 ─────────────────────────────────────────────────────────────
  const out: string[] = [];

  for (const groupName of sortedGroups) {
    const groupEntries = groupMap.get(groupName)!;

    // 섹션 헤더
    out.push(makeGroupHeader(groupName));
    out.push('#');

    for (const entry of groupEntries) {
      // 사용자 주석이 이미 있으면 설명 주석을 추가하지 않음
      // 사용자 주석이 없을 때만 사전 설명을 자동 주석으로 삽입
      if (entry.userComments.length > 0) {
        out.push(...entry.userComments);
      } else if (entry.description) {
        out.push(makeDescComment(entry.description));
      }

      // KEY=VALUE
      out.push(`${entry.key}=${entry.rawValue}`);
    }

    // 그룹 사이 빈 줄
    out.push('');
  }

  // 마지막 빈 줄 정리 (딱 하나만 남김)
  while (out.length > 1 && out[out.length - 1] === '' && out[out.length - 2] === '') {
    out.pop();
  }

  return out.join('\n');
}
