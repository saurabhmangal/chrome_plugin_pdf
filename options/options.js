const providerRadios = document.querySelectorAll('input[name="provider"]');
const keyGroups = {
  gemini: document.getElementById("key-gemini"),
  anthropic: document.getElementById("key-anthropic"),
  openai: document.getElementById("key-openai")
};
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");

// Show only the key input for the selected provider
function updateKeyVisibility(provider) {
  Object.entries(keyGroups).forEach(([p, el]) => {
    el.classList.toggle("hidden", p !== provider);
  });
}

providerRadios.forEach(radio => {
  radio.addEventListener("change", () => updateKeyVisibility(radio.value));
});

// Toggle password visibility
document.querySelectorAll(".btn-show").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "Hide" : "Show";
  });
});

// Load saved settings
chrome.storage.sync.get(["aiProvider", "geminiKey", "anthropicKey", "openaiKey"], data => {
  const provider = data.aiProvider || "gemini";

  providerRadios.forEach(r => { r.checked = r.value === provider; });
  updateKeyVisibility(provider);

  if (data.geminiKey) document.getElementById("geminiKey").value = data.geminiKey;
  if (data.anthropicKey) document.getElementById("anthropicKey").value = data.anthropicKey;
  if (data.openaiKey) document.getElementById("openaiKey").value = data.openaiKey;
});

// Save settings
saveBtn.addEventListener("click", async () => {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  const geminiKey = document.getElementById("geminiKey").value.trim();
  const anthropicKey = document.getElementById("anthropicKey").value.trim();
  const openaiKey = document.getElementById("openaiKey").value.trim();

  const activeKey = { gemini: geminiKey, anthropic: anthropicKey, openai: openaiKey }[provider];

  if (!activeKey) {
    showStatus("Please enter an API key for the selected provider.", "error");
    return;
  }

  saveBtn.disabled = true;
  showStatus("Validating key...", "");

  const response = await chrome.runtime.sendMessage({
    action: "VALIDATE_API_KEY",
    provider,
    apiKey: activeKey
  });

  saveBtn.disabled = false;

  if (!response.success) {
    showStatus("Invalid key: " + response.error, "error");
    return;
  }

  await chrome.storage.sync.set({ aiProvider: provider, geminiKey, anthropicKey, openaiKey });
  showStatus("✓ Saved — using " + response.model, "success");
});

function showStatus(msg, type) {
  saveStatus.textContent = msg;
  saveStatus.className = "save-status " + type;
  if (type === "success") {
    setTimeout(() => { saveStatus.textContent = ""; }, 4000);
  }
}
