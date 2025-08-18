
// Track total replacements for this page
let totalReplacements = 0;

// Function to count matches in text
function countMatches(text) {
  let count = 0;
  // Count "Artificial Intelligence" matches
  const aiFullMatches = text.match(/\bArtificial\s+Intelligence\b/gi);
  if (aiFullMatches) count += aiFullMatches.length;
  
  // Count standalone "AI" matches (but not if already part of "Artificial Intelligence")
  const tempText = text.replace(/\bArtificial\s+Intelligence\b/gi, '');
  const aiMatches = tempText.match(/\bAI\b/g);
  if (aiMatches) count += aiMatches.length;
  
  return count;
}

// Function to replace text in a node
function replaceText(node, isInitial = false) {
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent;
    let replacementCount = countMatches(text);
    
    // Replace "Artificial Intelligence" first (case-insensitive)
    text = text.replace(/\bArtificial\s+Intelligence\b/gi, '🦆');
    
    // Then replace standalone "AI" (case-insensitive, word boundaries)
    text = text.replace(/\bAI\b/g, '🦆');
    
    // Update the node if changes were made
    if (text !== node.textContent) {
      node.textContent = text;
      totalReplacements += replacementCount;
      
      // Send update to background script
      if (!isInitial) {
        chrome.runtime.sendMessage({
          type: 'updateCount',
          count: totalReplacements
        });
      }
    }
  } else {
    // Skip script, style, and other non-content elements
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT'];
    if (!skipTags.includes(node.nodeName)) {
      for (let child of node.childNodes) {
        replaceText(child, isInitial);
      }
    }
  }
}

// Initial replacement when page loads
replaceText(document.body, true);

// Send initial count to background script
chrome.runtime.sendMessage({
  type: 'updateCount',
  count: totalReplacements
});

// Observer to handle dynamically added content
const observer = new MutationObserver((mutations) => {
  let hasChanges = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          replaceText(node);
          hasChanges = true;
        }
      });
    } else if (mutation.type === 'characterData') {
      replaceText(mutation.target);
      hasChanges = true;
    }
  });
  
  // Update badge if there were changes
  if (hasChanges && totalReplacements > 0) {
    chrome.runtime.sendMessage({
      type: 'updateCount',
      count: totalReplacements
    });
  }
});

// Start observing the document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Listen for requests from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getCount') {
    sendResponse({ count: totalReplacements });
  }
});

