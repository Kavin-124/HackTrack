# ⚡ HackTrack — Universal Hackathon Deadline Tracker

Never miss a hackathon round or submission deadline again! **HackTrack** is a high-performance Chrome extension designed for student hackers and developers. It automatically detects and tracks hackathons across **Unstop, Devfolio, Devpost, HackerEarth**, or **any college symposium / event webpage**.

---

## 🌟 Key Features

1. **Auto-Detection Engine:**
   - Detects hackathon title, rounds, and submission deadlines on **Unstop**, **Devfolio**, **Devpost**, and **HackerEarth**.
   - Smart keyword & date scanner for **generic college symposiums**, Google Forms, and custom landing pages.
   - Right-click selection context menu: *"Track deadline in HackTrack: <selection>"*.

2. **1-Click Google Calendar Sync:**
   - Pre-populates all hackathon stages and deadlines.
   - Automatically sets **3 priority reminders** (1 day before, 3 hours before, 30 minutes before) directly in your Google Calendar (syncs with phone alarms).

3. **1-Click WhatsApp Share:**
   - Instantly creates formatted team alerts with emojis, rounds breakdown, deadlines, and direct links ready to share into WhatsApp groups.

4. **Offline .ICS Export:**
   - Download `.ics` calendar files compatible with Apple Calendar, Outlook, and offline calendar apps.

5. **Local Desktop Notifications & Alarms:**
   - Utilizes `chrome.alarms` and `chrome.notifications` to deliver high-priority desktop notifications:
     - 🚨 24 Hours before deadline
     - 🔥 3 Hours before deadline (Final call)
     - ⏰ 30 Minutes before (Last chance to upload PPT/Code)
     - 🏁 At the deadline moment

6. **Tracked Hackathons Dashboard:**
   - Live dynamic countdown timers (`⏳ 2d 14h left`, `🚨 2h 45m left - URGENT`).
   - Filter by Active, Urgent, or Completed.
   - Search across all tracked events.
   - Backup/Export to JSON.

---

## 🚀 How to Install in Chrome / Edge / Brave (Takes 30 Seconds)

1. Open **Google Chrome** (or Edge / Brave).
2. Go to `chrome://extensions/` in the address bar.
3. Turn ON **"Developer mode"** (top right corner toggle switch).
4. Click the **"Load unpacked"** button (top left).
5. Select this folder:
   ```text
   D:\Antigravity\Project\HackTrack
   ```
6. Done! Pin **HackTrack** to your browser toolbar!

---

## 🧪 Quick Test (Try it right now!)

1. Double-click or open `demo_unstop_page.html` in your browser:
   ```text
   d:\Antigravity\Project\HackTrack\demo_unstop_page.html
   ```
2. Click the **HackTrack** extension icon in your browser toolbar.
3. You will see:
   - Platform detected as **Unstop**
   - Title: `Smart India Innovate Hackathon 2026`
   - All 3 rounds automatically loaded with exact dates & times!
4. Click:
   - **"Save & Set Reminders"** to track it.
   - **"📅 Google Calendar"** to see your Google Calendar event prefilled.
   - **"💬 WhatsApp"** to preview the formatted group message.

---

## 📁 Project Structure

```text
HackTrack/
├── manifest.json            # Manifest V3 extension configuration
├── icons/                   # High-res icons (16px, 48px, 128px)
├── popup/
│   ├── popup.html           # Modern dark-mode popup interface
│   ├── popup.css            # Styles with glassmorphism & urgency glow
│   └── popup.js             # Logic for auto-extraction, calendar, WhatsApp & storage
├── scripts/
│   ├── content.js           # Multi-platform DOM scraper & date parser
│   └── background.js        # Service worker for alarms, desktop push & context menus
├── demo_unstop_page.html    # Interactive test hackathon page
└── README.md                # Documentation & Setup guide
```
