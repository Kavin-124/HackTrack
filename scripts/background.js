/**
 * HackTrack - Background Service Worker
 * Manages chrome.alarms, system desktop notifications, and context menu shortcuts
 */

// Initialize default storage & context menus on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["hackathons", "settings"], (result) => {
    if (!result.hackathons) {
      chrome.storage.local.set({ hackathons: [] });
    }
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          sound: true,
          notify24h: true,
          notify3h: true,
          notify30m: true,
          notifyDue: true
        }
      });
    }
  });

  // Create context menu for quick date tracking
  try {
    chrome.contextMenus.create({
      id: "hacktrack_add_selection",
      title: "Track deadline in HackTrack: \"%s\"",
      contexts: ["selection"]
    });
  } catch (e) {
    console.error("Context menu creation error:", e);
  }
});

// Handle Context Menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "hacktrack_add_selection" && info.selectionText) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "HackTrack Quick Capture",
      message: `Selected text captured: "${info.selectionText}". Open HackTrack extension to save as a deadline!`,
      priority: 1
    });

    // Save temporary quick clip
    chrome.storage.local.set({
      quickClip: {
        text: info.selectionText,
        pageTitle: tab ? tab.title : "",
        url: tab ? tab.url : "",
        time: Date.now()
      }
    });
  }
});

// Helper to schedule alarms for a hackathon round
async function scheduleHackathonAlarms(hackathon) {
  const { settings } = await chrome.storage.local.get(["settings"]);
  const s = settings || { notify24h: true, notify3h: true, notify30m: true, notifyDue: true };

  if (!hackathon.rounds || hackathon.rounds.length === 0) return;

  const now = Date.now();

  hackathon.rounds.forEach((round, roundIndex) => {
    if (!round.isoDate) return;
    const deadlineTime = new Date(round.isoDate).getTime();
    if (isNaN(deadlineTime) || deadlineTime <= now) return;

    // 24 hours before
    if (s.notify24h) {
      const time24h = deadlineTime - 24 * 60 * 60 * 1000;
      if (time24h > now) {
        chrome.alarms.create(`ht_${hackathon.id}_r${roundIndex}_24h`, { when: time24h });
      }
    }

    // 3 hours before
    if (s.notify3h) {
      const time3h = deadlineTime - 3 * 60 * 60 * 1000;
      if (time3h > now) {
        chrome.alarms.create(`ht_${hackathon.id}_r${roundIndex}_3h`, { when: time3h });
      }
    }

    // 30 minutes before
    if (s.notify30m) {
      const time30m = deadlineTime - 30 * 60 * 1000;
      if (time30m > now) {
        chrome.alarms.create(`ht_${hackathon.id}_r${roundIndex}_30m`, { when: time30m });
      }
    }

    // At deadline
    if (s.notifyDue) {
      chrome.alarms.create(`ht_${hackathon.id}_r${roundIndex}_due`, { when: deadlineTime });
    }
  });
}

// Clear all alarms for a specific hackathon
async function clearHackathonAlarms(hackathonId) {
  const alarms = await chrome.alarms.getAll();
  for (const alarm of alarms) {
    if (alarm.name.startsWith(`ht_${hackathonId}_`)) {
      await chrome.alarms.clear(alarm.name);
    }
  }
}

// Listen to Alarms and fire Desktop Notifications
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("ht_")) return;

  // Format: ht_{hackathonId}_r{roundIndex}_{stage}
  const parts = alarm.name.split("_");
  if (parts.length < 4) return;

  const hackathonId = parts[1];
  const roundIndex = parseInt(parts[2].replace("r", ""), 10);
  const stage = parts[3];

  const { hackathons } = await chrome.storage.local.get(["hackathons"]);
  if (!hackathons) return;

  const item = hackathons.find(h => h.id === hackathonId);
  if (!item) return;

  const round = item.rounds && item.rounds[roundIndex] ? item.rounds[roundIndex] : null;
  const roundName = round ? round.name : "Upcoming Deadline";

  let stageText = "approaching";
  if (stage === "24h") stageText = "in 24 Hours";
  else if (stage === "3h") stageText = "in 3 Hours (Final Call!)";
  else if (stage === "30m") stageText = "in 30 Minutes! Submit Now!";
  else if (stage === "due") stageText = "is DUE RIGHT NOW!";

  chrome.notifications.create(`notify_${item.id}_${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `🚨 HackTrack: ${item.title}`,
    message: `📌 ${roundName} deadline is ${stageText}!\nClick to open ${item.platform || "Hackathon"} page.`,
    priority: 2,
    requireInteraction: true
  });
});

// Open link when notification is clicked
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith("notify_")) {
    const parts = notificationId.split("_");
    const hackathonId = parts[1];
    const { hackathons } = await chrome.storage.local.get(["hackathons"]);
    if (hackathons) {
      const item = hackathons.find(h => h.id === hackathonId);
      if (item && item.url) {
        chrome.tabs.create({ url: item.url });
      }
    }
  }
});

// Messages from popup to reschedule alarms and background tab manager
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCHEDULE_ALARMS" && request.hackathon) {
    scheduleHackathonAlarms(request.hackathon);
    sendResponse({ success: true });
  } else if (request.action === "CLEAR_ALARMS" && request.hackathonId) {
    clearHackathonAlarms(request.hackathonId);
    sendResponse({ success: true });
  } else if (request.action === "CLOSE_WHATSAPP_TAB") {
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    const phoneDisplay = request.phone ? `to +${request.phone}` : "to your teammate";
    chrome.notifications.create(`wa_sent_${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "✅ HackTrack: WhatsApp Alert Sent!",
      message: `Hackathon deadline message was sent ${phoneDisplay} in the background!`,
      priority: 1
    });
    sendResponse({ success: true });
  }
  return true;
});
