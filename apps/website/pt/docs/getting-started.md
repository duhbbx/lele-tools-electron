# Primeiros passos

## Instalação

Acesse a página de [Download](/pt/download) para obter o instalador para sua plataforma e siga os passos abaixo.

- **Windows**: Dê um duplo clique no instalador `.exe` e siga o assistente.
- **macOS**: Abra o `.dmg`, arraste o app para a pasta Aplicativos. Se o macOS disser que o app está "danificado", consulte as [Perguntas frequentes](/pt/docs/faq).
- **Linux**: Instale via pacote `.deb` / `.rpm`, ou execute diretamente o `.AppImage`.

Ainda sem lançamento oficial? Consulte [Compilar a partir do código-fonte](/pt/download#compilar-a-partir-do-código-fonte) para compilar você mesmo.

## Layout da interface

O app é dividido em três áreas:

**Barra lateral esquerda**: Lista todas as ferramentas com uma barra de pesquisa por palavras-chave; as ferramentas usadas recentemente aparecem na parte inferior. Clique em qualquer ferramenta para abri-la em uma aba à direita.

**Área de múltiplas abas à direita**: Cada ferramenta tem sua própria aba. Abra quantas quiser — elas não interferem entre si. Fechar uma aba preserva o conteúdo não salvo (ele é restaurado quando você reabre a ferramenta).

**Painel de IA**: Clique no ícone de IA no canto superior direito para expandir o painel lateral. Disponível em qualquer ferramenta — cole conteúdo e faça perguntas diretamente. O histórico de conversas é salvo automaticamente no banco de dados local.

## Configurando o assistente de IA

Você precisa configurar um provedor antes de usar o assistente de IA pela primeira vez:

1. Clique no ícone de **Configurações** na barra de ferramentas superior direita (ou pressione `Ctrl/Cmd + ,`).
2. Vá até a aba **Assistente de IA** e escolha um provedor:

| Provedor | API Key necessária |
|----------|--------------------|
| Claude (Anthropic) | Sim |
| OpenAI | Sim |
| DeepSeek | Sim |
| Codex (OpenAI Codex) | Sim |
| Grok (xAI) | Sim |
| Ollama (local) | Não — configure apenas a BaseURL |

3. Insira sua API Key (para Ollama, insira o endereço local — padrão `http://localhost:11434`), depois clique em **Testar conexão** para verificar.
4. Salve e feche as Configurações. O painel de IA está pronto para usar.

> **Nota para usuários que precisam de proxy:** OpenAI, Claude e Grok só são acessíveis com proxy em algumas regiões. DeepSeek e Ollama (local) funcionam sem um.

## Para desenvolvedores: adicionar uma nova ferramenta

Três passos:

**Passo 1**: Crie `meta.ts` e `Tool.vue` em `packages/ui/src/tools/<id>/`:

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

**Passo 2**: Registre-a no final do array `TOOLS` em `packages/ui/src/tools/index.ts`:

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...ferramentas existentes
  myTool,
]
```

**Passo 3**: Execute `pnpm dev` — a nova ferramenta aparece na barra lateral esquerda imediatamente.
