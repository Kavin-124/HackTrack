/**
 * HackTrack - WhatsApp Web Auto-Sender (Silent Background Engine)
 * Automatically detects the pre-filled message, clicks Send, and auto-closes the tab
 */

(function () {
  "use strict";

  chrome.storage.local.get(["pendingWaAutoSend"], (res) => {
    if (!res || !res.pendingWaAutoSend) return;

    const { timestamp, phone } = res.pendingWaAutoSend;
    // Only valid if triggered in the last 2 minutes
    if (Date.now() - timestamp > 120000) {
      chrome.storage.local.remove(["pendingWaAutoSend"]);
      return;
    }

    console.log("[HackTrack] Silent auto-send running for:", phone);

    let sent = false;

    function trySend() {
      if (sent) return;

      const sendButton = document.querySelector(
        'button[aria-label="Send"], span[data-icon="send"], [data-testid="send"], footer button:has(span[data-icon="send"]), footer span[data-icon="send"]'
      );

      const msgBox = document.querySelector(
        'footer div[contenteditable="true"], div[data-tab="10"], footer [role="textbox"]'
      );

      if (sendButton) {
        sent = true;
        chrome.storage.local.remove(["pendingWaAutoSend"]);

        console.log("[HackTrack] Send button found. Auto-clicking...");
        setTimeout(() => {
          const btn = sendButton.closest("button") || sendButton;
          btn.click();

          // Keyboard Enter fallback
          if (msgBox) {
            const enterEvt = new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13
            });
            msgBox.dispatchEvent(enterEvt);
          }

          console.log("[HackTrack] Message sent to", phone, "- Auto-closing tab in 1.5s...");

          // Tell background script to close this tab and notify user
          setTimeout(() => {
            try {
              chrome.runtime.sendMessage({
                action: "CLOSE_WHATSAPP_TAB",
                phone: phone
              });
            } catch (e) {
              window.close();
            }
          }, 1500);
        }, 500);
      }
    }

    // 1. Observer for instant detection even in background tab
    const observer = new MutationObserver(() => {
      trySend();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 2. Interval polling fallback
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      trySend();

      if (sent || attempts >= 60) {
        clearInterval(interval);
        observer.disconnect();
        if (!sent) {
          chrome.storage.local.remove(["pendingWaAutoSend"]);
          console.log("[HackTrack] Auto-send poll timed out.");
        }
      }
    }, 500);
  });
})();
