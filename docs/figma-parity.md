# Figma Make Prototype Parity Check

This document tracks all features from the Figma Make prototype at https://civic-driver-20046839.figma.site and their implementation status in the current app.

## Feature Matrix

| Feature | Location in Prototype | Status | Location in App | Notes |
|---------|----------------------|--------|-----------------|-------|
| **Route Intelligence / Route Checks** |
| Status timeline with steps | Route checks page, right sidebar | ✅ Present | RouteIntelligence.tsx | Shows: Route imported → Route checked → Monitoring live → Dispatch decision |
| Source chips per evidence | Route checks page, evidence panel | ⬜ Partial | - | Component exists but not integrated into evidence cards yet |
| Dynamic primary CTA per verdict | Route checks page, verdict banner | ✅ Present | RouteIntelligence.tsx | READY: "Proceed with departure" / VERIFY: "Verify before departure" / HOLD: "Take action" |
| Take action sheet | Route checks page, triggered by "Take action" button | ✅ Present | TakeActionSheet.tsx | Bottom sheet with: Review issue / Escalate / Hold departure |
| Escalate dialog | Triggered from Take action sheet | ✅ Present | EscalateDialog.tsx | Confirm escalation to transport manager |
| Hold departure dialog | Triggered from Take action sheet | ✅ Present | HoldDepartureDialog.tsx | Confirm placing route on hold |
| Request on-site check dialog | Triggered from Take action sheet or evidence | ✅ Present | RequestOnSiteCheckDialog.tsx | Request field verification with optional notes |
| On-site confirmation dialog | Evidence items with "Confirm on site" | ✅ Present | OnSiteConfirmDialog.tsx | Open / Closed / Partly open selector, photo upload, note field |
| Information checked panel | Route checks page, expandable "Show details" | ✅ Present | InformationCheckedPanel.tsx | Lists all sources checked with status and freshness |
| Monitoring controls | Route checks sidebar, below verdict | ✅ Present | MonitoringControls.tsx | Stop/Resume monitoring, countdown to departure/next check |
| Stop monitoring button | Route checks sidebar | ✅ Present | MonitoringControls.tsx | Pauses live monitoring |
| Resume monitoring button | When monitoring stopped | ✅ Present | MonitoringControls.tsx | Restarts monitoring |
| Hidden test scenarios drawer | Route checks page, bottom-right corner | ✅ Present | TestScenariosDrawer.tsx | Demo controls to simulate closures, new roadworks, etc. |
| Route file upload: VEMAGS support | Route import step | ⬜ Missing | - | Accept VEMAGS PDF/XML exports in addition to GPX |
| **Overview / Home Page** |
| Germany map with route tallies | Overview page, top section | ✅ Present | OverviewMapWithTallies.tsx | Map showing monitored routes with Ready/Verify/Hold counts |
| Route status tallies widget | Overview page, map overlay | ✅ Present | OverviewMapWithTallies.tsx | "4 monitored routes" with colored Ready/Verify/Hold counts |
| Layer presets on map | Overview map | ⬜ Missing | - | Quick filters for Hamburg, Leipzig, Nuremberg, Munich, Bremen, Kassel (placeholder in map) |
| Source status panel | Overview page, below dispatch queue | ✅ Present | SourceStatusPanel.tsx | "Information covering your next route" - lists each data source with icon, status, age |
| **Alerts & History** |
| Alert severity filters | Activity page, top toolbar | ⬜ Missing | - | All / Hold / Verify / Resolved buttons |
| Route filter dropdown | Activity page, top toolbar | ⬜ Missing | - | Filter alerts by specific route |
| "Mark resolved" button per alert | Each alert card | ⬜ Missing | - | Dismiss/resolve individual alerts |
| Alert cards with verdict changes | Activity page | ⬜ Missing | - | Show "Verdict changed READY → HOLD" etc. |
| "Load demo history" button | Activity page (hidden/demo mode) | ⬜ Missing | - | Populate sample alert history for testing |
| **Settings** |
| Organisation name field | Settings page, Organisation profile tab | ✅ Present | Settings.tsx | Editable text field |
| Organisation website field | Settings page | ✅ Present | Settings.tsx | URL field with https:// prefix guidance |
| Organisation description | Settings page | ✅ Present | Settings.tsx | Multiline text, 500 char limit, with counter |
| Organisation type field | Settings page | ✅ Present | Settings.tsx | Text field (e.g., "Heavy-haul operator") |
| Country dropdown | Settings page | ✅ Present | Settings.tsx | Germany / Austria / Switzerland options |
| Verified operator badge | Settings page, top of profile | ⬜ Missing | - | "Verified" badge next to org name |
| Notification channels tab | Settings page, second tab | ⬜ Missing | - | Email/SMS shown as "Coming later" placeholders |
| "Save changes" button | Settings page bottom | ⬜ Missing | - | Disabled until changes made, then enabled |
| **MDS / Marketplace** |
| "Not connected – planned" state | Any marketplace/MDS screen | ⬜ Missing | - | Clear message that MDS integration is out of scope |
| **General UI** |
| Sidebar brand logo + text | Left sidebar, top | ✅ Present | Layout component | "Heavy transport" section header |
| "Mobility Data Space" nav item | Left sidebar | ⬜ Missing | - | Shown as separate branded button |
| Organization avatar/initials | Top-right header | ⬜ Missing | - | "RL" circle with org name dropdown |
| Notifications badge | Top-right toolbar | ⬜ Missing | - | Bell icon with "3" badge |
| Help and settings menu | Top-right toolbar | ⬜ Missing | - | Dropdown with help/settings options |

## Implementation Priority

### Phase 1: Core Missing Features (Route Intelligence)
1. Status timeline component
2. Source chips on evidence items
3. Dynamic verdict CTAs
4. Take action sheet + dialogs (Escalate, Hold departure, Request on-site check)
5. On-site confirmation dialog with outcomes + photo
6. Information checked panel (expandable)
7. Monitoring controls (Stop/Resume + countdown)

### Phase 2: Overview Enhancements
1. Germany map with route tallies
2. Source status panel
3. Layer presets/quick filters

### Phase 3: Alerts & Settings
1. Alert filters (severity + route)
2. Mark resolved per alert
3. Load demo history
4. Organization settings fields
5. Verified operator badge
6. Notification channels placeholder tab

### Phase 4: Polish
1. Test scenarios drawer
2. VEMAGS route import (if feasible)
3. MDS "not connected" placeholder
4. Organization avatar/initials
5. Notifications badge
6. Help menu

## Notes
- MDS integration is explicitly out of scope per requirements
- All features must work at 1440px and 390px without overlaps/scroll
- Free services only, no paid APIs
- Must not break existing Autobahn data, verdict logic, or PDF export
- Keyboard accessible (Esc closes dialogs, visible focus)
