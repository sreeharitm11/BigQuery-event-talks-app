import time
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "updated_at": 0,
    "feed_info": None
}
CACHE_DURATION = 300  # 5 minutes in seconds

def parse_feed_entries(feed):
    parsed_entries = []
    for entry in feed.entries:
        date_str = entry.get("title", "")
        updated_str = entry.get("updated", "")
        link_str = entry.get("link", "")
        entry_id = entry.get("id", "")
        
        # Get HTML content
        content_html = ""
        if entry.get("content"):
            content_html = entry.get("content")[0].get("value", "")
        elif entry.get("summary"):
            content_html = entry.get("summary")
            
        soup = BeautifulSoup(content_html, "html.parser")
        
        # Split content by h3 tags (which Google uses for types like Feature, Issue, etc.)
        items = []
        current_type = None
        current_html_parts = []
        
        for child in soup.contents:
            if child.name == "h3":
                # Save previous item
                if current_type and current_html_parts:
                    item_content = "".join(str(c) for c in current_html_parts).strip()
                    item_soup = BeautifulSoup(item_content, "html.parser")
                    clean_text = item_soup.get_text()
                    items.append({
                        "type": current_type,
                        "html": item_content,
                        "text": clean_text
                    })
                current_type = child.get_text().strip()
                current_html_parts = []
            else:
                if current_type:
                    current_html_parts.append(child)
                    
        # Save the last item
        if current_type and current_html_parts:
            item_content = "".join(str(c) for c in current_html_parts).strip()
            item_soup = BeautifulSoup(item_content, "html.parser")
            clean_text = item_soup.get_text()
            items.append({
                "type": current_type,
                "html": item_content,
                "text": clean_text
            })
            
        # If no items were parsed (perhaps no h3 tags?), put the whole content as "Update"
        if not items:
            clean_text = soup.get_text()
            items.append({
                "type": "Update",
                "html": content_html,
                "text": clean_text
            })
            
        parsed_entries.append({
            "date": date_str,
            "updated": updated_str,
            "link": link_str,
            "id": entry_id,
            "items": items
        })
    return parsed_entries

def fetch_feed(force_refresh=False):
    now = time.time()
    
    # Check cache validity
    if not force_refresh and cache["data"] and (now - cache["updated_at"] < CACHE_DURATION):
        return cache["data"], cache["feed_info"], cache["updated_at"], "cached"
        
    try:
        # Fetch RSS feed
        feed = feedparser.parse(FEED_URL)
        
        # Check for parse errors when no entries are returned
        if feed.bozo and not feed.entries:
            # If parsing failed but we have cache, return stale cache as backup
            if cache["data"]:
                return cache["data"], cache["feed_info"], cache["updated_at"], "stale_backup"
            raise Exception(f"Failed to fetch or parse RSS feed: {feed.bozo_exception}")
            
        entries = parse_feed_entries(feed)
        
        feed_info = {
            "title": feed.feed.get("title", "BigQuery Release Notes"),
            "subtitle": feed.feed.get("subtitle", "Google Cloud BigQuery release updates"),
            "link": feed.feed.get("link", "https://cloud.google.com/bigquery/docs/release-notes"),
            "generator": feed.feed.get("generator", "Google Cloud Docs")
        }
        
        # Update cache
        cache["data"] = entries
        cache["feed_info"] = feed_info
        cache["updated_at"] = now
        
        return entries, feed_info, now, "live"
    except Exception as e:
        # If error occurs but cache exists, return cache
        if cache["data"]:
            return cache["data"], cache["feed_info"], cache["updated_at"], "error_fallback"
        raise e

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def release_notes_api():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        entries, feed_info, updated_at, source = fetch_feed(force_refresh)
        return jsonify({
            "success": True,
            "source": source,
            "updated_at": updated_at,
            "feed_info": feed_info,
            "entries": entries
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
