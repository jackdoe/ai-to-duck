
// Track state and replacements
let isEnabled = true;
let totalReplacements = 0;
const replacedNodes = new Map(); // Store original text for each node

// Function to count matches in text
function countMatches(text) {
  let count = 0;
  
  // Count "Artificial Intelligence" matches first
  const aiFullMatches = text.match(/\bArtificial\s+Intelligence\b/gi);
  if (aiFullMatches) count += aiFullMatches.length;
  
  // Remove "Artificial Intelligence" to avoid double counting, then count "AI"
  const tempText = text.replace(/\bArtificial\s+Intelligence\b/gi, '');
  const aiMatches = tempText.match(/\bAI\b/g);
  if (aiMatches) count += aiMatches.length;
  
  return count;
}

// Function to check if text contains AI-related words
function hasAIContent(text) {
  return /\bArtificial\s+Intelligence\b/gi.test(text) || /\bAI\b/g.test(text);
}

// Function to replace text with ducks
function replaceToDucks(text) {
  // Replace "Artificial Intelligence" first (case-insensitive)
  text = text.replace(/\bArtificial\s+Intelligence\b/gi, '🦆');
  // Then replace standalone "AI" (case-insensitive, word boundaries)
  text = text.replace(/\bAI\b/g, '🦆');
  return text;
}

// Function to process a text node
function processTextNode(node) {
  if (!node || !node.textContent) return;
  
  const originalText = node.textContent;
  
  // Only process if there's AI content
  if (!hasAIContent(originalText)) return;
  
  if (isEnabled) {
    // Store original text if not already stored
    if (!replacedNodes.has(node)) {
      replacedNodes.set(node, originalText);
      const count = countMatches(originalText);
      totalReplacements += count;
    }
    
    // Apply duck replacement
    node.textContent = replaceToDucks(originalText);
  } else {
    // Restore original text if we have it
    if (replacedNodes.has(node)) {
      node.textContent = replacedNodes.get(node);
    }
  }
}

// Function to process all text in an element
function processElement(element) {
  if (element.nodeType === Node.TEXT_NODE) {
    processTextNode(element);
  } else {
    // Skip script, style, and other non-content elements
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'];
    if (!skipTags.includes(element.nodeName)) {
      // Process all text nodes in this element
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      
      textNodes.forEach(processTextNode);
    }
  }
}

// Function to toggle all replacements
function toggleReplacements() {
  isEnabled = !isEnabled;
  
  if (isEnabled) {
    // Re-enable: process all text nodes again
    totalReplacements = 0;
    processElement(document.body);
  } else {
    // Disable: restore all original text
    replacedNodes.forEach((originalText, node) => {
      if (node.parentNode) { // Check if node is still in DOM
        node.textContent = originalText;
      }
    });
  }
  
  // Update background with new state
  updateBackground();
}

// Send state update to background script
function updateBackground() {
  browser.runtime.sendMessage({
    type: 'updateState',
    count: isEnabled ? totalReplacements : 0,
    enabled: isEnabled
  }).catch(() => {
    // Ignore errors if background script is not ready
  });
}

// Initial load - check stored state
browser.storage.local.get(['enabled']).then(result => {
  isEnabled = result.enabled !== false; // Default to true if not set
  
  if (document.body) {
    processElement(document.body);
    updateBackground();
  }
});

// Observer to handle dynamically added content
const observer = new MutationObserver((mutations) => {
  if (!isEnabled) return; // Don't process if disabled
  
  let hasNewContent = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          const countBefore = totalReplacements;
          processElement(node);
          if (totalReplacements > countBefore) {
            hasNewContent = true;
          }
        }
      });
    } else if (mutation.type === 'characterData') {
      // Handle direct text changes
      const node = mutation.target;
      if (node.nodeType === Node.TEXT_NODE && hasAIContent(node.textContent)) {
        // Remove from map to reprocess
        replacedNodes.delete(node);
        processTextNode(node);
        hasNewContent = true;
      }
    }
  });
  
  // Update badge if there was new content
  if (hasNewContent) {
    updateBackground();
  }
});

// Start observing the document for changes
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// Listen for toggle command from background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'toggle') {
    toggleReplacements();
    sendResponse({ success: true, enabled: isEnabled, count: totalReplacements });
    return true; // Keep the message channel open for async response
  } else if (request.type === 'getState') {
    sendResponse({ enabled: isEnabled, count: totalReplacements });
    return true;
  }
});

// Clean up when page unloads
window.addEventListener('unload', () => {
  replacedNodes.clear();
});