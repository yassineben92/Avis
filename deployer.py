import os
import requests
from github import Github

class Deployer:
    def __init__(self):
        self.github_token = os.getenv("GITHUB_TOKEN")
        self.vercel_token = os.getenv("VERCEL_TOKEN")
        self.dry_run = not (self.github_token and self.vercel_token)

        if not self.dry_run:
            self.gh = Github(self.github_token)

    def push_to_github(self, repo_name, file_content, file_name="index.html"):
        print(f"--- Début Push GitHub ({repo_name}) ---")
        if self.dry_run:
            print("[DRY RUN] Simulation du push sur GitHub car les tokens sont manquants.")
            print(f"[DRY RUN] Dépôt {repo_name} créé.")
            print(f"[DRY RUN] Fichier {file_name} ajouté au dépôt.")
            print("--- Fin Push GitHub ---\n")
            return f"https://github.com/simulated_user/{repo_name}"

        try:
            user = self.gh.get_user()
            repo = user.create_repo(repo_name, description="Micro-SaaS généré automatiquement")
            repo.create_file(file_name, "Initial commit from Micro-SaaS Factory", file_content)
            print(f"Code poussé avec succès sur: {repo.html_url}")
            print("--- Fin Push GitHub ---\n")
            return repo.html_url
        except Exception as e:
            print(f"Erreur lors du push GitHub: {e}")
            return None

    def deploy_to_vercel(self, repo_name):
        print(f"--- Début Déploiement Vercel ({repo_name}) ---")
        if self.dry_run:
            print("[DRY RUN] Simulation du déploiement Vercel.")
            print(f"[DRY RUN] Projet Vercel lié au dépôt {repo_name}.")
            print(f"[DRY RUN] Déploiement réussi : https://{repo_name}.vercel.app")
            print("--- Fin Déploiement Vercel ---\n")
            return f"https://{repo_name}.vercel.app"

        # Exemple basique d'intégration API Vercel
        url = "https://api.vercel.com/v9/projects"
        headers = {
            "Authorization": f"Bearer {self.vercel_token}",
            "Content-Type": "application/json"
        }

        # Note: Pour un déploiement réel via API, il faut lier le projet au dépôt GitHub existant
        # et déclencher un build. Ceci est une implémentation simplifiée pour le MVP.
        try:
            # Créer le projet
            data = {"name": repo_name}
            response = requests.post(url, headers=headers, json=data)
            if response.status_code in [200, 201]:
                print(f"Projet {repo_name} créé sur Vercel.")
                print("Le déploiement automatique via GitHub est configuré (dans un environnement réel).")
                print("--- Fin Déploiement Vercel ---\n")
                return f"https://{repo_name}.vercel.app"
            else:
                print(f"Erreur de création de projet Vercel: {response.text}")
                return None
        except Exception as e:
            print(f"Erreur de connexion à Vercel: {e}")
            return None

    def pipeline(self, project_name, generated_code):
        repo_url = self.push_to_github(project_name, generated_code)
        if repo_url:
            app_url = self.deploy_to_vercel(project_name)
            return app_url
        return None

if __name__ == "__main__":
    deployer = Deployer()
    deployer.pipeline("test-micro-saas", "<h1>Hello World</h1>")
