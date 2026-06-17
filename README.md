# BigQuery Release Pulse 🚀

A premium, interactive web dashboard built with **Python Flask** and **Vanilla HTML, CSS, and JavaScript** that fetches, structures, and simplifies reading the official Google Cloud BigQuery Release Notes feed. It includes dynamic update segmenting, server-side caching, robust search & filtering, and a custom Tweet composer to post updates directly to X (Twitter).

---

## ✨ Features

*   **⚡ Intelligent Parsing & Segmentation**: Splits combined daily release notes into individual cards based on update categories (Features, Issues, Announcements, Deprecated, Resolved).
*   **💾 Smart In-Memory Cache**: Uses a 5-minute cache TTL on the Flask server to ensure instantaneous page loads, with a force-refresh capability built into the client.
*   **🔍 Instant Full-Text Search**: Search and filter updates instantly on the client side without making extra requests to the backend.
*   **🐦 Custom Tweet Composer**: Highlight any release note, click **Tweet**, customize the pre-formatted tweet text, verify the 280-character limit, and share it to X safely via Web Intents.
*   **✨ Premium Visual Design**: Crafted with a modern dark theme, glowing gradients, glassmorphism panels, customized badge indicators, and shimmering skeleton loaders.

---

## 🛠️ Technology Stack

*   **Backend**: Python 3.12, Flask, `feedparser` (RSS/Atom parsing), `BeautifulSoup` (HTML segmenting)
*   **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom variables and animation keyframes), Vanilla ECMAScript (client-side state management)
*   **Icons & Fonts**: Inline SVGs, Space Grotesk (headers), Plus Jakarta Sans (body)

---

## 📂 Project Structure

```text
├── app.py                # Flask server, memory caching & XML feed parser
├── requirements.txt      # Python dependencies
├── .gitignore            # Git exclusion rules
├── templates/
│   └── index.html        # HTML layout, inline SVGs, modals
└── static/
    ├── css/
    │   └── styles.css    # Premium CSS styling variables & animations
    └── js/
        └── app.js        # Feed fetcher, filters, toasts & tweet composer logic
```

---

## 🚀 Quick Start

### 1. Prerequisite
Ensure you have **Python 3.12+** installed on your system.

### 2. Set Up Virtual Environment & Dependencies
Navigate to your project root folder and execute:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the Server
Start the local development server:

```bash
python app.py
```

The Flask server will start running at:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📜 License

This project is licensed under the MIT License.
