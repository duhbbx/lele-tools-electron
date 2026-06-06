# Premiers pas

## Installation

Rendez-vous sur la page [Télécharger](/fr/download) pour récupérer l'installateur correspondant à votre plateforme, puis suivez les étapes ci-dessous.

- **Windows** : Double-cliquez sur l'installateur `.exe` et suivez l'assistant.
- **macOS** : Ouvrez le `.dmg`, faites glisser l'application dans votre dossier Applications. Si macOS indique que l'application est « endommagée », consultez la [FAQ](/fr/docs/faq).
- **Linux** : Installez via le paquet `.deb` / `.rpm`, ou exécutez directement le `.AppImage`.

Pas encore de version officielle ? Consultez [Compiler depuis les sources](/fr/download#compiler-depuis-les-sources) pour le faire vous-même.

## Organisation de l'interface

L'application est divisée en trois zones :

**Barre latérale gauche** : Répertorie tous les outils avec une barre de recherche par mots-clés ; les outils récemment utilisés apparaissent en bas. Cliquez sur un outil pour l'ouvrir dans un onglet à droite.

**Zone multi-onglets à droite** : Chaque outil dispose de son propre onglet. Ouvrez-en autant que vous le souhaitez — ils ne s'interfèrent pas. La fermeture d'un onglet conserve le contenu non sauvegardé (il est restauré à la réouverture de l'outil).

**Panneau IA** : Cliquez sur l'icône IA en haut à droite pour déplier le panneau latéral. Disponible depuis n'importe quel outil — collez du contenu et posez vos questions directement. L'historique des conversations est sauvegardé automatiquement dans la base de données locale.

## Configuration de l'assistant IA

Vous devez configurer un fournisseur avant d'utiliser l'assistant IA pour la première fois :

1. Cliquez sur l'icône **Paramètres** dans la barre d'outils en haut à droite (ou appuyez sur `Ctrl/Cmd + ,`).
2. Allez dans l'onglet **Assistant IA** et choisissez un fournisseur :

| Fournisseur | Clé API requise |
|-------------|----------------|
| Claude (Anthropic) | Oui |
| OpenAI | Oui |
| DeepSeek | Oui |
| Codex (OpenAI Codex) | Oui |
| Grok (xAI) | Oui |
| Ollama (local) | Non — configurez simplement la BaseURL |

3. Saisissez votre clé API (pour Ollama, entrez l'adresse locale — par défaut `http://localhost:11434`), puis cliquez sur **Tester la connexion** pour vérifier.
4. Sauvegardez et fermez les Paramètres. Le panneau IA est maintenant prêt à l'emploi.

> **Note pour les utilisateurs nécessitant un proxy :** OpenAI, Claude et Grok ne sont accessibles qu'avec un proxy depuis certaines régions. DeepSeek et Ollama (local) fonctionnent sans.

## Pour les développeurs : ajouter un nouvel outil

Trois étapes :

**Étape 1** : Créez `meta.ts` et `Tool.vue` dans `packages/ui/src/tools/<id>/` :

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

**Étape 2** : Enregistrez-le à la fin du tableau `TOOLS` dans `packages/ui/src/tools/index.ts` :

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...outils existants
  myTool,
]
```

**Étape 3** : Lancez `pnpm dev` — le nouvel outil apparaît immédiatement dans la barre latérale gauche.
