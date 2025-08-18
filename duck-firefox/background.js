
// Store state for each tab
const tabStates = new Map();

// Initialize badge colors
browser.browserAction.setBadgeBackgroundColor({ color: '#4CAF50' });

// Reset state when tab navigates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    tabStates.delete(tabId);
    if (tab.active) {
      updateBadgeForTab(tabId);
    }
  }
});

// Clean up when tab closes
browser.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// Update badge when switching tabs
browser.tabs.onActivated.addListener(async (activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

// Listen for state updates from content scripts
browser.runtime.onMessage.addListener((request, sender) => {
  if (request.type === 'updateState' && sender.tab) {
    const tabId = sender.tab.id;
    tabStates.set(tabId, {
      count: request.count,
      enabled: request.enabled
    });
    
    // Update badge if this is the active tab
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
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
      const response = await browser.tabs.sendMessage(tabId, { type: 'getState' });
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
    browser.browserAction.setBadgeText({ text: 'OFF' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#757575' });
    browser.browserAction.setTitle({ 
      title: 'AI to Duck Replacer - DISABLED\nClick to enable' 
    });
  } else if (count > 0) {
    browser.browserAction.setBadgeText({ text: count.toString() });
    browser.browserAction.setBadgeBackgroundColor({ color: '#4CAF50' });
    browser.browserAction.setTitle({ 
      title: `AI to Duck Replacer - ENABLED\n${count} replacement${count === 1 ? '' : 's'}\nClick to disable` 
    });
  } else {
    browser.browserAction.setBadgeText({ text: 'ON' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#2196F3' });
    browser.browserAction.setTitle({ 
      title: 'AI to Duck Replacer - ENABLED\nNo AI found on this page\nClick to disable' 
    });
  }
}

// Handle toolbar button click - toggle the extension
browser.browserAction.onClicked.addListener(async (tab) => {
  try {
    // Send toggle command to content script
    const response = await browser.tabs.sendMessage(tab.id, { type: 'toggle' });
    
    // Store the new state
    if (response && response.success) {
      tabStates.set(tab.id, {
        count: response.count,
        enabled: response.enabled
      });
      
      // Update badge
      updateBadge(response.count, response.enabled);
      
      // Save enabled state globally
      await browser.storage.local.set({ enabled: response.enabled });
      
      // Show notification
      const message = response.enabled 
        ? `Enabled! Found ${response.count} AI reference${response.count === 1 ? '' : 's'}.`
        : 'Disabled! Original text restored.';
      
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icon-48.png'),
        title: '🦆 AI to Duck Replacer',
        message: message
      });
    }
  } catch (error) {
    // Only reload if we get a specific connection error indicating no content script
    if (error && error.message && error.message.includes('Could not establish connection')) {
      // Content script not loaded, inject it
      browser.tabs.executeScript(tab.id, {
        file: 'content.js'
      }).then(() => {
        // Try toggle again after injection
        browser.tabs.sendMessage(tab.id, { type: 'toggle' });
      }).catch(() => {
        // If injection fails, reload as last resort
        browser.tabs.reload(tab.id);
      });
    }
    // For other errors, just ignore - the toggle probably worked
  }
});