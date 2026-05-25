(function () {
  const STORAGE_KEY = "openx-mirror-state-v1";
  const state = loadState();
  let activeMachineId = state.activeMachineId || null;
  let editingMachineId = null;
  let editingFolderId = null;
  let currentResults = [];

  const el = {
    machineList: document.getElementById("machineList"),
    activeMachineName: document.getElementById("activeMachineName"),
    activeMachineMeta: document.getElementById("activeMachineMeta"),
    folderList: document.getElementById("folderList"),
    resultList: document.getElementById("resultList"),
    searchInput: document.getElementById("searchInput"),
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
    folderRecursiveInput: document.getElementById("folderRecursiveInput")
  };

  document.getElementById("addMachineBtn").addEventListener("click", openNewMachineDialog);
  document.getElementById("editMachineBtn").addEventListener("click", openEditMachineDialog);
  document.getElementById("pairBtn").addEventListener("click", openPairDialog);
  document.getElementById("healthBtn").addEventListener("click", checkHealth);
  document.getElementById("deleteMachineBtn").addEventListener("click", deleteActiveMachine);
  document.getElementById("addFolderBtn").addEventListener("click", openNewFolderDialog);
  el.searchInput.addEventListener("input", renderResults);

  el.machineForm.addEventListener("submit", saveMachine);
  el.pairForm.addEventListener("submit", pairMachine);
  el.folderForm.addEventListener("submit", saveFolder);

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
    renderFolders();
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
    const results = currentResults.filter((item) => item.relativePath.toLowerCase().includes(query));
    el.resultList.innerHTML = "";
    if (!results.length) {
      el.resultList.className = "result-list empty";
      el.resultList.textContent = currentResults.length ? "No files match the search." : "No files scanned.";
      return;
    }
    el.resultList.className = "result-list";
    for (const file of results) {
      const row = document.createElement("div");
      row.className = "result-row";
      const link = apiUrl(activeMachine(), `/file/${encodeURIComponent(file.folderId)}/${file.relativePath.split("/").map(encodeURIComponent).join("/")}`);
      row.innerHTML = `
        <div>
          <a href="${link}" target="_blank" rel="noopener">${escapeHtml(file.name)}</a>
          <div class="result-path">${escapeHtml(file.relativePath)}</div>
        </div>
        <span class="status">${escapeHtml(file.folderName)}</span>
      `;
      el.resultList.appendChild(row);
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

  function apiUrl(machine, path) {
    return `http://${machine.host}:${machine.port}${path}`;
  }

  function authHeaders(machine) {
    return { Authorization: `Bearer ${machine.token}` };
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
