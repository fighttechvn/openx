# OpenX Mirror Dashboard

```text
+--------------------------------------------------------------------------------+
| OpenX Mirror                                                                   |
+------------------------------+-------------------------------------------------+
| OX OpenX Mirror               | Selected Machine                                |
| LAN static report browser     | Mac Mini Dev                                    |
|                              | 192.168.1.20:8787 - paired                      |
| [Add Machine]                 |                       [Pair] [Check] [Delete]   |
|                              +-------------------------------------------------+
| Machines                      | Folders                                         |
| + Mac Mini Dev     Paired     |                                  [Add Folder]   |
| + Windows QA      Not paired  | + lunar-ios                                     |
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
- Folder list empty.
- Scan result empty.
- Search no match.
- API error.

## Events

- Add machine.
- Select machine.
- Pair machine.
- Check machine health.
- Delete machine.
- Add folder.
- Edit folder.
- Delete folder.
- Scan folder.
- Search files.
- Open file.
