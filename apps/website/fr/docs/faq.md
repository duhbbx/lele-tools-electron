# FAQ

## Installation et lancement

### macOS indique que l'application est « endommagée » ou « ne peut pas être ouverte »

L'application n'a pas été notarisée par Apple (la notarisation coûte 99 $/an — pas rentable pour un projet open source). Exécutez ceci une fois dans le Terminal pour effacer le drapeau de quarantaine :

```bash
xattr -dr com.apple.quarantine "/Applications/Lele Tools.app"
```

Alternativement : faites un clic droit sur l'application → Ouvrir → Ouvrir quand même. C'est une étape unique ; après cela, vous pouvez la lancer normalement par double-clic.

### Erreur au lancement sous Linux

Les paquets `.deb` / `.rpm` déclarent leurs dépendances, donc une installation normale via le gestionnaire de paquets les téléchargera automatiquement. Si vous avez installé manuellement et obtenez une erreur de bibliothèque manquante, installez le paquet système indiqué. L'AppImage embarque son propre environnement d'exécution et ne nécessite aucune dépendance supplémentaire.

## Assistant IA

### L'IA ne se connecte pas / les requêtes échouent

Vérifiez dans cet ordre :

1. **Vérifiez votre clé API** : allez dans Paramètres → Assistant IA et assurez-vous que la clé est complète — sans espaces supplémentaires ni caractères manquants.
2. **Vérifiez la BaseURL** : si vous utilisez un endpoint personnalisé, confirmez qu'il n'y a pas de barre oblique finale et que l'adresse est accessible.
3. **Proxy réseau** : OpenAI, Claude et Grok nécessitent un proxy depuis certaines régions. DeepSeek et Ollama (local) fonctionnent sans.
4. **Tester la connexion** : utilisez le bouton « Tester la connexion » dans la page de paramètres pour voir l'erreur exacte.
5. **Ollama** : assurez-vous que le service Ollama local est en cours d'exécution (par défaut `http://localhost:11434`) et que vous avez téléchargé le modèle souhaité (`ollama pull <modèle>`).

## Données et confidentialité

### Où mes données sont-elles stockées ?

Tout est stocké dans une base de données SQLite locale :

- **macOS** : `~/Library/Application Support/Lele Tools/lele.db`
- **Windows** : `%APPDATA%\Lele Tools\lele.db`
- **Linux** : `~/.config/Lele Tools/lele.db`

Sauvegardez ce fichier pour migrer vers un autre appareil.

### L'application envoie-t-elle des données ?

**Non.** Toutes les fonctionnalités s'exécutent localement. L'application ne collecte aucune donnée utilisateur. Les requêtes IA vont directement du processus principal Electron au fournisseur que vous avez configuré — sans serveur intermédiaire.

## À propos du projet

### Pourquoi réécrire en Electron et abandonner la version Qt ?

La version Qt ([lele-tools](https://github.com/duhbbx/lele-tools)) a grandi jusqu'à plus de 50 outils, mais à mesure que le nombre augmentait, la charge de maintenance C++/Qt — environnements de compilation, packaging multiplateforme, cohérence de l'interface — ne cessait de croître. La stack web Electron + Vue 3 rend le développement UI plus rapide, la réutilisation de composants plus simple, et l'intégration IA (SSE en streaming, SDKs multi-fournisseurs) totalement naturelle. L'édition Electron repart de zéro et rattrapera progressivement la version Qt en nombre d'outils.

### Je veux ajouter un outil ou corriger un bug — comment contribuer ?

1. Forkez le [dépôt](https://github.com/duhbbx/lele-tools-electron)
2. Lisez [Premiers pas → Pour les développeurs : ajouter un nouvel outil](/fr/docs/getting-started#pour-les-développeurs-ajouter-un-nouvel-outil) pour une vue d'ensemble de l'architecture
3. Ouvrez une Pull Request

Les rapports de bugs et les demandes de fonctionnalités sont les bienvenus via [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues).
