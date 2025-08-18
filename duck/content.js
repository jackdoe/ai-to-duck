
// Track state and replacements
let isEnabled = true;
let totalReplacements = 0;
const replacedNodes = new Map(); // Store original text for each node
const nodeIdMap = new WeakMap(); // Track nodes with unique IDs
let nodeIdCounter = 0;

// Function to get or create a unique ID for a node
function getNodeId(node) {
  if (!nodeIdMap.has(node)) {
    nodeIdMap.set(node, ++nodeIdCounter);
  }
  return nodeIdMap.get(node);
}

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
  
  const nodeId = getNodeId(node);
  
  if (isEnabled) {
    // Store original text if not already stored
    if (!replacedNodes.has(nodeId)) {
      replacedNodes.set(nodeId, {
        node: node,
        originalText: originalText
      });
      const count = countMatches(originalText);
      totalReplacements += count;
    }
    
    // Apply duck replacement
    node.textContent = replaceToDucks(originalText);
  } else {
    // Restore original text if we have it
    const stored = replacedNodes.get(nodeId);
    if (stored) {
      node.textContent = stored.originalText;
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
async function toggleReplacements() {
  isEnabled = !isEnabled;
  
  if (isEnabled) {
    // Re-enable: clear and reprocess everything
    totalReplacements = 0;
    replacedNodes.clear();
    processElement(document.body);
  } else {
    // Disable: restore all original text
    replacedNodes.forEach(({ node, originalText }) => {
      if (node.parentNode) { // Check if node is still in DOM
        node.textContent = originalText;
      }
    });
  }
  
  // Update background with new state
  await updateBackground();
  
  return { enabled: isEnabled, count: totalReplacements };
}

// Send state update to background script
async function updateBackground() {
  try {
    await chrome.runtime.sendMessage({
      type: 'updateState',
      count: isEnabled ? totalReplacements : 0,
      enabled: isEnabled
    });
  } catch (error) {
    // Extension context invalidated, ignore
  }
}

// Initialize on load
async function initialize() {
  try {
    // Check stored state
    const result = await chrome.storage.local.get(['enabled']);
    isEnabled = result.enabled !== false; // Default to true if not set
    
    if (document.body) {
      processElement(document.body);
      await updateBackground();
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Start initialization
initialize();

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
        const nodeId = getNodeId(node);
        // Remove from map to reprocess
        if (replacedNodes.has(nodeId)) {
          const stored = replacedNodes.get(nodeId);
          totalReplacements -= countMatches(stored.originalText);
          replacedNodes.delete(nodeId);
        }
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

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'toggle') {
    toggleReplacements().then(result => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  } else if (request.type === 'getState') {
    sendResponse({ enabled: isEnabled, count: totalReplacements });
  }
});