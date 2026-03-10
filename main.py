import os
import re
from dotenv import load_dotenv
from crewai import Crew, Task, Process
from scraper import create_analyst_agent
from developer import create_developer_agent
from monetization import create_monetization_agent
from deployer import Deployer

# Charger les variables d'environnement (.env)
load_dotenv()

def extract_code(text):
    """Extrait le code d'un bloc markdown (ex: ```html ... ```) ou retourne le texte complet."""
    match = re.search(r'```(?:html)?(.*?)```', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

def run_factory():
    print("🚀 Démarrage de l'Usine à Micro-SaaS...\n")

    # Vérification des clés API (Warning si manquantes)
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  ATTENTION: OPENAI_API_KEY non trouvée. CrewAI risque de ne pas fonctionner.")
        print("Si vous n'avez pas de clé, le script s'arrêtera ici lors de l'appel LLM.\n")

    # 1. Instanciation des Agents
    analyst = create_analyst_agent()
    developer = create_developer_agent()
    monetizer = create_monetization_agent()

    # 2. Définition des Tâches
    task_scrape = Task(
        description="Utilise l'outil 'Scrape Reddit for problems' pour trouver un problème récurrent dans le subreddit 'SaaS'. Choisis le problème le plus pertinent et décris-le en une phrase claire qui servira de cahier des charges.",
        expected_output="Une description courte et claire d'un problème métier récurrent (ex: 'Les utilisateurs ont besoin d'un outil pour convertir des CSV spécifiques').",
        agent=analyst
    )

    task_develop = Task(
        description="Prends le problème identifié par l'analyste et génère une application web monopage (Single-Page Application) complète en HTML/CSS/JS utilisant TailwindCSS pour résoudre ce problème. Le design doit être moderne (Dark mode par défaut, minimalist). Renvoie UNIQUEMENT le code HTML complet encapsulé dans des backticks ```html ... ```.",
        expected_output="Le code source complet de l'application web monopage en HTML/JS/Tailwind, encapsulé dans un bloc ```html ... ```.",
        agent=developer
    )

    task_monetize = Task(
        description="Prends le code HTML généré par le développeur. Ajoute un script JS fictif simulant un paywall Stripe (ex: 'Vous avez utilisé vos 3 essais gratuits. Abonnez-vous pour 5$/mois.'). Renvoie le code HTML final complet. Ensuite, propose 1 titre d'article de blog optimisé SEO pour attirer du trafic ciblé vers cet outil.",
        expected_output="Le code HTML final incluant la logique de monétisation encapsulé dans un bloc ```html ... ```, suivi d'une proposition de titre d'article SEO.",
        agent=monetizer
    )

    # 3. Création du Crew (Équipe)
    factory_crew = Crew(
        agents=[analyst, developer, monetizer],
        tasks=[task_scrape, task_develop, task_monetize],
        process=Process.sequential,
        verbose=True
    )

    # 4. Exécution du Pipeline (si OPENAI_API_KEY est présente)
    if os.getenv("OPENAI_API_KEY"):
        print("🤖 Les agents commencent leur travail...")
        result = factory_crew.kickoff()
        print("\n✅ Génération terminée.")

        # Le résultat brut contient la sortie de la dernière tâche (task_monetize)
        final_output = result.raw
        html_code = extract_code(final_output)

        # 5. Déploiement
        print("\n📦 Démarrage du déploiement...")
        deployer = Deployer()
        # On génère un nom de projet aléatoire basé sur le temps ou fixe pour l'exemple
        project_name = "micro-saas-auto-gen"
        app_url = deployer.pipeline(project_name, html_code)

        if app_url:
            print(f"\n🎉 SUCCÈS ! Votre Micro-SaaS est 'déployé' à l'adresse : {app_url}")
            print("\nVoici un aperçu de la stratégie SEO et du code généré :")
            print(final_output[:500] + "...\n[Code tronqué pour l'affichage]")
        else:
            print("\n❌ Le déploiement a échoué.")
    else:
        print("❌ L'exécution est bloquée car OPENAI_API_KEY est manquante. Veuillez configurer votre fichier .env.")

if __name__ == "__main__":
    run_factory()
