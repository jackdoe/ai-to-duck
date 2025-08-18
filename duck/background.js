// Store state for each tab
const tabStates = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

// Reset state when tab navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    tabStates.delete(tabId);
    updateBadgeForTab(tabId);
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// Update badge when switching tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

// Listen for state updates from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'updateState' && sender.tab) {
    const tabId = sender.tab.id;
    tabStates.set(tabId, {
      count: request.count,
      enabled: request.enabled
    });
    
    // Update badge if this is the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id === tabId) {
        updateBadge(request.count, request.enabled);
      }
    });
  }
});

// Update badge for a specific tab
async function updateBadgeForTab(tabId) {
  const state = tabStates.get(tabId);
  if (state) {
    updateBadge(state.count, state.enabled);
  } else {
    // Try to get state from content script
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'getState' });
      if (response) {
        updateBadge(response.count, response.enabled);
      }
    } catch (e) {
      // No content script loaded yet
      updateBadge(0, true);
    }
  }
}

// Update badge text, color and title
function updateBadge(count, enabled) {
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#757575' });
    chrome.action.setTitle({ 
      title: 'AI to Duck Replacer - DISABLED\nClick to enable' 
    });
  } else if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setTitle({ 
      title: `AI to Duck Replacer - ENABLED\n${count} replacement${count === 1 ? '' : 's'}\nClick to disable` 
    });
  } else {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#2196F3' });
    chrome.action.setTitle({ 
      title: 'AI to Duck Replacer - ENABLED\nNo AI found on this page\nClick to disable' 
    });
  }
}

// Handle extension icon click - toggle the extension
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Send toggle command to content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
    
    if (response) {
      // Store the new state
      tabStates.set(tab.id, {
        count: response.count,
        enabled: response.enabled
      });
      
      // Update badge
      updateBadge(response.count, response.enabled);
      
      // Save enabled state globally
      await chrome.storage.local.set({ enabled: response.enabled });
      
      // Show notification
      const message = response.enabled 
        ? `Enabled! Found ${response.count} AI reference${response.count === 1 ? '' : 's'}.`
        : 'Disabled! Original text restored.';
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-48.png'),
        title: '🦆 AI to Duck Replacer',
        message: message,
        priority: 0
      });
    }
  } catch (error) {
    // Content script not loaded yet, reload the tab
    chrome.tabs.reload(tab.id);
  }
});
