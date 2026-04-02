const bubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const bubbleActions = document.getElementById('bubble-actions');
const btnApprove = document.getElementById('btn-approve');
const btnDismiss = document.getElementById('btn-dismiss');

let currentSuggestionId = null;
let autoDismissTimer = null;

function showSuggestion(suggestion) {
  currentSuggestionId = suggestion.id;

  // Build display text
  const typeLabel = {
    'create-issue': 'New Issue',
    'update-backlog': 'Backlog Update',
    'notify': 'Heads Up',
    'open-project': 'Open Project'
  };

  bubbleText.innerHTML = `
    <strong>${typeLabel[suggestion.type] || 'Suggestion'}</strong><br>
    <span style="color:#FF6B9D">${suggestion.projectName}</span><br>
    ${suggestion.title}
  `;

  // Show approve/dismiss for actionable types
  if (suggestion.type === 'notify') {
    bubbleActions.classList.add('hidden');
    // Auto-dismiss notifications after 10 seconds
    clearTimeout(autoDismissTimer);
    autoDismissTimer = setTimeout(() => {
      window.tamugatchi.dismissSuggestion(suggestion.id);
      hideBubble();
    }, 10000);
  } else {
    bubbleActions.classList.remove('hidden');
    clearTimeout(autoDismissTimer);
  }

  bubble.classList.remove('hidden');
}

function hideBubble() {
  bubble.classList.add('hidden');
  currentSuggestionId = null;
  clearTimeout(autoDismissTimer);
}

btnApprove.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!currentSuggestionId) return;

  btnApprove.disabled = true;
  btnDismiss.disabled = true;

  try {
    await window.tamugatchi.approveSuggestion(currentSuggestionId);
  } catch (err) {
    bubbleText.textContent = `Failed: ${err.message}`;
    setTimeout(hideBubble, 3000);
  } finally {
    btnApprove.disabled = false;
    btnDismiss.disabled = false;
  }
});

btnDismiss.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!currentSuggestionId) return;
  window.tamugatchi.dismissSuggestion(currentSuggestionId);
});
