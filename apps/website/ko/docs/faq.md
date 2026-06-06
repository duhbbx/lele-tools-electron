# 자주 묻는 질문

## 설치 및 실행

### macOS에서 "손상되었습니다" 또는 "열 수 없습니다"라고 표시됩니다

이 앱은 Apple 공증(notarization)을 거치지 않았습니다(공증 비용은 연 $99 — 오픈소스 프로젝트에는 적합하지 않습니다). 터미널에서 다음 명령을 한 번 실행하여 격리 플래그를 제거하세요:

```bash
xattr -dr com.apple.quarantine "/Applications/Lele Tools.app"
```

또는 앱을 오른쪽 클릭 → 열기 → 그래도 열기를 선택하세요. 이 작업은 한 번만 필요하며, 이후에는 더블 클릭으로 정상 실행됩니다.

### Linux에서 실행 오류가 발생합니다

`.deb` / `.rpm` 패키지는 의존성을 선언하므로, 패키지 매니저로 정상 설치하면 자동으로 가져옵니다. 수동 설치 후 라이브러리 누락 오류가 발생하면 안내된 시스템 패키지를 설치하세요. AppImage는 자체 런타임을 포함하고 있어 추가 의존성이 필요 없습니다.

## AI 어시스턴트

### AI에 연결되지 않거나 요청이 실패합니다

아래 순서대로 확인하세요:

1. **API Key 확인**: 설정 → AI 어시스턴트로 이동하여 키가 완전한지 확인 — 여분의 공백이나 누락된 문자가 없어야 합니다.
2. **BaseURL 확인**: 사용자 지정 엔드포인트를 사용하는 경우 끝에 슬래시가 없고 주소에 접근 가능한지 확인하세요.
3. **네트워크 프록시**: 일부 지역에서는 OpenAI, Claude, Grok 접속에 프록시가 필요합니다. DeepSeek와 Ollama(로컬)는 프록시 없이도 작동합니다.
4. **연결 테스트**: 설정 페이지의 "연결 테스트" 버튼을 사용하여 정확한 오류를 확인하세요.
5. **Ollama**: 로컬 Ollama 서비스가 실행 중인지(기본값 `http://localhost:11434`), 사용하려는 모델을 pull했는지(`ollama pull <모델명>`) 확인하세요.

## 데이터 및 개인정보

### 데이터는 어디에 저장되나요?

모든 데이터는 로컬 SQLite 데이터베이스에 저장됩니다:

- **macOS**: `~/Library/Application Support/Lele Tools/lele.db`
- **Windows**: `%APPDATA%\Lele Tools\lele.db`
- **Linux**: `~/.config/Lele Tools/lele.db`

다른 기기로 이동할 때 이 파일을 백업하세요.

### 앱이 무언가를 업로드하나요?

**아니요.** 모든 기능은 로컬에서 실행됩니다. 앱은 사용자 데이터를 수집하지 않습니다. AI 요청은 Electron 메인 프로세스에서 설정한 제공자로 직접 전송됩니다 — 중간 서버가 없습니다.

## 프로젝트에 대하여

### 왜 Electron으로 다시 작성하고 Qt 버전을 떠났나요?

Qt 버전([lele-tools](https://github.com/duhbbx/lele-tools))은 50가지 이상의 도구로 성장했지만, 수가 늘어날수록 C++/Qt 유지보수 부담 — 빌드 환경, 크로스플랫폼 패키징, UI 일관성 유지 — 도 계속 커졌습니다. Electron + Vue 3 웹 스택은 UI 개발을 더 빠르게, 컴포넌트 재사용을 더 쉽게 만들고, AI 통합(스트리밍 SSE, 멀티 제공자 SDK)이 완전히 자연스럽게 이루어집니다. Electron 버전은 처음부터 시작하여 도구 수에서 점차 Qt 버전을 따라잡을 것입니다.

### 도구를 추가하거나 버그를 수정하고 싶습니다 — 어떻게 기여하나요?

1. [저장소](https://github.com/duhbbx/lele-tools-electron)를 포크합니다
2. 아키텍처 개요로 [시작하기 → 개발자를 위한 안내: 새 도구 추가하기](/ko/docs/getting-started#개발자를-위한-안내-새-도구-추가하기)를 읽습니다
3. Pull Request를 엽니다

버그 신고와 기능 요청은 [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues)로 환영합니다.
