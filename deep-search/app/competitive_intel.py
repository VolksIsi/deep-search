# Competitive Intelligence Engine — Daily monitoring of competitors
import asyncio
import logging
import json
from datetime import datetime
from typing import Any

import requests
from bs4 import BeautifulSoup

from .memory import (
    get_competitors, add_competitive_alert, get_competitive_alerts
)

logger = logging.getLogger(__name__)


async def scan_competitor(company: str, domain: str, keywords: str) -> list[dict[str, Any]]:
    """Scan for recent news and activity about a competitor.
    
    Uses Google Search API-compatible scraping to find recent competitor news,
    product launches, and market movements.
    """
    alerts = []
    search_queries = [
        f"{company} latest news {datetime.now().strftime('%Y')}",
        f"{company} product launch announcement",
        f"{company} funding investment acquisition",
    ]
    
    if keywords:
        for kw in keywords.split(","):
            search_queries.append(f"{company} {kw.strip()}")
    
    for query in search_queries[:5]:  # Limit to 5 queries per competitor
        try:
            # Use a news-focused search approach
            url = f"https://news.google.com/search?q={query.replace(' ', '+')}&hl=en"
            response = requests.get(url, timeout=15, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; ResearchAgent/1.0)'
            })
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract article titles as potential alerts
                articles = soup.find_all('article')[:3]
                for article in articles:
                    title_elem = article.find(['h3', 'h4', 'a'])
                    if title_elem:
                        title = title_elem.get_text(strip=True)
                        link = title_elem.get('href', '')
                        if title and len(title) > 10:
                            alerts.append({
                                "type": "news",
                                "title": title[:200],
                                "summary": f"Detected via: '{query}'",
                                "url": link if link.startswith('http') else f"https://news.google.com{link}",
                                "significance": 0.6
                            })
        except Exception as e:
            logger.warning(f"Scan error for '{query}': {e}")
            continue
    
    return alerts


async def run_competitive_scan(user_id: str) -> dict[str, Any]:
    """Run a full competitive intelligence scan for all monitored competitors."""
    competitors = get_competitors(user_id)
    active = [c for c in competitors if c.get("active", True)]
    
    if not active:
        return {"status": "no_targets", "message": "No active competitors to monitor."}
    
    total_alerts = 0
    scan_results = []
    
    for comp in active:
        try:
            alerts = await scan_competitor(
                comp["company"], 
                comp.get("domain", ""), 
                comp.get("keywords", "")
            )
            
            for alert in alerts:
                add_competitive_alert(
                    target_id=comp["id"],
                    alert_type=alert["type"],
                    title=alert["title"],
                    summary=alert["summary"],
                    source_url=alert.get("url", ""),
                    significance=alert.get("significance", 0.5)
                )
                total_alerts += 1
            
            scan_results.append({
                "company": comp["company"],
                "alerts_found": len(alerts)
            })
            
        except Exception as e:
            logger.error(f"Error scanning {comp['company']}: {e}")
            scan_results.append({
                "company": comp["company"],
                "error": str(e)
            })
    
    return {
        "status": "completed",
        "scanned": len(active),
        "total_alerts": total_alerts,
        "results": scan_results,
        "timestamp": datetime.now().isoformat()
    }


def get_competitor_dashboard(user_id: str) -> dict[str, Any]:
    """Get a full competitive intelligence dashboard view."""
    competitors = get_competitors(user_id)
    alerts = get_competitive_alerts(user_id, limit=100)
    unread_alerts = get_competitive_alerts(user_id, unread_only=True)
    
    # Group alerts by company
    company_alerts: dict[str, list] = {}
    for alert in alerts:
        company = alert.get("company", "Unknown")
        if company not in company_alerts:
            company_alerts[company] = []
        company_alerts[company].append(alert)
    
    return {
        "competitors": competitors,
        "total_alerts": len(alerts),
        "unread_count": len(unread_alerts),
        "alerts_by_company": company_alerts,
        "recent_alerts": alerts[:20],
    }
