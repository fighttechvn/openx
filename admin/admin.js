(function () {
  const STORAGE_KEY = "openx-mirror-state-v1";
  const state = loadState();
  ensureCloudState(state);
  let generatedApiKey = "";

  const el = {
    cloudUrlInput: document.getElementById("cloudUrlInput"),
    cloudAnonKeyInput: document.getElementById("cloudAnonKeyInput"),
    cloudWorkspaceInput: document.getElementById("cloudWorkspaceInput"),
    cloudAdminKeyInput: document.getElementById("cloudAdminKeyInput"),
    newApiKeyNameInput: document.getElementById("newApiKeyNameInput"),
    cloudSyncMeta: document.getElementById("cloudSyncMeta"),
    generatedApiKeyBox: document.getElementById("generatedApiKeyBox"),
    generatedApiKeyInput: document.getElementById("generatedApiKeyInput"),
    apiKeyList: document.getElementById("apiKeyList"),
    toast: document.getElementById("toast")
  };

  document.getElementById("saveCloudBtn").addEventListener("click", saveCloudSettings);
  document.getElementById("refreshApiKeysBtn").addEventListener("click", listApiKeys);
  document.getElementById("createApiKeyBtn").addEventListener("click", createApiKey);
  document.getElementById("copyGeneratedApiKeyBtn").addEventListener("click", copyGeneratedKey);

  render();

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_error) {
      return {};
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    el.cloudUrlInput.value = state.cloud.supabaseUrl || "";
    el.cloudAnonKeyInput.value = state.cloud.anonKey || "";
    el.cloudWorkspaceInput.value = state.cloud.workspaceSlug || "";
    el.cloudAdminKeyInput.value = state.cloud.adminKey || state.cloud.syncKey || "";
    el.newApiKeyNameInput.value = state.cloud.newApiKeyName || "";
    el.generatedApiKeyInput.value = generatedApiKey;
    el.generatedApiKeyBox.hidden = !generatedApiKey;
    el.cloudSyncMeta.textContent = isAdminConfigured()
      ? "Admin portal is configured."
      : "Admin settings are not configured.";
    renderApiKeys();
    persist();
  }

  function renderApiKeys() {
    el.apiKeyList.innerHTML = "";
    if (!state.cloud.apiKeys.length) {
      el.apiKeyList.className = "api-key-list empty";
      el.apiKeyList.textContent = "No API keys loaded.";
      return;
    }
    el.apiKeyList.className = "api-key-list";
    for (const apiKey of state.cloud.apiKeys) {
      const row = document.createElement("div");
      row.className = "api-key-row";
      const revoked = Boolean(apiKey.revokedAt);
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(apiKey.name)}</strong>
          <div class="api-key-meta">${escapeHtml(apiKey.prefix)}... · created ${escapeHtml(formatDate(apiKey.createdAt))}</div>
        </div>
        <div class="row-actions">
          <span class="status ${revoked ? "" : "paired"}">${revoked ? "Revoked" : "Active"}</span>
          <button data-action="revoke" class="danger" ${revoked ? "disabled" : ""}>Revoke</button>
        </div>
      `;
      row.querySelector('[data-action="revoke"]').addEventListener("click", () => revokeApiKey(apiKey.id));
      el.apiKeyList.appendChild(row);
    }
  }

  function saveCloudSettings() {
    const workspaceSlug = el.cloudWorkspaceInput.value.trim().toLowerCase();
    if (workspaceSlug && !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(workspaceSlug)) {
      return showToast("Workspace must use lowercase letters, numbers, and dashes.");
    }
    state.cloud = {
      ...state.cloud,
      supabaseUrl: el.cloudUrlInput.value.trim().replace(/\/$/, ""),
      anonKey: el.cloudAnonKeyInput.value.trim(),
      workspaceSlug,
      adminKey: el.cloudAdminKeyInput.value,
      newApiKeyName: el.newApiKeyNameInput.value.trim()
    };
    render();
    showToast("Admin settings saved.");
  }

  async function createApiKey() {
    saveCloudSettings();
    if (!isAdminConfigured()) return showToast("Complete admin settings first.");
    try {
      const payload = await callSupabaseRpc("openx_create_api_key", {
        p_workspace_slug: state.cloud.workspaceSlug,
        p_admin_key: state.cloud.adminKey,
        p_key_name: state.cloud.newApiKeyName || "OpenX API Key"
      });
      generatedApiKey = payload.apiKey;
      state.cloud.apiKeys = [payload.key, ...state.cloud.apiKeys.filter((item) => item.id !== payload.key.id)];
      render();
      showToast("API key created.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function listApiKeys() {
    saveCloudSettings();
    if (!isAdminConfigured()) return showToast("Complete admin settings first.");
    try {
      const payload = await callSupabaseRpc("openx_list_api_keys", {
        p_workspace_slug: state.cloud.workspaceSlug,
        p_admin_key: state.cloud.adminKey
      });
      state.cloud.apiKeys = Array.isArray(payload) ? payload : [];
      generatedApiKey = "";
      render();
      showToast("API keys loaded.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function revokeApiKey(keyId) {
    saveCloudSettings();
    if (!isAdminConfigured()) return showToast("Complete admin settings first.");
    if (!confirm("Revoke this API key? Devices using it will stop syncing.")) return;
    try {
      const payload = await callSupabaseRpc("openx_revoke_api_key", {
        p_workspace_slug: state.cloud.workspaceSlug,
        p_admin_key: state.cloud.adminKey,
        p_key_id: keyId
      });
      state.cloud.apiKeys = Array.isArray(payload) ? payload : [];
      render();
      showToast("API key revoked.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function callSupabaseRpc(functionName, body) {
    const url = `${state.cloud.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: state.cloud.anonKey,
        Authorization: `Bearer ${state.cloud.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || `Supabase ${functionName} failed.`);
    }
    return data;
  }

  async function copyGeneratedKey() {
    try {
      await navigator.clipboard.writeText(generatedApiKey);
      showToast("API key copied.");
    } catch (_error) {
      showToast(generatedApiKey);
    }
  }

  function ensureCloudState(targetState) {
    targetState.cloud = {
      supabaseUrl: "",
      anonKey: "",
      workspaceSlug: "",
      syncKey: "",
      adminKey: "",
      newApiKeyName: "",
      apiKeys: [],
      ...(targetState.cloud || {})
    };
    if (!Array.isArray(targetState.cloud.apiKeys)) targetState.cloud.apiKeys = [];
  }

  function isAdminConfigured() {
    return Boolean(
      state.cloud.supabaseUrl &&
      state.cloud.anonKey &&
      state.cloud.workspaceSlug &&
      state.cloud.adminKey &&
      state.cloud.adminKey.length >= 12
    );
  }

  function formatDate(value) {
    if (!value) return "never";
    return new Date(value).toLocaleString();
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    setTimeout(() => el.toast.classList.remove("show"), 2600);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
