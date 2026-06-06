# 시작하기

## 설치

[다운로드](/ko/download) 페이지에서 해당 플랫폼용 설치 파일을 받고 아래 단계를 따르세요.

- **Windows**: `.exe` 설치 파일을 더블 클릭하고 마법사를 따릅니다.
- **macOS**: `.dmg`를 열고 앱을 응용 프로그램 폴더로 드래그합니다. macOS에서 "손상되었습니다"라고 표시되면 [자주 묻는 질문](/ko/docs/faq)을 참고하세요.
- **Linux**: `.deb` / `.rpm` 패키지로 설치하거나 `.AppImage`를 직접 실행합니다.

아직 공식 릴리스가 없나요? [소스에서 빌드하기](/ko/download#소스에서-빌드하기)를 참고하여 직접 컴파일하세요.

## 인터페이스 구성

앱은 세 영역으로 나뉩니다:

**왼쪽 사이드바**: 키워드 검색 바와 함께 모든 도구를 목록으로 표시하며, 최근 사용한 도구는 하단에 나타납니다. 도구를 클릭하면 오른쪽 탭에서 열립니다.

**오른쪽 멀티탭 영역**: 각 도구는 고유한 탭을 가집니다. 원하는 만큼 열어도 서로 영향을 주지 않습니다. 탭을 닫아도 저장되지 않은 내용은 보존됩니다(도구를 다시 열면 복원됩니다).

**AI 패널**: 오른쪽 상단의 AI 아이콘을 클릭하여 사이드 패널을 펼칩니다. 모든 도구 화면에서 사용 가능 — 내용을 붙여넣고 바로 질문할 수 있습니다. 대화 기록은 로컬 데이터베이스에 자동 저장됩니다.

## AI 어시스턴트 설정

처음 사용 전에 제공자를 설정해야 합니다:

1. 오른쪽 상단 툴바에서 **설정** 아이콘을 클릭합니다(또는 `Ctrl/Cmd + ,`를 누릅니다).
2. **AI 어시스턴트** 탭으로 이동하여 제공자를 선택합니다:

| 제공자 | API Key 필요 여부 |
|--------|-----------------|
| Claude (Anthropic) | 예 |
| OpenAI | 예 |
| DeepSeek | 예 |
| Codex (OpenAI Codex) | 예 |
| Grok (xAI) | 예 |
| Ollama (로컬) | 아니요 — BaseURL만 설정 |

3. API Key를 입력하고(Ollama는 로컬 주소 입력 — 기본값 `http://localhost:11434`), **연결 테스트**를 클릭하여 확인합니다.
4. 설정을 저장하고 닫습니다. AI 패널을 바로 사용할 수 있습니다.

> **프록시가 필요한 사용자:** 일부 지역에서는 OpenAI, Claude, Grok 접속에 프록시가 필요합니다. DeepSeek와 Ollama(로컬)는 프록시 없이도 작동합니다.

## 개발자를 위한 안내: 새 도구 추가하기

세 단계로 완료됩니다:

**1단계**: `packages/ui/src/tools/<id>/`에 `meta.ts`와 `Tool.vue`를 생성합니다:

```ts
// packages/ui/src/tools/my-tool/meta.ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'my-tool',
  name: { zh: '我的工具', en: 'My Tool' },
  desc: { zh: '工具简介', en: 'Tool description' },
  category: 'misc',
  keywords: ['my-tool'],
  icon: '🔧',
  load: () => import('./Tool.vue'),
}
```

**2단계**: `packages/ui/src/tools/index.ts`의 `TOOLS` 배열 끝에 등록합니다:

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...기존 도구들
  myTool,
]
```

**3단계**: `pnpm dev`를 실행합니다 — 새 도구가 왼쪽 사이드바에 즉시 나타납니다.
