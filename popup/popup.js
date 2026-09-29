/**
 * HackTrack - Popup Controller
 * Manages extraction, Google Calendar sync, WhatsApp share, ICS download & alarm notifications
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");
  const platformBadge = document.getElementById("platformBadge");
  const statusNotice = document.getElementById("statusNotice");

  // Tab 1 Elements
  const hackathonTitle = document.getElementById("hackathonTitle");
  const hackathonPlatform = document.getElementById("hackathonPlatform");
  const hackathonUrl = document.getElementById("hackathonUrl");
  const roundsList = document.getElementById("roundsList");
  const btnAddRound = document.getElementById("btnAddRound");
  const btnSave = document.getElementById("btnSave");
  const btnQuickGCal = document.getElementById("btnQuickGCal");
  const btnQuickWhatsApp = document.getElementById("btnQuickWhatsApp");
  const btnQuickIcs = document.getElementById("btnQuickIcs");

  // Tab 2 Elements
  const searchInput = document.getElementById("searchInput");
  const filterPills = document.querySelectorAll(".filter-pill");
  const hackathonsContainer = document.getElementById("hackathonsContainer");
  const trackedCountBadge = document.getElementById("trackedCountBadge");

  // Tab 3 Elements
  const setNotify24h = document.getElementById("setNotify24h");
  const setNotify3h = document.getElementById("setNotify3h");
  const setNotify30m = document.getElementById("setNotify30m");
  const setNotifyDue = document.getElementById("setNotifyDue");
  const btnExportJson = document.getElementById("btnExportJson");
  const btnClearCompleted = document.getElementById("btnClearCompleted");

  // Teammates & WhatsApp Modal Elements
  const inputTeammateName = document.getElementById("inputTeammateName");
  const inputTeammatePhone = document.getElementById("inputTeammatePhone");
  const btnAddTeammate = document.getElementById("btnAddTeammate");
  const teammatesList = document.getElementById("teammatesList");

  const waModal = document.getElementById("waModal");
  const btnCancelWaModal = document.getElementById("btnCancelWaModal");
  const btnWaGroup = document.getElementById("btnWaGroup");
  const btnWaBroadcast = document.getElementById("btnWaBroadcast");
  const waModalTeammatesList = document.getElementById("waModalTeammatesList");
  const btnManageTeammatesFromModal = document.getElementById("btnManageTeammatesFromModal");
  const quickWaNumber = document.getElementById("quickWaNumber");
  const btnQuickWaSend = document.getElementById("btnQuickWaSend");

  let currentTabId = "track";
  let activeFilter = "all";
  let extractedRounds = [];

  // 1. Navigation Tab Switching
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      currentTabId = target;

      navTabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      if (target === "track") document.getElementById("tabTrack").classList.add("active");
      else if (target === "list") {
        document.getElementById("tabList").classList.add("active");
        renderHackathons();
      } else if (target === "settings") {
        document.getElementById("tabSettings").classList.add("active");
        loadSettings();
        loadTeammates();
      }
    });
  });

  // Filter Pills in My Tracked
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      activeFilter = pill.dataset.filter;
      renderHackathons();
    });
  });

  searchInput.addEventListener("input", () => {
    renderHackathons();
  });

  // Format ISO or Date object to DD/MM/YYYY hh:mm AM/PM
  function formatToDDMMYYYY(dateInput) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    
    const pad = (n) => String(n).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const mins = pad(d.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = pad(hours);
    
    return `${day}/${month}/${year} ${hoursStr}:${mins} ${ampm}`;
  }

  // Parse DD/MM/YYYY hh:mm AM/PM to ISO string
  function parseDDMMYYYYToIso(str) {
    if (!str) return null;
    const m = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = parseInt(m[3], 10);
      let hours = m[4] ? parseInt(m[4], 10) : 23;
      let mins = m[5] ? parseInt(m[5], 10) : 59;
      const ampm = m[6] ? m[6].toUpperCase() : null;
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      
      const d = new Date(year, month, day, hours, mins, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback.toISOString();
    return null;
  }

  // Helper: Format Date for datetime-local input (YYYY-MM-DDTHH:mm)
  function toDateTimeLocalString(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const y = dateObj.getFullYear();
    const m = pad(dateObj.getMonth() + 1);
    const d = pad(dateObj.getDate());
    const h = pad(dateObj.getHours());
    const min = pad(dateObj.getMinutes());
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  // 2. Add / Render Round Row in Form
  function createRoundElement(name = "Round", isoDate = "") {
    const card = document.createElement("div");
    card.className = "round-item-card";

    let dateObj = null;
    if (isoDate) {
      const d = new Date(isoDate);
      if (!isNaN(d.getTime())) {
        dateObj = d;
      }
    }

    if (!dateObj) {
      dateObj = new Date(Date.now() + 24 * 60 * 60 * 1000);
      dateObj.setHours(23, 59, 0, 0);
    }

    const dmyDisplay = formatToDDMMYYYY(dateObj);
    const pickerVal = toDateTimeLocalString(dateObj);

    card.innerHTML = `
      <div class="round-item-top">
        <input type="text" class="round-name-input" value="${escapeHtml(name)}" placeholder="Round / Milestone Name">
        <button type="button" class="btn-remove-round" title="Delete Round">✕</button>
      </div>
      <div class="date-input-wrapper">
        <input type="text" class="round-date-input" value="${dmyDisplay}" placeholder="DD/MM/YYYY hh:mm AM/PM">
        <div class="round-picker-btn" title="Pick from calendar">
          📅
          <input type="datetime-local" class="round-picker-hidden" value="${pickerVal}">
        </div>
      </div>
    `;

    const textInput = card.querySelector(".round-date-input");
    const pickerInput = card.querySelector(".round-picker-hidden");

    pickerInput.addEventListener("input", () => {
      if (pickerInput.value) {
        const d = new Date(pickerInput.value);
        if (!isNaN(d.getTime())) {
          textInput.value = formatToDDMMYYYY(d);
        }
      }
    });

    card.querySelector(".btn-remove-round").addEventListener("click", () => {
      card.remove();
    });

    roundsList.appendChild(card);
  }

  btnAddRound.addEventListener("click", () => {
    createRoundElement(`Round ${roundsList.children.length + 1}`, "");
  });

  // 3. Auto-Extract from Active Tab
  async function detectCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showPlatformBadge("Generic Web Page", "generic");
        createRoundElement("Submission Deadline", "");
        return;
      }

      hackathonUrl.value = tab.url;

      // Determine platform from URL
      const urlLower = tab.url.toLowerCase();
      let detectedPlatform = "Generic Page";
      let badgeClass = "generic";

      if (urlLower.includes("unstop.com")) {
        detectedPlatform = "Unstop";
        badgeClass = "unstop";
      } else if (urlLower.includes("devfolio.co")) {
        detectedPlatform = "Devfolio";
        badgeClass = "devfolio";
      } else if (urlLower.includes("devpost.com")) {
        detectedPlatform = "Devpost";
        badgeClass = "devpost";
      } else if (urlLower.includes("hackerearth.com")) {
        detectedPlatform = "HackerEarth";
        badgeClass = "hackerearth";
      } else {
        try {
          const parsed = new URL(tab.url);
          detectedPlatform = parsed.hostname.replace("www.", "");
        } catch (e) {
          detectedPlatform = "Website";
        }
      }

      showPlatformBadge(detectedPlatform, badgeClass);
      hackathonPlatform.value = detectedPlatform;

      async function applyData(data) {
        roundsList.innerHTML = "";
        if (data.title) hackathonTitle.value = data.title;
        if (data.platform) hackathonPlatform.value = data.platform;

        if (data.rounds && data.rounds.length > 0) {
          data.rounds.forEach((r) => {
            createRoundElement(r.name, r.isoDate);
          });
        } else {
          createRoundElement("Submission Deadline", "");
        }

        // Check if already in tracked list
        const { hackathons = [] } = await chrome.storage.local.get(["hackathons"]);
        const existing = hackathons.find((h) => 
          (hackathonUrl.value && h.url && hackathonUrl.value.toLowerCase() === h.url.toLowerCase()) ||
          (data.title && h.title && data.title.toLowerCase().trim() === h.title.toLowerCase().trim())
        );

        if (existing) {
          showNotice("📌 This hackathon is ALREADY tracked! (Click below to update)", "info");
          btnSave.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Already Saved (Click to Update)`;
        } else {
          showNotice("✨ Auto-detected hackathon details from page!", "info");
          btnSave.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save & Set Reminders`;
        }
      }

      // Ask Content Script to extract page data
      chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PAGE_DATA" }, async (response) => {
        if (!chrome.runtime.lastError && response && response.success && response.data) {
          applyData(response.data);
          return;
        }

        // If content script not loaded or context invalidated, inject and retry
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["scripts/content.js"]
          });

          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PAGE_DATA" }, (retryResponse) => {
              if (!chrome.runtime.lastError && retryResponse && retryResponse.success && retryResponse.data) {
                applyData(retryResponse.data);
              } else {
                hackathonTitle.value = tab.title ? tab.title.split("|")[0].replace(/-\s*\d{4}$/, '').trim() : "Hackathon Project";
                createRoundElement("Submission Deadline", "");
              }
            });
          }, 100);
        } catch (scriptErr) {
          console.warn("Script injection failed:", scriptErr);
          hackathonTitle.value = tab.title ? tab.title.split("|")[0].replace(/-\s*\d{4}$/, '').trim() : "Hackathon Project";
          createRoundElement("Submission Deadline", "");
        }
      });
    } catch (err) {
      console.warn("Detection error:", err);
      createRoundElement("Submission Deadline", "");
    }
  }

  function showPlatformBadge(name, className) {
    platformBadge.textContent = name;
    platformBadge.className = `platform-badge ${className}`;
  }

  function showNotice(text, type = "success") {
    statusNotice.textContent = text;
    statusNotice.className = `status-notice ${type}`;
    statusNotice.classList.remove("hidden");
    setTimeout(() => {
      statusNotice.classList.add("hidden");
    }, 4000);
  }

  // 4. Extract Form Data Helper
  function getFormData() {
    const title = hackathonTitle.value.trim() || "Untitled Hackathon";
    const platform = hackathonPlatform.value.trim() || "Hackathon";
    const url = hackathonUrl.value.trim();

    const rounds = [];
    const roundCards = roundsList.querySelectorAll(".round-item-card");
    roundCards.forEach((card) => {
      const name = card.querySelector(".round-name-input").value.trim() || "Deadline";
      const dateVal = card.querySelector(".round-date-input").value.trim();
      let isoDate = "";
      if (dateVal) {
        isoDate = parseDDMMYYYYToIso(dateVal) || new Date(dateVal).toISOString();
      }
      rounds.push({ name, isoDate });
    });

    return { title, platform, url, rounds };
  }

  // 5. Save Hackathon & Schedule Alarms (With Duplicate Prevention)
  btnSave.addEventListener("click", async () => {
    const data = getFormData();
    if (!data.title) {
      alert("Please enter a hackathon title!");
      return;
    }

    const { hackathons = [] } = await chrome.storage.local.get(["hackathons"]);

    // Check if this hackathon already exists (avoid duplicates)
    const existingIndex = hackathons.findIndex((h) => {
      const matchUrl = data.url && h.url && data.url.toLowerCase() === h.url.toLowerCase();
      const matchTitle = h.title && data.title && h.title.toLowerCase().trim() === data.title.toLowerCase().trim();
      return matchUrl || matchTitle;
    });

    if (existingIndex !== -1) {
      // Update existing entry instead of creating duplicate
      const existing = hackathons[existingIndex];
      existing.title = data.title;
      existing.platform = data.platform;
      existing.url = data.url;
      existing.rounds = data.rounds;
      existing.updatedAt = new Date().toISOString();

      await chrome.storage.local.set({ hackathons });

      chrome.runtime.sendMessage({
        action: "SCHEDULE_ALARMS",
        hackathon: existing
      });

      showNotice("⚠️ Already tracked! Updated existing reminders (avoided duplicate).", "info");
      btnSave.innerHTML = `✓ Reminders Updated!`;
      setTimeout(() => {
        btnSave.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save & Set Reminders`;
      }, 2500);
      return;
    }

    // Add new unique entry
    const newEntry = {
      id: "ht_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: data.title,
      platform: data.platform,
      url: data.url,
      rounds: data.rounds,
      status: "active", // active, completed
      createdAt: new Date().toISOString()
    };

    hackathons.unshift(newEntry);
    await chrome.storage.local.set({ hackathons });

    // Inform background script to schedule desktop alarms
    chrome.runtime.sendMessage({
      action: "SCHEDULE_ALARMS",
      hackathon: newEntry
    });

    showNotice("✅ Saved! Alarms set for 24h, 3h, and 30m before deadline.", "success");
    btnSave.innerHTML = `✓ Saved & Reminders Set!`;
    setTimeout(() => {
      btnSave.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save & Set Reminders`;
    }, 2500);
    updateBadgeCount();
  });

  // 6. Google Calendar 1-Click Sync
  function generateGoogleCalendarUrl(title, platform, url, rounds) {
    // Pick the earliest upcoming round or the first round
    const targetRound = rounds[0] || { name: "Deadline", isoDate: new Date().toISOString() };
    const dateObj = new Date(targetRound.isoDate || Date.now());

    // 1-hour event block ending at deadline
    const endISO = dateObj.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const startDateObj = new Date(dateObj.getTime() - 60 * 60 * 1000);
    const startISO = startDateObj.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let description = `🏆 HackTrack Reminder for ${title}\nPlatform: ${platform}\n\n`;
    description += `📌 All Rounds & Deadlines:\n`;
    rounds.forEach((r, idx) => {
      const d = r.isoDate ? formatToDDMMYYYY(r.isoDate) : "TBD";
      description += `${idx + 1}. ${r.name}: ${d}\n`;
    });
    if (url) description += `\n🔗 Link: ${url}\n`;
    description += `\nSet with HackTrack Chrome Extension ⚡`;

    const eventTitle = `[Deadline] ${title} - ${targetRound.name}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: eventTitle,
      dates: `${startISO}/${endISO}`,
      details: description,
      location: url || platform
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  btnQuickGCal.addEventListener("click", () => {
    const data = getFormData();
    const gcalUrl = generateGoogleCalendarUrl(data.title, data.platform, data.url, data.rounds);
    chrome.tabs.create({ url: gcalUrl });
  });

  // 7. WhatsApp Messaging & Teammate Direct Alerts
  function cleanPhoneNumber(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    if (cleaned.length === 10) {
      cleaned = "91" + cleaned;
    }
    return cleaned;
  }

  function generateWhatsAppMessageText(title, platform, url, rounds) {
    let msg = `🚀 *Hackathon Alert: ${title}*\n`;
    msg += `📍 Platform: ${platform}\n`;
    if (url) msg += `🔗 Link: ${url}\n`;
    msg += `\n📌 *Important Deadlines:*\n`;

    rounds.forEach((r) => {
      const dateStr = r.isoDate ? formatToDDMMYYYY(r.isoDate) : "TBD";
      msg += `• *${r.name}*: ${dateStr} ⏰\n`;
    });

    if (rounds[0] && rounds[0].isoDate) {
      const diff = new Date(rounds[0].isoDate).getTime() - Date.now();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        msg += `\n⏳ *Time Remaining:* ${days > 0 ? `${days}d ` : ""}${hours}h left!\n`;
      }
    }

    msg += `\n_Shared via HackTrack ⚡_`;
    return msg;
  }

  let currentWaPayload = null;

  async function triggerWhatsAppSend(phone, autoSend = true) {
    if (!currentWaPayload) return;
    const msg = generateWhatsAppMessageText(currentWaPayload.title, currentWaPayload.platform, currentWaPayload.url, currentWaPayload.rounds);

    if (phone) {
      const cleaned = cleanPhoneNumber(phone);
      if (cleaned.length < 10) {
        alert("Please enter a valid 10-digit WhatsApp number!");
        return;
      }

      if (autoSend) {
        await chrome.storage.local.set({
          pendingWaAutoSend: {
            phone: cleaned,
            timestamp: Date.now()
          }
        });
      }

      const waUrl = `https://web.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`;
      chrome.tabs.create({ url: waUrl, active: false });
      showNotice(`⚡ Sending WhatsApp alert to ${cleaned} in background...`, "success");
    } else {
      const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      chrome.tabs.create({ url: waUrl });
    }

    closeWhatsAppModal();
  }

  async function openWhatsAppModal(title, platform, url, rounds) {
    currentWaPayload = { title, platform, url, rounds };
    const { teammates = [] } = await chrome.storage.local.get(["teammates"]);

    waModalTeammatesList.innerHTML = "";

    if (teammates.length > 0) {
      btnWaBroadcast.style.display = "flex";
      teammates.forEach((tm) => {
        const btn = document.createElement("button");
        btn.className = "wa-teammate-btn";
        btn.innerHTML = `
          <span class="wa-name">👤 Send to ${escapeHtml(tm.name)}</span>
          <span class="wa-num">${escapeHtml(tm.phone)} ➔</span>
        `;
        btn.addEventListener("click", () => {
          triggerWhatsAppSend(tm.phone, true);
        });
        waModalTeammatesList.appendChild(btn);
      });
    } else {
      btnWaBroadcast.style.display = "none";
      waModalTeammatesList.innerHTML = `
        <div style="font-size:11.5px; color:#94a3b8; padding:6px 0; text-align:center;">
          No saved teammates yet. Type a number below or save in Settings!
        </div>
      `;
    }

    quickWaNumber.value = "";
    waModal.classList.remove("hidden");
  }

  function closeWhatsAppModal() {
    waModal.classList.add("hidden");
    currentWaPayload = null;
  }

  btnCancelWaModal.addEventListener("click", closeWhatsAppModal);

  btnQuickWaSend.addEventListener("click", () => {
    const val = quickWaNumber.value.trim();
    if (!val) {
      alert("Please enter a WhatsApp number!");
      return;
    }
    triggerWhatsAppSend(val, true);
  });

  quickWaNumber.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      btnQuickWaSend.click();
    }
  });

  btnWaGroup.addEventListener("click", () => {
    triggerWhatsAppSend(null, false);
  });

  btnWaBroadcast.addEventListener("click", async () => {
    if (!currentWaPayload) return;
    const { teammates = [] } = await chrome.storage.local.get(["teammates"]);
    if (teammates.length === 0) return;

    teammates.forEach((tm, idx) => {
      setTimeout(() => {
        triggerWhatsAppSend(tm.phone, true);
      }, idx * 1500);
    });
    closeWhatsAppModal();
  });

  btnManageTeammatesFromModal.addEventListener("click", () => {
    closeWhatsAppModal();
    navTabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));
    document.querySelector('[data-tab="settings"]').classList.add("active");
    document.getElementById("tabSettings").classList.add("active");
    loadSettings();
    loadTeammates();
    document.getElementById("inputTeammateName").focus();
  });

  btnQuickWhatsApp.addEventListener("click", () => {
    const data = getFormData();
    openWhatsAppModal(data.title, data.platform, data.url, data.rounds);
  });

  // 8. Download .ICS Calendar File
  function downloadIcsFile(title, platform, url, rounds) {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HackTrack//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";

    rounds.forEach((r, idx) => {
      const targetDate = new Date(r.isoDate || Date.now());
      const endStamp = targetDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const startStamp = new Date(targetDate.getTime() - 3600000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const uid = `ht_${idx}_${Date.now()}@hacktrack`;

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${uid}\n`;
      icsContent += `DTSTAMP:${startStamp}\n`;
      icsContent += `DTSTART:${startStamp}\n`;
      icsContent += `DTEND:${endStamp}\n`;
      icsContent += `SUMMARY:[Deadline] ${title} - ${r.name}\n`;
      icsContent += `DESCRIPTION:Deadline for ${title} (${r.name}). URL: ${url}\n`;
      icsContent += `URL:${url}\n`;
      // Default 3 alarms (24h, 3h, 30m)
      icsContent += "BEGIN:VALARM\nTRIGGER:-P1D\nACTION:DISPLAY\nDESCRIPTION:1 Day Left Reminder\nEND:VALARM\n";
      icsContent += "BEGIN:VALARM\nTRIGGER:-PT3H\nACTION:DISPLAY\nDESCRIPTION:3 Hours Left Reminder\nEND:VALARM\n";
      icsContent += "BEGIN:VALARM\nTRIGGER:-PT30M\nACTION:DISPLAY\nDESCRIPTION:30 Mins Left Reminder\nEND:VALARM\n";
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
    a.download = `${safeTitle}_deadlines.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }

  btnQuickIcs.addEventListener("click", () => {
    const data = getFormData();
    downloadIcsFile(data.title, data.platform, data.url, data.rounds);
  });

  // 9. Render "My Tracked" Hackathons List
  async function renderHackathons() {
    const { hackathons = [] } = await chrome.storage.local.get(["hackathons"]);
    const query = searchInput.value.toLowerCase().trim();

    let filtered = hackathons.filter((item) => {
      // Filter by search query
      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        (item.platform && item.platform.toLowerCase().includes(query));
      if (!matchesSearch) return false;

      // Filter by status pill
      if (activeFilter === "upcoming") return item.status !== "completed";
      if (activeFilter === "completed") return item.status === "completed";
      return true;
    });

    hackathonsContainer.innerHTML = "";

    if (filtered.length === 0) {
      hackathonsContainer.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <h3>No hackathons found</h3>
          <p>Go to any Unstop or hackathon page and click "Save & Set Reminders"!</p>
        </div>
      `;
      return;
    }

    filtered.forEach((h) => {
      const card = document.createElement("div");
      card.className = `hackathon-card ${h.status === "completed" ? "completed" : ""}`;

      // Calculate next deadline & countdown
      let nextDeadlineInfo = "No date set";
      let countdownClass = "normal";
      let countdownText = "Upcoming";

      if (h.status === "completed") {
        countdownClass = "done";
        countdownText = "✅ Completed";
      } else if (h.rounds && h.rounds.length > 0) {
        // Find next round
        const now = Date.now();
        const validRounds = h.rounds
          .filter((r) => r.isoDate && !isNaN(new Date(r.isoDate).getTime()))
          .sort((a, b) => new Date(a.isoDate) - new Date(b.isoDate));

        const upcomingRound = validRounds.find((r) => new Date(r.isoDate).getTime() > now) || validRounds[validRounds.length - 1];

        if (upcomingRound) {
          const deadlineTime = new Date(upcomingRound.isoDate).getTime();
          const diffMs = deadlineTime - now;

          if (diffMs <= 0) {
            countdownClass = "urgent";
            countdownText = "⚠️ Deadline Passed";
          } else {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            const remHours = diffHours % 24;
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            if (diffHours < 3) {
              countdownClass = "urgent";
              countdownText = `🚨 ${diffHours}h ${diffMins}m left! URGENT`;
            } else if (diffHours < 24) {
              countdownClass = "warning";
              countdownText = `⏰ ${diffHours}h ${diffMins}m left`;
            } else {
              countdownClass = "normal";
              countdownText = `⏳ ${diffDays}d ${remHours}h left`;
            }
          }

          nextDeadlineInfo = `${upcomingRound.name} (${formatToDDMMYYYY(upcomingRound.isoDate)})`;
        }
      }

      // Build rounds HTML
      let roundsHtml = "";
      if (h.rounds && h.rounds.length > 0) {
        roundsHtml = `<div class="card-deadlines">`;
        h.rounds.forEach((r) => {
          const dStr = r.isoDate ? formatToDDMMYYYY(r.isoDate) : "TBD";
          roundsHtml += `
            <div class="deadline-row">
              <span>• ${escapeHtml(r.name)}</span>
              <span class="deadline-date">${dStr}</span>
            </div>
          `;
        });
        roundsHtml += `</div>`;
      }

      card.innerHTML = `
        <div class="card-header">
          <span class="card-title" title="${escapeHtml(h.title)}">${escapeHtml(h.title)}</span>
          <div class="card-badges">
            <span class="badge badge-platform">${escapeHtml(h.platform || "Hackathon")}</span>
          </div>
        </div>

        <div class="countdown-box ${countdownClass}">${countdownText}</div>

        ${roundsHtml}

        <div class="card-actions">
          <div class="action-buttons-left">
            <button class="action-btn-sm btn-card-gcal" title="Sync to Google Calendar">📅 Calendar</button>
            <button class="action-btn-sm btn-card-whatsapp" title="Share to WhatsApp">💬 Share</button>
            ${h.url ? `<button class="action-btn-sm btn-card-link" title="Open Page">🔗 Open</button>` : ""}
          </div>
          <div class="action-buttons-right">
            <button class="action-btn-sm btn-card-toggle" title="${h.status === "completed" ? "Mark Active" : "Mark Done"}">
              ${h.status === "completed" ? "↩️ Undo" : "✅ Done"}
            </button>
            <button class="action-btn-sm btn-card-del" title="Delete">🗑️</button>
          </div>
        </div>
      `;

      // Event handlers for card buttons
      if (h.url) {
        card.querySelector(".card-title").addEventListener("click", () => chrome.tabs.create({ url: h.url }));
        const linkBtn = card.querySelector(".btn-card-link");
        if (linkBtn) linkBtn.addEventListener("click", () => chrome.tabs.create({ url: h.url }));
      }

      card.querySelector(".btn-card-gcal").addEventListener("click", () => {
        const url = generateGoogleCalendarUrl(h.title, h.platform, h.url, h.rounds);
        chrome.tabs.create({ url });
      });

      card.querySelector(".btn-card-whatsapp").addEventListener("click", () => {
        openWhatsAppModal(h.title, h.platform, h.url, h.rounds);
      });

      card.querySelector(".btn-card-toggle").addEventListener("click", async () => {
        const newStatus = h.status === "completed" ? "active" : "completed";
        h.status = newStatus;
        await saveAllHackathons(hackathons);
        renderHackathons();
      });

      card.querySelector(".btn-card-del").addEventListener("click", async () => {
        if (confirm(`Remove "${h.title}" from HackTrack?`)) {
          chrome.runtime.sendMessage({ action: "CLEAR_ALARMS", hackathonId: h.id });
          const updated = hackathons.filter((item) => item.id !== h.id);
          await chrome.storage.local.set({ hackathons: updated });
          renderHackathons();
          updateBadgeCount();
        }
      });

      hackathonsContainer.appendChild(card);
    });
  }

  async function saveAllHackathons(list) {
    await chrome.storage.local.set({ hackathons: list });
    updateBadgeCount();
  }

  async function updateBadgeCount() {
    const { hackathons = [] } = await chrome.storage.local.get(["hackathons"]);
    const activeCount = hackathons.filter((h) => h.status !== "completed").length;
    trackedCountBadge.textContent = activeCount;
  }

  // Teammates Management
  async function loadTeammates() {
    const { teammates = [] } = await chrome.storage.local.get(["teammates"]);
    renderTeammatesList(teammates);
  }

  function renderTeammatesList(list) {
    teammatesList.innerHTML = "";
    if (list.length === 0) {
      teammatesList.innerHTML = `<div style="font-size:11.5px; color:#64748b; padding:6px 0;">No teammates added yet. Add your team above!</div>`;
      return;
    }

    list.forEach((tm, idx) => {
      const item = document.createElement("div");
      item.className = "teammate-item";
      item.innerHTML = `
        <div class="teammate-info">
          <span class="teammate-name">👤 ${escapeHtml(tm.name)}</span>
          <span class="teammate-phone">${escapeHtml(tm.phone)}</span>
        </div>
        <button class="btn-del-teammate" title="Remove Teammate">✕</button>
      `;
      item.querySelector(".btn-del-teammate").addEventListener("click", async () => {
        list.splice(idx, 1);
        await chrome.storage.local.set({ teammates: list });
        renderTeammatesList(list);
      });
      teammatesList.appendChild(item);
    });
  }

  btnAddTeammate.addEventListener("click", async () => {
    const name = inputTeammateName.value.trim();
    const phone = inputTeammatePhone.value.trim();

    if (!name || !phone) {
      alert("Please enter both teammate name and WhatsApp number!");
      return;
    }

    const { teammates = [] } = await chrome.storage.local.get(["teammates"]);
    teammates.push({ name, phone });
    await chrome.storage.local.set({ teammates });

    inputTeammateName.value = "";
    inputTeammatePhone.value = "";
    renderTeammatesList(teammates);
    showNotice(`Added ${name} to team contacts!`, "success");
  });

  [inputTeammateName, inputTeammatePhone].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        btnAddTeammate.click();
      }
    });
  });

  // 10. Settings Management
  async function loadSettings() {
    const { settings = {} } = await chrome.storage.local.get(["settings"]);
    if (settings.notify24h !== undefined) setNotify24h.checked = settings.notify24h;
    if (settings.notify3h !== undefined) setNotify3h.checked = settings.notify3h;
    if (settings.notify30m !== undefined) setNotify30m.checked = settings.notify30m;
    if (settings.notifyDue !== undefined) setNotifyDue.checked = settings.notifyDue;
  }

  [setNotify24h, setNotify3h, setNotify30m, setNotifyDue].forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const newSettings = {
        notify24h: setNotify24h.checked,
        notify3h: setNotify3h.checked,
        notify30m: setNotify30m.checked,
        notifyDue: setNotifyDue.checked
      };
      await chrome.storage.local.set({ settings: newSettings });
    });
  });

  btnExportJson.addEventListener("click", async () => {
    const { hackathons = [] } = await chrome.storage.local.get(["hackathons"]);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(hackathons, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `hacktrack_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  btnClearCompleted.addEventListener("click", async () => {
    const { hackathons = [] } = await chrome.storage.local.get(["hackathons"]);
    const activeOnly = hackathons.filter((h) => h.status !== "completed");
    await chrome.storage.local.set({ hackathons: activeOnly });
    renderHackathons();
    updateBadgeCount();
    showNotice("Cleared completed hackathons!", "info");
  });

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Initialization
  await detectCurrentPage();
  await updateBadgeCount();
});
