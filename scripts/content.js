/**
 * HackTrack - Content Script (Universal & Resilient)
 * Auto-detects hackathons and extracts rounds, deadlines & titles
 * Deep support for Unstop, Devfolio, Devpost, HackerEarth, and generic pages
 */

(function () {
  "use strict";

  const MONTH_MAP = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  function parseDateStringToIso(day, monStr, yearStr, hourStr, minStr, ampm) {
    const monKey = monStr.toLowerCase();
    if (MONTH_MAP[monKey] === undefined) return null;
    const d = parseInt(day, 10);
    const m = MONTH_MAP[monKey];
    let y = parseInt(yearStr, 10);
    if (y < 100) y += 2000;
    let h = hourStr ? parseInt(hourStr, 10) : 23;
    let min = minStr ? parseInt(minStr, 10) : 59;
    if (ampm) {
      const up = ampm.toUpperCase();
      if (up === "PM" && h < 12) h += 12;
      if (up === "AM" && h === 12) h = 0;
    }
    return new Date(y, m, d, h, min, 0).toISOString();
  }

  function extractAllDatesFromText(text) {
    if (!text) return [];
    const monthsPattern = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
    const regex = new RegExp(`\\b(\\d{1,2})\\s+(${monthsPattern})\\s+(20\\d{2}|\\d{2})(?!\\s+${monthsPattern})(?:[,\\s]+(\\d{1,2}):(\\d{2})\\s*(AM|PM)?)?`, "gi");
    const results = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      const iso = parseDateStringToIso(m[1], m[2], m[3], m[4], m[5], m[6]);
      if (iso) {
        results.push({
          raw: m[0],
          iso: iso
        });
      }
    }
    return results;
  }

  function findTitleNearby(el) {
    // 1. Check next siblings for card title
    let sibling = el.nextElementSibling;
    while (sibling) {
      const heading = sibling.querySelector("h2, h3, h4, h5, strong, [class*='title'], [class*='head']");
      if (heading && heading.innerText.trim().length > 2 && heading.innerText.trim().length < 80) {
        return heading.innerText.trim();
      }
      const lines = sibling.innerText.trim().split("\n");
      const firstLine = lines[0].trim();
      if (firstLine.length > 2 && firstLine.length < 60 && !/^(live|upcoming|submit|details|round|view)$/i.test(firstLine)) {
        return firstLine;
      }
      sibling = sibling.nextElementSibling;
    }

    // 2. Check parent container
    let parent = el.parentElement;
    for (let depth = 0; depth < 5 && parent && parent !== document.body; depth++) {
      const headings = parent.querySelectorAll("h2, h3, h4, h5, strong, [class*='title']");
      for (const h of headings) {
        if (!el.contains(h) && !h.contains(el)) {
          const txt = h.innerText.trim();
          if (txt.length > 2 && txt.length < 80 && !txt.toLowerCase().includes("stages and timelines")) {
            return txt;
          }
        }
      }
      parent = parent.parentElement;
    }

    return null;
  }

  /**
   * UNSTOP Extractor
   */
  function extractUnstop() {
    let title = "";
    const titleEl = document.querySelector("h1, .opportunity-details h1, .event_title, [class*='title'] h1");
    if (titleEl) {
      title = titleEl.innerText.trim();
    } else {
      title = document.title.replace(/\s*\|.*$/, '').replace(/Unstop.*$/i, '').trim();
    }

    const rounds = [];

    // Find all elements containing dates or "Date to be announced"
    const allElements = document.querySelectorAll("p, span, div, h3, h4, strong");
    const matchedElements = [];

    allElements.forEach((el) => {
      // Must not be a giant container
      if (el.children.length > 6 || el.innerText.length > 250) return;
      const text = el.innerText.trim();
      const dates = extractAllDatesFromText(text);

      if (dates.length >= 1 && dates.length <= 4) {
        // Prevent duplicate parent/child elements
        if (!matchedElements.some(item => item.el.contains(el) || el.contains(item.el))) {
          matchedElements.push({ el, text, dates });
        }
      } else if (/date to be announced/i.test(text)) {
        if (!matchedElements.some(item => item.el.contains(el) || el.contains(item.el))) {
          matchedElements.push({ el, text, dates: [] });
        }
      }
    });

    matchedElements.forEach((item, idx) => {
      const stageTitle = findTitleNearby(item.el) || `Stage ${idx + 1}`;

      if (item.dates.length >= 2) {
        // Range: Date 1 is Start, Date 2 is Deadline
        const startDate = item.dates[0];
        const endDate = item.dates[item.dates.length - 1];

        // Add Submission Deadline
        rounds.push({
          name: `${stageTitle} (Deadline)`,
          rawDate: endDate.raw,
          isoDate: endDate.iso,
          notes: `Submission closes: ${endDate.raw}`
        });

        // Add Round Start
        rounds.push({
          name: `${stageTitle} (Start)`,
          rawDate: startDate.raw,
          isoDate: startDate.iso,
          notes: `Round opened: ${startDate.raw}`
        });
      } else if (item.dates.length === 1) {
        rounds.push({
          name: `${stageTitle} (Deadline)`,
          rawDate: item.dates[0].raw,
          isoDate: item.dates[0].iso,
          notes: item.dates[0].raw
        });
      } else if (/date to be announced/i.test(item.text)) {
        rounds.push({
          name: `${stageTitle} (TBA)`,
          rawDate: "Date to be announced",
          isoDate: null,
          notes: "Pending announcement"
        });
      }
    });

    // Also check registration deadline in metadata banner
    const regDeadlineEl = document.querySelector("[class*='reg_end'], [class*='registration-deadline'], [class*='deadline']");
    if (regDeadlineEl) {
      const regText = regDeadlineEl.innerText.replace(/\n+/g, ' ').trim();
      const regDates = extractAllDatesFromText(regText);
      if (regDates.length > 0 && !rounds.some(r => r.name.toLowerCase().includes("registration"))) {
        rounds.unshift({
          name: "Registration Deadline",
          rawDate: regDates[0].raw,
          isoDate: regDates[0].iso,
          notes: "Final registration date"
        });
      }
    }

    return {
      platform: "Unstop",
      title: title || "Unstop Hackathon",
      url: window.location.href,
      rounds: rounds
    };
  }

  /**
   * DEVFOLIO Extractor
   */
  function extractDevfolio() {
    let title = "";
    const titleEl = document.querySelector("h1, [data-test='hackathon-name']");
    title = titleEl ? titleEl.innerText.trim() : document.title.replace(/\|.*Devfolio.*$/i, '').trim();

    const rounds = [];
    const dateElements = document.querySelectorAll("[data-test*='date'], [class*='Schedule'], [class*='Timeline']");
    dateElements.forEach((el, idx) => {
      const dates = extractAllDatesFromText(el.innerText);
      if (dates.length > 0) {
        const last = dates[dates.length - 1];
        rounds.push({
          name: `Milestone ${idx + 1} (Deadline)`,
          rawDate: last.raw,
          isoDate: last.iso,
          notes: "Devfolio Schedule"
        });
      }
    });

    if (rounds.length === 0) {
      const genericTexts = document.querySelectorAll("p, span, div");
      for (const el of genericTexts) {
        if (/applications?\s+close/i.test(el.innerText) && el.innerText.length < 150) {
          const dates = extractAllDatesFromText(el.innerText);
          if (dates.length > 0) {
            rounds.push({
              name: "Application Deadline",
              rawDate: dates[0].raw,
              isoDate: dates[0].iso,
              notes: "Devfolio Application Closing"
            });
            break;
          }
        }
      }
    }

    return {
      platform: "Devfolio",
      title: title || "Devfolio Hackathon",
      url: window.location.href,
      rounds: rounds
    };
  }

  /**
   * DEVPOST Extractor
   */
  function extractDevpost() {
    let title = "";
    const titleEl = document.querySelector("#challenge-title, h1.mb-0, h1");
    title = titleEl ? titleEl.innerText.trim() : document.title.replace(/\|.*Devpost.*$/i, '').trim();

    const rounds = [];
    const deadlineEl = document.querySelector("#submission-period, time, .deadline");
    if (deadlineEl) {
      const dateText = deadlineEl.getAttribute("datetime") || deadlineEl.innerText.trim();
      const dates = extractAllDatesFromText(dateText);
      if (dates.length > 0) {
        const last = dates[dates.length - 1];
        rounds.push({
          name: "Submission Deadline",
          rawDate: last.raw,
          isoDate: last.iso,
          notes: "Devpost Submission Period"
        });
      }
    }

    return {
      platform: "Devpost",
      title: title || "Devpost Hackathon",
      url: window.location.href,
      rounds: rounds
    };
  }

  /**
   * HACKEREARTH Extractor
   */
  function extractHackerEarth() {
    let title = "";
    const titleEl = document.querySelector(".challenge-title, h1");
    title = titleEl ? titleEl.innerText.trim() : document.title.replace(/\|.*HackerEarth.*$/i, '').trim();

    const rounds = [];
    const timingEls = document.querySelectorAll(".event-timings, .timer-text, .challenge-desc-timer");
    timingEls.forEach((el, idx) => {
      const dates = extractAllDatesFromText(el.innerText);
      if (dates.length > 0) {
        const last = dates[dates.length - 1];
        rounds.push({
          name: idx === 0 ? "Hackathon Deadline" : `Round ${idx + 1} Deadline`,
          rawDate: last.raw,
          isoDate: last.iso,
          notes: "HackerEarth Timeline"
        });
      }
    });

    return {
      platform: "HackerEarth",
      title: title || "HackerEarth Hackathon",
      url: window.location.href,
      rounds: rounds
    };
  }

  /**
   * GENERIC Extractor
   */
  function extractGeneric() {
    let title = "";
    const h1 = document.querySelector("h1");
    if (h1 && h1.innerText.trim().length > 3 && h1.innerText.trim().length < 100) {
      title = h1.innerText.trim();
    } else {
      title = document.title
        .replace(/[-|–].*$/, '')
        .replace(/\b(home|official website|welcome)\b/gi, '')
        .trim();
    }

    const host = window.location.hostname.replace(/^www\./, '');
    let platform = host.charAt(0).toUpperCase() + host.slice(1);

    const rounds = [];
    const keywords = ["deadline", "registration end", "submission", "last date", "quiz", "ppt", "finale", "round"];
    const elements = document.querySelectorAll("p, span, li, div, h2, h3, h4, td");

    for (const el of elements) {
      if (el.children.length > 2 || el.innerText.length > 200) continue;
      const txt = el.innerText.trim();
      if (!txt) continue;

      const hasKeyword = keywords.some(kw => txt.toLowerCase().includes(kw));
      if (hasKeyword) {
        const dates = extractAllDatesFromText(txt);
        if (dates.length > 0) {
          const last = dates[dates.length - 1];
          let matchedKw = keywords.find(kw => txt.toLowerCase().includes(kw)) || "Deadline";
          let roundName = matchedKw.charAt(0).toUpperCase() + matchedKw.slice(1);
          if (/submission/i.test(txt)) roundName = "Idea / PPT Submission";
          else if (/quiz/i.test(txt)) roundName = "Online Quiz Round";
          else if (/registration/i.test(txt)) roundName = "Registration Deadline";
          else if (/finale|grand/i.test(txt)) roundName = "Grand Finale";

          if (!rounds.some(r => r.isoDate === last.iso)) {
            rounds.push({
              name: roundName,
              rawDate: last.raw,
              isoDate: last.iso,
              notes: "Scanned from page"
            });
          }
        }
      }

      if (rounds.length >= 5) break;
    }

    return {
      platform: platform,
      title: title || "Hackathon Event",
      url: window.location.href,
      rounds: rounds
    };
  }

  function extractPageData() {
    const host = window.location.hostname.toLowerCase();
    let result;

    if (host.includes("unstop.com")) {
      result = extractUnstop();
    } else if (host.includes("devfolio.co")) {
      result = extractDevfolio();
    } else if (host.includes("devpost.com")) {
      result = extractDevpost();
    } else if (host.includes("hackerearth.com")) {
      result = extractHackerEarth();
    } else {
      result = extractGeneric();
    }

    // Default round ONLY if absolutely nothing could be extracted
    if (!result.rounds || result.rounds.length === 0) {
      const defaultDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      defaultDate.setHours(23, 59, 0, 0);
      result.rounds = [{
        name: "Submission Deadline",
        rawDate: "Manual entry",
        isoDate: defaultDate.toISOString(),
        notes: "Set manually"
      }];
    }

    return result;
  }

  // Listen for requests from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_PAGE_DATA") {
      try {
        const data = extractPageData();
        sendResponse({ success: true, data: data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });

})();
