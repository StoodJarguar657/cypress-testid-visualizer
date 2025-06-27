// Store references to event listeners and timeouts for cleanup
const elementData = new WeakMap();
const trackedElements = new Set();
const activeTimeouts = new Set();

// Debounce function to improve performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function highlightElement(el) {
  if (!el.dataset.testid || el.classList.contains('test-id-highlight')) {
    return;
  }

  // Check if element already has event listeners
  if (elementData.has(el)) {
    return;
  }

  el.classList.add('test-id-highlight');

  // Create event handlers
  const mouseEnterHandler = () => {
    // Remove any existing tooltip first
    const existingTooltip = document.getElementById('__testid_tooltip__');
    if (existingTooltip) existingTooltip.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'test-id-tooltip';
    tooltip.innerText = el.getAttribute('data-testid');
    tooltip.style.cursor = 'pointer';
    tooltip.title = 'Click to copy';

    const rect = el.getBoundingClientRect();
    tooltip.style.top = `${rect.top + window.scrollY - 25}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.id = '__testid_tooltip__';

    // Add click handler to tooltip
    const tooltipClickHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const testId = el.getAttribute('data-testid');
      if (!testId) return;

      try {
        await navigator.clipboard.writeText(testId);
        showCopyFeedback(el, testId);
      } catch (err) {
        console.error('Failed to copy data-testid:', err);
        fallbackCopyTextToClipboard(testId);
        showCopyFeedback(el, testId);
      }

      // Remove tooltip after copying
      tooltip.remove();
    };

    tooltip.addEventListener('click', tooltipClickHandler);

    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
      // Cancel any pending removal
    });

    tooltip.addEventListener('mouseleave', () => {
      // Remove tooltip when mouse leaves it
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.remove();
        }
      }, 100);
    });

    document.body.appendChild(tooltip);
  };

  const mouseLeaveHandler = () => {
    // Delay tooltip removal to allow moving mouse to tooltip
    setTimeout(() => {
      const tooltip = document.getElementById('__testid_tooltip__');
      if (tooltip && !tooltip.matches(':hover')) {
        tooltip.remove();
      }
    }, 100);
  };

  const clickHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const testId = el.getAttribute('data-testid');
    if (!testId) return;

    try {
      await navigator.clipboard.writeText(testId);
      showCopyFeedback(el, testId);
    } catch (err) {
      console.error('Failed to copy data-testid:', err);
      fallbackCopyTextToClipboard(testId);
      showCopyFeedback(el, testId);
    }
  };

  // Add event listeners
  el.addEventListener('mouseenter', mouseEnterHandler);
  el.addEventListener('mouseleave', mouseLeaveHandler);
  el.addEventListener('click', clickHandler);

  // Store handlers for cleanup
  elementData.set(el, {
    mouseEnterHandler,
    mouseLeaveHandler,
    clickHandler
  });

  // Track element for cleanup
  trackedElements.add(el);
}

// Clean up event listeners for removed elements
function cleanupElement(el) {
  if (!elementData.has(el)) return;

  const handlers = elementData.get(el);
  el.removeEventListener('mouseenter', handlers.mouseEnterHandler);
  el.removeEventListener('mouseleave', handlers.mouseLeaveHandler);
  el.removeEventListener('click', handlers.clickHandler);

  el.classList.remove('test-id-highlight');
  elementData.delete(el);
  trackedElements.delete(el);
}

// Show visual feedback when data-testid is copied
function showCopyFeedback(el, testId) {
  // Remove existing feedback
  const existingFeedback = document.getElementById('__testid_copy_feedback__');
  if (existingFeedback) existingFeedback.remove();

  // Clear any existing timeout for this feedback
  activeTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
    activeTimeouts.delete(timeoutId);
  });

  const feedback = document.createElement('div');
  feedback.className = 'test-id-copy-feedback';
  feedback.innerText = `Copied: ${testId}`;
  feedback.id = '__testid_copy_feedback__';

  const rect = el.getBoundingClientRect();
  feedback.style.top = `${rect.top + window.scrollY - 50}px`;
  feedback.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(feedback);

  // Use WeakRef to avoid memory leaks
  const feedbackRef = new WeakRef(feedback);
  const timeoutId = setTimeout(() => {
    const currentFeedback = feedbackRef.deref();
    if (currentFeedback && currentFeedback.parentNode) {
      currentFeedback.remove();
    }
    activeTimeouts.delete(timeoutId);
  }, 2000);

  activeTimeouts.add(timeoutId);
}

// Fallback function for browsers that don't support navigator.clipboard
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}

function scanAndHighlight() {
  const elements = document.querySelectorAll('[data-testid]');
  const currentElements = new Set(elements);

  // Add new elements
  elements.forEach(highlightElement);

  // Clean up removed elements
  for (const el of trackedElements) {
    if (!currentElements.has(el) || !document.contains(el)) {
      cleanupElement(el);
    }
  }
}

// Debounced version of scanAndHighlight
const debouncedScanAndHighlight = debounce(scanAndHighlight, 100);

// Initial run
scanAndHighlight();

// Observe DOM for changes with debouncing
const observer = new MutationObserver((mutations) => {
  // Only process if mutations actually affect elements with data-testid
  const hasRelevantChanges = mutations.some(mutation => {
    // Check added nodes
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.dataset?.testid || node.querySelector?.('[data-testid]')) {
            return true;
          }
        }
      }
    }

    // Check removed nodes
    if (mutation.removedNodes.length > 0) {
      for (const node of mutation.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.dataset?.testid || node.querySelector?.('[data-testid]')) {
            return true;
          }
        }
      }
    }

    // Check attribute changes
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-testid') {
      return true;
    }

    return false;
  });

  if (hasRelevantChanges) {
    debouncedScanAndHighlight();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-testid']
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Clean up all event listeners
  for (const el of trackedElements) {
    cleanupElement(el);
  }

  // Clear all timeouts
  activeTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
  });
  activeTimeouts.clear();

  // Disconnect observer
  observer.disconnect();

  // Remove any remaining tooltips/feedback
  const tooltip = document.getElementById('__testid_tooltip__');
  if (tooltip) tooltip.remove();

  const feedback = document.getElementById('__testid_copy_feedback__');
  if (feedback) feedback.remove();
});

