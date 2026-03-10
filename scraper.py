import os
import praw
from crewai import Agent
from langchain.tools import tool

class RedditScraper:
    def __init__(self):
        self.client_id = os.getenv("REDDIT_CLIENT_ID")
        self.client_secret = os.getenv("REDDIT_CLIENT_SECRET")
        self.user_agent = os.getenv("REDDIT_USER_AGENT", "MicroSaaSFactory/1.0")

        self.use_mock = not (self.client_id and self.client_secret)

        if not self.use_mock:
            self.reddit = praw.Reddit(
                client_id=self.client_id,
                client_secret=self.client_secret,
                user_agent=self.user_agent
            )

    def scrape_problems(self, subreddit_name="SaaS", limit=10):
        if self.use_mock:
            print("Using mock data for Reddit scraper (credentials missing)")
            return "I run a small online business and I constantly struggle with formatting specific CSV files from my suppliers into a standard format my system can read. It takes me hours every week."

        problems = []
        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            for post in subreddit.hot(limit=limit):
                if "how" in post.title.lower() or "help" in post.title.lower() or "struggle" in post.title.lower():
                    problems.append(f"Title: {post.title}\nContent: {post.selftext[:500]}")

            if not problems:
                return "No clear problems identified."

            return "\n\n".join(problems[:3]) # Return top 3 issues
        except Exception as e:
            return f"Error scraping reddit: {e}"

@tool("Scrape Reddit for problems")
def scrape_reddit_for_problems(subreddit: str = "SaaS") -> str:
    """Scrape Reddit to find recurring problems and complaints that could be solved with a Micro-SaaS."""
    scraper = RedditScraper()
    return scraper.scrape_problems(subreddit)

def create_analyst_agent():
    return Agent(
        role='Analyste de Marché Micro-SaaS',
        goal='Identifier des problèmes douloureux et récurrents sur des plateformes B2B (comme Reddit) qui peuvent être résolus par une application web simple.',
        backstory='Tu es un expert en recherche de marché qui sait lire entre les lignes des plaintes des utilisateurs pour trouver des opportunités de micro-SaaS rentables.',
        verbose=True,
        allow_delegation=False,
        tools=[scrape_reddit_for_problems]
    )

if __name__ == "__main__":
    scraper = RedditScraper()
    print("Scraped:", scraper.scrape_problems())
