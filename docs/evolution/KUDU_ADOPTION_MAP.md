# Kudu → Omnia adoption map

Status: proposed evolution slice; not runtime-qualified.

## Adopt now

- Cleaner rule schema as a source format for candidate cleanup intents.
- Platform-separated cleaner catalogs (`darwin`, `win32`, `linux`) as upstream data sources.
- Product concepts: system cleaner, browser/app cache cleanup, disk analysis, startup/service inventory, updater/debloater UI patterns.
- Cross-platform desktop packaging lessons and IPC/service separation patterns.

## Adapt, never copy as authority

Kudu cleanup rules become **read-only candidate descriptors**. Omnia must translate them into typed proposals carrying:

- upstream rule identity/version,
- resolved candidate item identity,
- size/age observations,
- required privilege metadata,
- expected local state/revision,
- operation ID,
- dry-run plan.

A rule match alone MUST NOT delete or mutate anything.

## Defer

- remote/cloud commands,
- quarantine/delete malware actions,
- registry writes,
- service/startup writes,
- debloater actions,
- package/software updates,
- secure-delete execution,
- custom shell cleanup actions.

Each deferred class needs a distinct authority contract and independent acceptance suite.

## Omnia product mapping

| Kudu capability | Omnia destination |
|---|---|
| System / browser / app cleaner | System Cleanup + File & Caches Organizer |
| Disk analyzer | File & Caches Organizer |
| Startup/service inventory | App Manager (read-only first) |
| Software updater / debloater | App Manager (future mutation slice) |
| Scheduler | Automation layer after receipt-backed operations exist |
| Cloud fleet management | Not adopted in this slice |

## Non-negotiable invariant

Kudu contributes discovery and product UX. Omnia remains the sole owner of revision/state transition semantics and destructive-operation receipts.
