import os
from dotenv import load_dotenv

load_dotenv()

# Flask
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
FLASK_ENV = os.getenv("FLASK_ENV", "development")

# Anthropic
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# SendGrid
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "bulletin@example.com")
FROM_NAME = os.getenv("FROM_NAME", "Daily Bulletin")

# NewsAPI
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
NEWS_API_BASE = "https://newsapi.org/v2"

# Credential encryption
CREDENTIAL_ENCRYPTION_KEY = os.getenv("CREDENTIAL_ENCRYPTION_KEY", "")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///bulletin.db")

# Scheduler
SEND_HOUR = int(os.getenv("SEND_HOUR", "7"))
SEND_MINUTE = int(os.getenv("SEND_MINUTE", "0"))
TIMEZONE = os.getenv("TIMEZONE", "America/New_York")

# Supported topics
TOPICS = [
    "news",
    "politics",
    "business",
    "marketing",
    "celebrity",
]

# Supported paywalled sources (slugs → display names)
PAYWALLED_SOURCES = {
    "nytimes": "New York Times",
    "wsj": "Wall Street Journal",
    "theatlantic": "The Atlantic",
    "ft": "Financial Times",
    "bloomberg": "Bloomberg",
    "economist": "The Economist",
}

# Open RSS/API source feeds per topic
RSS_FEEDS = {
    "news": [
        "https://feeds.bbci.co.uk/news/rss.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "https://www.theguardian.com/world/rss",
    ],
    "politics": [
        "https://feeds.bbci.co.uk/news/politics/rss.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
        "https://www.theguardian.com/politics/rss",
    ],
    "business": [
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
        "https://www.theguardian.com/uk/business/rss",
    ],
    "marketing": [
        "https://feeds.feedburner.com/marketingland/fKtH",
        "https://adage.com/rss",
        "https://www.marketingweek.com/feed/",
    ],
    "celebrity": [
        "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
        "https://people.com/feed/",
        "https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml",
    ],
}

# Articles to fetch per topic
ARTICLES_PER_TOPIC = 5
