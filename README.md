# C Studio

Une application locale pour explorer le cours **Introduction à la programmation en ANSI-C de Fred Faber** : recherche, lecture des pages et des exemples, exercices, corrigés, favoris et assistant IA avec références vers le cours.

Le serveur est écrit en **Python**, l’interface en **HTML, CSS et JavaScript**. L’application utilise uniquement la bibliothèque standard de Python : aucune installation de paquets, aucun compte et aucune clé API.

## Lancer l’application

Prérequis : **Python 3.10 ou plus récent**.

Pour récupérer le projet depuis GitHub :

```bash
git clone https://github.com/Lol163636363/codeC.git
cd codeC
```

Dans le dossier de l’application :

```bash
bash lancer.sh
```

Tu peux aussi démarrer directement le serveur Python :

```bash
python3 app.py
```

Le navigateur s’ouvre sur **http://127.0.0.1:8765**. Si nécessaire, ouvre cette adresse manuellement. Utilise `Ctrl+C` dans le terminal pour arrêter l’application.

Par défaut, le cours est lu dans `~/Documents/cours/Cours_c_Faber`, dans le dossier personnel de l’utilisateur. Pour utiliser un autre emplacement :

```bash
python3 app.py --course /chemin/vers/Cours_c_Faber
```

Tu peux aussi placer une copie du cours dans un sous-dossier `cours/` à côté de `app.py` : elle sera détectée automatiquement. Les fichiers originaux ne sont pas modifiés.

Si le port est déjà occupé :

```bash
python3 app.py --port 8766
```

## Activer l’assistant IA

La recherche et la lecture fonctionnent immédiatement, sans IA ni Internet. L’assistant nécessite **[Ollama](https://ollama.com)** et un modèle installé sur ton ordinateur.

1. Lance Ollama s’il ne tourne pas déjà en arrière-plan :

   ```bash
   ollama serve
   ```

2. Dans un autre terminal, télécharge un modèle une seule fois :

   ```bash
   ollama pull qwen2.5:3b
   ```

3. Dans l’application, ouvre les réglages de l’assistant et clique sur **Vérifier la connexion**. Tu peux choisir un autre modèle déjà installé.

Le téléchargement du modèle nécessite Internet. Le modèle proposé occupe environ 1,9 Go sur disque ; son exécution demande aussi de la mémoire vive. La vitesse et la qualité des réponses dépendent du modèle et de l’ordinateur.

L’assistant recherche des passages pertinents, ajoute la page en cours de lecture et fournit ces sources au modèle. Les cartes sous la réponse permettent de relire les passages utilisés. Si Ollama est indisponible, l’application le signale et affiche les passages trouvés, sans inventer de réponse IA.

Les API utilisées sont [la liste des modèles locaux](https://docs.ollama.com/api/tags) et [la conversation](https://docs.ollama.com/api/chat). Le modèle proposé est décrit dans [la fiche officielle Qwen2.5 3B](https://ollama.com/library/qwen2.5:3b).

## Utilisation

- Recherche une notion ou une fonction : `pointeur`, `allocation dynamique`, `printf`, `scanf`, `exercice 8.15`…
- Filtre les résultats par chapitre et par type : cours, exercices ou corrigés.
- Clique sur une page pour conserver ses exemples de code, ses illustrations et ses liens internes.
- Utilise le signet **Garder** pour enregistrer une page dans les favoris du navigateur.
- Clique sur **M’expliquer** pour demander une explication de la page ouverte.
- `Ctrl+K` ouvre la recherche. Dans le chat, `Entrée` envoie et `Maj+Entrée` ajoute une ligne.

Les favoris et la dernière page lue sont enregistrés dans le navigateur. La conversation reste en mémoire jusqu’au rechargement de la page. Aucun service externe ni police distante n’est nécessaire. Par défaut, le serveur et Ollama sont accessibles uniquement sur l’ordinateur local.

## Vérifications

```bash
python3 app.py --check
python3 -m unittest discover -s tests -v
node --check static/app.js
```

Node n’est utile que pour cette dernière vérification de syntaxe ; il n’est pas nécessaire pour utiliser l’application. Les tests HTTP utilisent un transport en mémoire et ne nécessitent aucun port ouvert. Les tests du cours original sont ignorés si son dossier n’est pas présent.

## Configuration facultative

Variables d’environnement :

| Variable | Valeur par défaut | Rôle |
| --- | --- | --- |
| `COURSE_DIR` | Sous-dossier `cours/`, puis emplacement original | Emplacement du cours |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Adresse du serveur Ollama |
| `OLLAMA_MODEL` | Premier modèle installé | Modèle utilisé sans sélection dans l’interface |

Si tu configures un serveur Ollama distant, les questions et les passages seront envoyés à ce serveur. La configuration fournie utilise Ollama en local.

## Contenu et limites

Le cours reste attribué à **Fred Faber**. Le dépôt contient le code et les tests, pas les fichiers du cours ni les modèles d’IA. Il faut disposer des pages HTML du cours sur son ordinateur pour utiliser l’application.

Il s’agit d’un cours historique d’ANSI-C. Certains exemples utilisent des pratiques anciennes comme `gets` ou une déclaration implicite de `main`. L’interface rappelle ce contexte et l’assistant reçoit pour instruction de distinguer ces exemples des pratiques modernes. Les réponses d’un modèle peuvent contenir des erreurs : les sources sont fournies pour les vérifier. L’application n’exécute pas les exemples C.

L’interface et la recherche sont validées par des contrôles automatiques. Dans l’environnement de création, les restrictions réseau empêchent l’ouverture du serveur local et l’appel réel à Ollama ; le fonctionnement avec un modèle réel reste à vérifier sur ton ordinateur.
