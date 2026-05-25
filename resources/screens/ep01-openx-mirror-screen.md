# OpenX Mirror Dashboard

```text
+--------------------------------------------------------------------------------+
| OpenX Mirror                                                                   |
+------------------------------+-------------------------------------------------+
| OX OpenX Mirror               | Selected Machine                                |
| LAN static report browser     | Mac Mini Dev                                    |
|                              | 192.168.1.20:8787 - paired                      |
| [Add Machine]                 |              [Pair] [Scan LAN] [Check] [Delete] |
|                              +-------------------------------------------------+
| Machines                      | LAN Devices                                     |
| + Mac Mini Dev     Paired     |                                                 |
| + Windows QA      Not paired  | + MacBook Air                                  |
|                              |   192.168.1.24:8787                  [Add]      |
|                              +-------------------------------------------------+
|                              | Folders                                         |
|                              |                                  [Add Folder]   |
|                              | + lunar-ios                                     |
|                              |   /Volumes/Fightech/Projects/lunar-ios          |
|                              |                         [Scan] [Edit] [Delete]  |
|                              +-------------------------------------------------+
|                              | Static Files                         [Search]   |
|                              | + e2e.html                         lunar-ios    |
|                              |   reports/e2e.html                              |
|                              | + srs.html                         lunar-ios    |
+------------------------------+-------------------------------------------------+
```

## Components

- Sidebar machine list.
- Machine add dialog.
- Pairing dialog.
- Active machine toolbar.
- LAN device discovery panel.
- Folder allowlist panel.
- Folder add/edit dialog.
- Static file result panel.
- Search input.
- Toast status message.

## States

- Empty machine list.
- Machine selected.
- Machine not paired.
- Machine paired.
- Agent offline.
- LAN scan empty.
- LAN scan results.
- Folder list empty.
- Scan result empty.
- Search no match.
- API error.

## Events

- Add machine.
- Select machine.
- Pair machine.
- Check machine health.
- Scan LAN.
- Add discovered machine.
- Delete machine.
- Add folder.
- Edit folder.
- Delete folder.
- Scan folder.
- Search files.
- Open file.
