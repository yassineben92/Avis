# Usine à Micro-SaaS Auto-Déployables (Code-as-a-Service)

Ce projet implémente un pipeline autonome (Pipeline 1) qui identifie des problèmes sur internet, code une solution sous forme de Micro-SaaS, la déploie et simule une stratégie de monétisation.

## Architecture

Le système utilise une architecture multi-agents orchestrée par CrewAI :

1. **Agent Analyste** (`scraper.py`) : Scrape continuellement Reddit pour identifier des micro-problèmes récurrents en B2B.
2. **Agent Architecte & Développeur** (`developer.py`) : Rédige le cahier des charges et génère le code complet d'une application web Single-Page (HTML/JS/TailwindCSS).
3. **Agent Monétisation & SEO** (`monetization.py`) : Intègre un paywall simulé et génère des idées d'articles de blog pour l'acquisition organique.
4. **Pipeline CI/CD & Déploiement** (`deployer.py`) : Pousse le code généré sur GitHub et déclenche un déploiement sur Vercel.
5. **Orchestrateur** (`main.py`) : Relie tous les agents et processus.

## Installation

1. Cloner ce dépôt.
2. Installer les dépendances :
   ```bash
   pip install -r requirements.txt
   ```

## Configuration

Créez un fichier `.env` à la racine du projet et ajoutez vos clés API :

```env
# Essentiel pour CrewAI / LangChain
OPENAI_API_KEY=votre_cle_openai

# Optionnel (utilise des mocks si absent)
REDDIT_CLIENT_ID=votre_client_id_reddit
REDDIT_CLIENT_SECRET=votre_secret_reddit
REDDIT_USER_AGENT=MicroSaaSFactory/1.0

# Optionnel (utilise un mode dry-run si absent)
GITHUB_TOKEN=votre_token_github_pour_creer_des_repos
VERCEL_TOKEN=votre_token_vercel
```

## Utilisation

Lancer l'usine complète :

```bash
python main.py
```

Le script va :
1. Chercher un problème.
2. Générer le code d'une application pour le résoudre.
3. Ajouter un paywall.
4. Créer un repo GitHub et déployer sur Vercel.
5. Afficher les URLs générées.
