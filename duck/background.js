
// Store counts for each tab
const tabCounts = {};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    // Reset count when page starts loading
    tabCounts[tabId] = 0;
    updateBadge(tabId, 0);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabCounts[tabId];
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'updateCount' && sender.tab) {
    const tabId = sender.tab.id;
    tabCounts[tabId] = request.count;
    updateBadge(tabId, request.count);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  const count = tabCounts[activeInfo.tabId] || 0;
  updateBadge(activeInfo.tabId, count);
});

// Function to update badge
function updateBadge(tabId, count) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    
    if (tab.active) {
      if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        chrome.action.setTitle({ 
          title: `AI to Duck Replacer - Replaced ${count} instance${count === 1 ? '' : 's'}` 
        });
      } else {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ 
          title: 'AI to Duck Replacer - No AI found on this page' 
        });
      }
    }
  });
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  const count = tabCounts[tab.id] || 0;
  // Inject a script to show an alert with the count
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (count) => {
      alert(`🦆 AI to Duck Replacer\n\nReplaced ${count} instance${count === 1 ? '' : 's'} of AI on this page!`);
    },
    args: [count]
  });
});

