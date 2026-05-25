(function () {
  const STORAGE_KEY = "openx-mirror-state-v1";
  const state = loadState();
  ensureFileTypeState(state);
  let activeMachineId = state.activeMachineId || null;
  let editingMachineId = null;
  let editingFolderId = null;
  let currentResults = [];
  let lanDevices = [];
  let editingFileTypes = [];

  const el = {
    machineList: document.getElementById("machineList"),
    activeMachineName: document.getElementById("activeMachineName"),
    activeMachineMeta: document.getElementById("activeMachineMeta"),
    folderList: document.getElementById("folderList"),
    resultList: document.getElementById("resultList"),
    fileTypeTags: document.getElementById("fileTypeTags"),
    lanDeviceList: document.getElementById("lanDeviceList"),
    searchInput: document.getElementById("searchInput"),
    lanSearchInput: document.getElementById("lanSearchInput"),
    toast: document.getElementById("toast"),
    machineDialog: document.getElementById("machineDialog"),
    machineForm: document.getElementById("machineForm"),
    machineNameInput: document.getElementById("machineNameInput"),
    machineHostInput: document.getElementById("machineHostInput"),
    machinePortInput: document.getElementById("machinePortInput"),
    pairDialog: document.getElementById("pairDialog"),
    pairForm: document.getElementById("pairForm"),
    pairCodeInput: document.getElementById("pairCodeInput"),
    clientNameInput: document.getElementById("clientNameInput"),
    folderDialog: document.getElementById("folderDialog"),
    folderForm: document.getElementById("folderForm"),
    folderNameInput: document.getElementById("folderNameInput"),
    folderPathInput: document.getElementById("folderPathInput"),
    folderRecursiveInput: document.getElementById("folderRecursiveInput"),
    fileTypesDialog: document.getElementById("fileTypesDialog"),
    fileTypesForm: document.getElementById("fileTypesForm"),
    fileTypeEditorList: document.getElementById("fileTypeEditorList"),
    newFileTypeInput: document.getElementById("newFileTypeInput")
  };

  document.getElementById("addMachineBtn").addEventListener("click", openNewMachineDialog);
  document.getElementById("editMachineBtn").addEventListener("click", openEditMachineDialog);
  document.getElementById("pairBtn").addEventListener("click", openPairDialog);
  document.getElementById("scanLanBtn").addEventListener("click", scanLan);
  document.getElementById("healthBtn").addEventListener("click", checkHealth);
  document.getElementById("deleteMachineBtn").addEventListener("click", deleteActiveMachine);
  document.getElementById("addFolderBtn").addEventListener("click", openNewFolderDialog);
  document.getElementById("manageFileTypesBtn").addEventListener("click", openFileTypesDialog);
  document.getElementById("addFileTypeBtn").addEventListener("click", addEditingFileType);
  el.searchInput.addEventListener("input", renderResults);
  el.lanSearchInput.addEventListener("input", renderLanDevices);

  el.machineForm.addEventListener("submit", saveMachine);
  el.pairForm.addEventListener("submit", pairMachine);
  el.folderForm.addEventListener("submit", saveFolder);
  el.fileTypesForm.addEventListener("submit", saveFileTypes);

  render();

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { machines: [] };
    } catch (_error) {
      return { machines: [] };
    }
  }

  function persist() {
    state.activeMachineId = activeMachineId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function activeMachine() {
    return state.machines.find((machine) => machine.id === activeMachineId) || null;
  }

  function render() {
    renderMachines();
    renderActiveMachine();
    renderLanDevices();
    renderFolders();
    renderFileTypeTags();
    renderResults();
    persist();
  }

  function renderMachines() {
    el.machineList.innerHTML = "";
    if (!state.machines.length) {
      el.machineList.textContent = "No machines configured.";
      el.machineList.className = "machine-list empty";
      return;
    }
    el.machineList.className = "machine-list";
    for (const machine of state.machines) {
      const button = document.createElement("button");
      button.className = `machine-item${machine.id === activeMachineId ? " active" : ""}`;
      button.innerHTML = `
        <strong>${escapeHtml(machine.name)}</strong>
        <span>${escapeHtml(machine.host)}:${machine.port}</span>
        <span class="status ${machine.token ? "paired" : ""}">${machine.token ? "Paired" : "Not paired"}</span>
      `;
      button.addEventListener("click", () => {
        activeMachineId = machine.id;
        currentResults = [];
        render();
      });
      el.machineList.appendChild(button);
    }
  }

  function renderActiveMachine() {
    const machine = activeMachine();
    if (!machine) {
      el.activeMachineName.textContent = "No machine selected";
      el.activeMachineMeta.textContent = "Add or select a machine to begin.";
      return;
    }
    el.activeMachineName.textContent = machine.name;
    el.activeMachineMeta.textContent = `${machine.host}:${machine.port} - ${machine.token ? "paired" : "not paired"}`;
  }

  function renderFolders() {
    const machine = activeMachine();
    el.folderList.innerHTML = "";
    if (!machine) {
      el.folderList.className = "folder-list empty";
      el.folderList.textContent = "Select a machine first.";
      return;
    }
    if (!machine.folders || !machine.folders.length) {
      el.folderList.className = "folder-list empty";
      el.folderList.textContent = "No folders yet.";
      return;
    }
    el.folderList.className = "folder-list";
    for (const folder of machine.folders) {
      const row = document.createElement("div");
      row.className = "folder-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(folder.name)}</strong>
          <div class="folder-path">${escapeHtml(folder.path)}</div>
        </div>
        <div class="row-actions">
          <button data-action="scan">Scan</button>
          <button data-action="edit">Edit</button>
          <button data-action="delete" class="danger">Delete</button>
        </div>
      `;
      row.querySelector('[data-action="scan"]').addEventListener("click", () => scanFolder(folder.id));
      row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditFolderDialog(folder.id));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteFolder(folder.id));
      el.folderList.appendChild(row);
    }
  }

  function renderResults() {
    const query = el.searchInput.value.trim().toLowerCase();
    const enabledTypes = new Set(state.fileTypes.filter((item) => item.enabled).map((item) => item.extension));
    const results = currentResults.filter((item) => {
      const extension = extensionOf(item.relativePath);
      return enabledTypes.has(extension) && item.relativePath.toLowerCase().includes(query);
    });
    el.resultList.innerHTML = "";
    if (!results.length) {
      el.resultList.className = "result-list empty";
      el.resultList.textContent = currentResults.length ? "No files match the active filters." : "No files scanned.";
      return;
    }
    el.resultList.className = "result-list";
    for (const file of results) {
      const row = document.createElement("div");
      row.className = "result-row";
      const link = apiUrl(activeMachine(), `/file/${encodeURIComponent(file.folderId)}/${file.relativePath.split("/").map(encodeURIComponent).join("/")}`);
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Open ${file.relativePath}`);
      row.innerHTML = `
        <div>
          <a href="${link}" target="_blank" rel="noopener">${escapeHtml(file.name)}</a>
          <div class="result-path">${escapeHtml(file.relativePath)}</div>
        </div>
        <div class="row-actions">
          <span class="status">${escapeHtml(extensionOf(file.relativePath))}</span>
          <span class="status">${escapeHtml(file.folderName)}</span>
        </div>
      `;
      row.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        window.open(link, "_blank", "noopener");
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.open(link, "_blank", "noopener");
        }
      });
      el.resultList.appendChild(row);
    }
  }

  function renderFileTypeTags() {
    el.fileTypeTags.innerHTML = "";
    for (const type of state.fileTypes) {
      const button = document.createElement("button");
      button.className = `tag${type.enabled ? " active" : ""}`;
      button.type = "button";
      button.textContent = type.extension;
      button.addEventListener("click", () => {
        type.enabled = !type.enabled;
        if (!state.fileTypes.some((item) => item.enabled)) type.enabled = true;
        renderFileTypeTags();
        renderResults();
        persist();
      });
      el.fileTypeTags.appendChild(button);
    }
  }

  function openNewMachineDialog() {
    editingMachineId = null;
    el.machineNameInput.value = "";
    el.machineHostInput.value = "";
    el.machinePortInput.value = "8787";
    el.machineDialog.showModal();
  }

  function openEditMachineDialog() {
    const machine = activeMachine();
    if (!machine) return showToast("Select a machine first.");
    editingMachineId = machine.id;
    el.machineNameInput.value = machine.name;
    el.machineHostInput.value = machine.host;
    el.machinePortInput.value = machine.port;
    el.machineDialog.showModal();
  }

  function saveMachine(event) {
    event.preventDefault();
    const payload = {
      name: el.machineNameInput.value.trim(),
      host: el.machineHostInput.value.trim(),
      port: Number(el.machinePortInput.value),
      folders: []
    };
    if (!payload.name || !payload.host || !payload.port) {
      showToast("Machine name, host, and port are required.");
      return;
    }
    if (editingMachineId) {
      const machine = state.machines.find((item) => item.id === editingMachineId);
      Object.assign(machine, payload, { folders: machine.folders || [] });
    } else {
      payload.id = crypto.randomUUID();
      state.machines.push(payload);
      activeMachineId = payload.id;
    }
    el.machineDialog.close();
    render();
  }

  function openPairDialog() {
    if (!activeMachine()) return showToast("Select a machine first.");
    el.pairCodeInput.value = "";
    el.clientNameInput.value = localStorage.getItem("openx-mirror-client-name") || "OpenX Dashboard";
    el.pairDialog.showModal();
  }

  async function pairMachine(event) {
    event.preventDefault();
    const machine = activeMachine();
    if (!machine) return;
    try {
      const response = await fetch(apiUrl(machine, "/pair"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: el.pairCodeInput.value.trim(),
          clientName: el.clientNameInput.value.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pairing failed.");
      machine.token = data.accessToken;
      machine.agentMachineId = data.machineId;
      localStorage.setItem("openx-mirror-client-name", el.clientNameInput.value.trim());
      el.pairDialog.close();
      showToast("Machine paired.");
      await syncFolders();
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function checkHealth() {
    const machine = activeMachine();
    if (!machine) return showToast("Select a machine first.");
    try {
      const response = await fetch(apiUrl(machine, "/health"));
      const data = await response.json();
      showToast(`Agent online: ${data.machineName || data.machineId}`);
    } catch (_error) {
      showToast("Agent is offline or unreachable.");
    }
  }

  async function syncFolders() {
    const machine = activeMachine();
    if (!machine || !machine.token) return;
    const response = await fetch(apiUrl(machine, "/folders"), { headers: authHeaders(machine) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load folders.");
    machine.folders = data.folders;
  }

  function deleteActiveMachine() {
    const machine = activeMachine();
    if (!machine) return showToast("Select a machine first.");
    if (!confirm(`Delete ${machine.name}?`)) return;
    state.machines = state.machines.filter((item) => item.id !== machine.id);
    activeMachineId = state.machines[0] ? state.machines[0].id : null;
    currentResults = [];
    render();
  }

  function openNewFolderDialog() {
    if (!activeMachine()) return showToast("Select a machine first.");
    editingFolderId = null;
    el.folderNameInput.value = "";
    el.folderPathInput.value = "";
    el.folderRecursiveInput.checked = true;
    el.folderDialog.showModal();
  }

  function openEditFolderDialog(folderId) {
    const folder = activeMachine().folders.find((item) => item.id === folderId);
    editingFolderId = folderId;
    el.folderNameInput.value = folder.name;
    el.folderPathInput.value = folder.path;
    el.folderRecursiveInput.checked = folder.recursive !== false;
    el.folderDialog.showModal();
  }

  async function saveFolder(event) {
    event.preventDefault();
    const machine = activeMachine();
    if (!machine) return;
    if (!machine.token) return showToast("Pair this machine first.");
    const folder = {
      name: el.folderNameInput.value.trim(),
      path: el.folderPathInput.value.trim(),
      recursive: el.folderRecursiveInput.checked
    };
    try {
      const path = editingFolderId ? `/folders/${encodeURIComponent(editingFolderId)}` : "/folders";
      const response = await fetch(apiUrl(machine, path), {
        method: editingFolderId ? "PUT" : "POST",
        headers: { ...authHeaders(machine), "Content-Type": "application/json" },
        body: JSON.stringify(folder)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save folder.");
      machine.folders = data.folders;
      el.folderDialog.close();
      render();
      showToast("Folder saved.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function deleteFolder(folderId) {
    const machine = activeMachine();
    if (!machine || !machine.token) return showToast("Pair this machine first.");
    if (!confirm("Delete this folder from the agent allowlist?")) return;
    try {
      const response = await fetch(apiUrl(machine, `/folders/${encodeURIComponent(folderId)}`), {
        method: "DELETE",
        headers: authHeaders(machine)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete folder.");
      machine.folders = data.folders;
      currentResults = currentResults.filter((file) => file.folderId !== folderId);
      render();
      showToast("Folder deleted.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function scanFolder(folderId) {
    const machine = activeMachine();
    if (!machine || !machine.token) return showToast("Pair this machine first.");
    try {
      const response = await fetch(apiUrl(machine, `/scan/${encodeURIComponent(folderId)}`), {
        headers: authHeaders(machine)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan failed.");
      currentResults = [
        ...currentResults.filter((file) => file.folderId !== folderId),
        ...data.files
      ];
      renderResults();
      showToast(`Found ${data.files.length} static files.`);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function scanLan() {
    const machine = activeMachine();
    if (!machine || !machine.token) return showToast("Pair a local agent first.");
    showToast("Scanning LAN...");
    try {
      const response = await fetch(apiUrl(machine, `/lan/scan?port=${encodeURIComponent(machine.port)}`), {
        headers: authHeaders(machine)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "LAN scan failed.");
      lanDevices = data.devices || [];
      renderLanDevices();
      showToast(`Found ${lanDevices.length} OpenX agents.`);
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderLanDevices() {
    const query = el.lanSearchInput.value.trim().toLowerCase();
    const devices = lanDevices.filter((device) => {
      const text = `${device.machineName || ""} ${device.host || ""} ${device.machineId || ""}`.toLowerCase();
      return text.includes(query);
    });
    el.lanDeviceList.innerHTML = "";
    if (!devices.length) {
      el.lanDeviceList.className = "device-list empty";
      el.lanDeviceList.textContent = lanDevices.length ? "No devices match the search." : "No LAN scan yet.";
      return;
    }
    el.lanDeviceList.className = "device-list";
    for (const device of devices) {
      const row = document.createElement("div");
      row.className = "device-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(device.machineName || "OpenX Agent")}</strong>
          <div class="device-path">${escapeHtml(device.host)}:${device.port}</div>
        </div>
        <div class="row-actions">
          <span class="status">${escapeHtml(device.latencyMs)} ms</span>
          <button data-action="add">Add</button>
        </div>
      `;
      row.querySelector('[data-action="add"]').addEventListener("click", () => addDiscoveredMachine(device));
      el.lanDeviceList.appendChild(row);
    }
  }

  function addDiscoveredMachine(device) {
    const existing = state.machines.find((machine) => machine.host === device.host && Number(machine.port) === Number(device.port));
    if (existing) {
      activeMachineId = existing.id;
      render();
      showToast("Machine already exists.");
      return;
    }
    const machine = {
      id: crypto.randomUUID(),
      name: device.machineName || `OpenX ${device.host}`,
      host: device.host,
      port: device.port,
      agentMachineId: device.machineId,
      folders: []
    };
    state.machines.push(machine);
    activeMachineId = machine.id;
    render();
    showToast("Machine added. Pair it to manage folders.");
  }

  function openFileTypesDialog() {
    editingFileTypes = state.fileTypes.map((item) => ({ ...item }));
    el.newFileTypeInput.value = "";
    renderFileTypeEditor();
    el.fileTypesDialog.showModal();
  }

  function renderFileTypeEditor() {
    el.fileTypeEditorList.innerHTML = "";
    if (!editingFileTypes.length) {
      el.fileTypeEditorList.className = "editor-list empty";
      el.fileTypeEditorList.textContent = "No file types configured.";
      return;
    }
    el.fileTypeEditorList.className = "editor-list";
    editingFileTypes.forEach((type, index) => {
      const row = document.createElement("div");
      row.className = "editor-row";
      row.innerHTML = `
        <label class="checkbox"><input data-role="enabled" type="checkbox" ${type.enabled ? "checked" : ""}> Active</label>
        <input data-role="extension" value="${escapeHtml(type.extension)}" aria-label="File extension">
        <button data-role="delete" type="button" class="danger">Delete</button>
      `;
      row.querySelector('[data-role="enabled"]').addEventListener("change", (event) => {
        editingFileTypes[index].enabled = event.target.checked;
      });
      row.querySelector('[data-role="extension"]').addEventListener("input", (event) => {
        editingFileTypes[index].extension = event.target.value;
      });
      row.querySelector('[data-role="delete"]').addEventListener("click", () => {
        editingFileTypes.splice(index, 1);
        renderFileTypeEditor();
      });
      el.fileTypeEditorList.appendChild(row);
    });
  }

  function addEditingFileType() {
    const extension = normalizeExtension(el.newFileTypeInput.value);
    if (!extension) return showToast("Enter a file extension.");
    if (editingFileTypes.some((item) => normalizeExtension(item.extension) === extension)) {
      return showToast("File type already exists.");
    }
    editingFileTypes.push({ extension, enabled: true });
    el.newFileTypeInput.value = "";
    renderFileTypeEditor();
  }

  function saveFileTypes(event) {
    event.preventDefault();
    const normalized = [];
    for (const type of editingFileTypes) {
      const extension = normalizeExtension(type.extension);
      if (!extension || normalized.some((item) => item.extension === extension)) continue;
      normalized.push({ extension, enabled: Boolean(type.enabled) });
    }
    if (!normalized.length) {
      showToast("Keep at least one file type.");
      return;
    }
    if (!normalized.some((item) => item.enabled)) normalized[0].enabled = true;
    state.fileTypes = normalized;
    el.fileTypesDialog.close();
    render();
    showToast("File filters updated.");
  }

  function apiUrl(machine, path) {
    return `http://${machine.host}:${machine.port}${path}`;
  }

  function authHeaders(machine) {
    return { Authorization: `Bearer ${machine.token}` };
  }

  function ensureFileTypeState(targetState) {
    const defaults = [
      { extension: ".html", enabled: true },
      { extension: ".md", enabled: true }
    ];
    if (!Array.isArray(targetState.fileTypes) || !targetState.fileTypes.length) {
      targetState.fileTypes = defaults;
      return;
    }
    targetState.fileTypes = targetState.fileTypes
      .map((item) => ({
        extension: normalizeExtension(item.extension || item),
        enabled: item.enabled !== false
      }))
      .filter((item) => item.extension);
    if (!targetState.fileTypes.length) targetState.fileTypes = defaults;
    if (!targetState.fileTypes.some((item) => item.enabled)) targetState.fileTypes[0].enabled = true;
  }

  function extensionOf(filePath) {
    const name = String(filePath).split("/").pop() || "";
    const dotIndex = name.lastIndexOf(".");
    return dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : "";
  }

  function normalizeExtension(value) {
    const extension = String(value || "").trim().toLowerCase();
    if (!extension) return "";
    const normalized = extension.startsWith(".") ? extension : `.${extension}`;
    return /^\.[a-z0-9]+$/.test(normalized) ? normalized : "";
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
