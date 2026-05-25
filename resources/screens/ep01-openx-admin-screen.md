# OpenX Admin Portal

```text
+--------------------------------------------------------------------------------+
| OpenX Admin                                                                    |
+------------------------------+-------------------------------------------------+
| OX OpenX Admin              | Admin Portal                                    |
| Cloud sync key management    | Create API keys for iPad and browsers.          |
|                              |                              [Refresh Keys]     |
| [Dashboard]                  +-------------------------------------------------+
|                              | Cloud Workspace                                 |
|                              | Supabase URL / anon key / workspace / admin key |
|                              |                              [Save Settings]    |
|                              +-------------------------------------------------+
|                              | API Keys                                        |
|                              | New API Key Name              [Create API Key]   |
|                              | Generated API Key             [Copy Key]        |
|                              | + iPad Safari ox_live_abcd... [Revoke]          |
+------------------------------+-------------------------------------------------+
```

## Components

- Dashboard navigation link.
- Cloud workspace settings form.
- Admin key input.
- API key creation form.
- One-time generated key display.
- API key list.
- Revoke button.

## States

- Admin settings missing.
- Admin settings configured.
- No API keys loaded.
- API key generated.
- API key active.
- API key revoked.
- API error.

## Events

- Save admin settings.
- Refresh API keys.
- Create API key.
- Copy generated key.
- Revoke API key.
- Navigate back to dashboard.
