# Perguntas frequentes

## Instalação e inicialização

### O macOS diz que o app está "danificado" ou "não pode ser aberto"

O app não passou pela notarização da Apple (a notarização custa $99/ano — não vale para um projeto open source). Execute este comando uma vez no Terminal para remover o sinalizador de quarentena:

```bash
xattr -dr com.apple.quarantine "/Applications/Lele Tools.app"
```

Alternativamente: clique com o botão direito no app → Abrir → Abrir mesmo assim. Este é um passo único; depois disso você pode iniciá-lo normalmente com duplo clique.

### Erro ao iniciar no Linux

Os pacotes `.deb` / `.rpm` declaram suas dependências, então uma instalação normal pelo gerenciador de pacotes as obterá automaticamente. Se você instalou manualmente e vê um erro de biblioteca ausente, instale o pacote do sistema indicado. O AppImage inclui seu próprio runtime e não precisa de dependências extras.

## Assistente de IA

### A IA não conecta / as requisições falham

Verifique nesta ordem:

1. **Verifique sua API Key**: vá em Configurações → Assistente de IA e certifique-se de que a chave está completa — sem espaços extras ou caracteres ausentes.
2. **Verifique a BaseURL**: se estiver usando um endpoint personalizado, confirme que não há barra final e que o endereço é acessível.
3. **Proxy de rede**: OpenAI, Claude e Grok requerem proxy em algumas regiões. DeepSeek e Ollama (local) funcionam sem um.
4. **Testar conexão**: use o botão "Testar conexão" na página de configurações para ver o erro exato.
5. **Ollama**: certifique-se de que o serviço local do Ollama está rodando (padrão `http://localhost:11434`) e de que você fez pull do modelo desejado (`ollama pull <modelo>`).

## Dados e privacidade

### Onde meus dados são armazenados?

Tudo é armazenado em um banco de dados SQLite local:

- **macOS**: `~/Library/Application Support/Lele Tools/lele.db`
- **Windows**: `%APPDATA%\Lele Tools\lele.db`
- **Linux**: `~/.config/Lele Tools/lele.db`

Faça backup deste arquivo para migrar para outro computador.

### O app envia alguma coisa?

**Não.** Todas as funcionalidades rodam localmente. O app não coleta nenhum dado do usuário. As requisições de IA vão diretamente do processo principal do Electron para o provedor que você configurou — sem servidor intermediário.

## Sobre este projeto

### Por que reescrever em Electron e abandonar a versão Qt?

A versão Qt ([lele-tools](https://github.com/duhbbx/lele-tools)) cresceu para mais de 50 ferramentas, mas conforme o número aumentou, a carga de manutenção em C++/Qt — ambientes de build, empacotamento multiplataforma, manter a UI consistente — também cresceu. A stack web Electron + Vue 3 torna o desenvolvimento de UI mais rápido, a reutilização de componentes mais fácil, e a integração de IA (SSE em streaming, SDKs multi-provedor) completamente natural. A edição Electron começa do zero e gradualmente alcançará a versão Qt em quantidade de ferramentas.

### Quero adicionar uma ferramenta ou corrigir um bug — como contribuir?

1. Faça um fork do [repositório](https://github.com/duhbbx/lele-tools-electron)
2. Leia [Primeiros passos → Para desenvolvedores: adicionar uma nova ferramenta](/pt/docs/getting-started#para-desenvolvedores-adicionar-uma-nova-ferramenta) para a visão geral da arquitetura
3. Abra um Pull Request

Relatórios de bugs e solicitações de funcionalidades são bem-vindos via [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues).
