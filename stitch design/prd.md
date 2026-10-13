# S.E.R.O.S. — Product Requirements Document (PRD)

**Product:** Smart Energy & Resource Optimization System  
**Platforms:** Responsive website + Android mobile app  
**Design phase:** Google Stitch  
**Core principle:** Powerful features, simple experience.

## 1. Product vision
Help institutions understand room occupancy and energy use, reduce waste, and manage connected devices. The website is the primary administration workspace. The mobile app is designed for quick everyday use, but must expose **all major features during testing**, including camera monitoring and admin tools.

## 2. Goals
- Make system status understandable within seconds.
- Make first-time use easy without training.
- Support older adults and people with limited reading confidence.
- Provide mobile access to every major feature for authorized testers.
- Keep web and mobile visually consistent and responsive.
- Clearly distinguish real, estimated, historical, and simulated data.
- Preserve existing backend logic and enforce permissions.

## 3. Users
- **Administrator:** users, roles, rooms, devices, automation, settings.
- **Teacher/staff:** room status, energy summaries, alerts, permitted controls.
- **First-time user:** needs obvious next steps and guided setup.
- **Older adult / low-literacy user:** needs plain language, clear visual cues, large controls, and optional audio guidance.

Do not assume users know technical terms, can read long paragraphs, or can distinguish colors without labels.

## 4. Platform scope

### Website — primary administration workspace
- Live camera feeds
- YOLO occupancy detection and status
- Dashboard, analytics, and usage heatmaps
- Predictions and bill estimator
- Device inventory and authorized controls
- Automation rules and history
- Users and roles
- Rooms and zones
- System settings and diagnostics
- AI assistant and alerts
- Authentication and role-based access

### Mobile app — everyday experience plus full testing access
The mobile app must also include **all** the features above: camera feeds, occupancy detection, analytics, heatmaps, predictions, devices, automation, user management, room management, system settings, diagnostics, assistant, and alerts.

In the development/testing build, provide an **Admin & Testing** area so authorized testers can reach every feature on a phone. Do not hide camera or admin features simply because the screen is mobile. Production access must still be protected by server-side permissions.

## 5. Navigation and information architecture

### Main mobile navigation
Use five persistent destinations:
1. **Home** — key status and shortcuts
2. **Rooms** — room list, occupancy, room details, camera entry
3. **Energy** — usage, cost, analytics, heatmap, predictions
4. **Devices** — device status, controls, automation shortcut
5. **More** — assistant, alerts, Admin & Testing, users, settings, help

Use the same groups in a desktop sidebar. Avoid clipped horizontal tab strips.

### Admin & Testing
Group large, labeled links into:
- **Monitoring:** Camera, Occupancy
- **Insights:** Analytics, Heatmap, Predictions
- **Control:** Devices, Automation
- **Setup:** Rooms, Users, System Settings
- **Diagnostics:** Backend, database, camera, device connections

## 6. Core user journeys

### First launch
1. Welcome screen with a one-sentence explanation.
2. Offer language selection.
3. Sign in or continue according to the existing authentication flow.
4. Guided checklist: connect to S.E.R.O.S., choose a room, check camera, check devices.
5. Show success and one next action. Allow optional steps to be skipped.

### Check a room
Open Rooms → choose a large room card → see Occupied, Empty, or Unknown → view camera if permitted → see last update and connected devices.

### Check energy
Open Energy → see today's usage and estimated cost → choose Today / 7 days / 30 days → open detailed analytics or heatmap.

### Control a device
Open Devices → choose a device card → use a large labeled control → show pending state → confirm success only after the backend confirms it.

### Create automation
Choose a trigger, condition, and action using a guided flow. Show a plain-language summary such as “When the room is empty for 10 minutes, turn off the lights.” Require confirmation before activating real device actions.

### Diagnose system
Open Admin & Testing → see clear Connected / Needs attention / Offline states → open a problem → follow a plain-language recovery step.

## 7. Functional requirements

### Home
- Show overall system status, key energy summary, room occupancy summary, and actionable alerts.
- Provide large shortcuts to Rooms, Energy, Devices, and Admin & Testing if authorized.
- Never fill empty space with fabricated data.

### Camera and occupancy
- Responsive live feed, camera selector, start/stop controls if supported.
- Show YOLO status, room name, occupancy result, and last update.
- States: Connecting, Live, Paused, Offline, Error.
- Stale data must not be presented as live.
- Camera access must respect permissions and privacy.

### Energy, analytics, heatmap
- Show energy trends, estimated costs, device breakdowns, and heatmaps.
- Offer Today, 7 days, and 30 days filters.
- Clearly label measured, estimated, historical, or demo data.
- If no energy meter exists, do not present estimates as measured kWh.

### Predictions and assistant
- Show forecast period, data source, and limitations.
- Label forecasts as estimates.
- Offer example questions and plain-language answers.
- Clearly report when current data is unavailable.

### Devices and automation
- Device cards show name, room, connection status, current state, and available controls.
- Use large ON/OFF controls with explicit labels.
- Require confirmation for high-impact or multi-device actions.
- Rules use readable WHEN / THEN steps and show On, Paused, or Needs attention.
- Clearly distinguish simulated actions from real device actions.

### Users, rooms, settings
- Admin-only user and role management.
- Room/zone management includes name, camera association, and devices.
- Settings include language, accessibility, notifications, and system connection health.
- Never expose secrets or API keys in ordinary screens.

### Authentication and permissions
- Clear login, logout, and expired-session states.
- Enforce access on the backend, not only by hiding UI controls.
- Use least-privilege access for camera, devices, users, and system settings.

## 8. Non-functional requirements
- Responsive on small Android phones, larger phones, tablets, and desktop.
- Aim for touch targets at least 48 × 48 CSS px.
- Support text scaling, strong contrast, screen readers, and localization.
- Never rely on color alone.
- Every data-driven page must include loading, empty, offline, and error states as applicable.
- Error messages must explain the issue and next step.
- Avoid unnecessary animation and respect reduced-motion preferences.

## 9. Data integrity
Use explicit labels:
- **Live / Measured**
- **Estimated**
- **Historical**
- **Demo / Simulated**

Do not invent readings, savings, occupancy, device states, or successful actions. Backend and database indicators must not contradict each other; show separate statuses only if checked independently.

## 10. Visual direction
Use **Playful Utility**:
- Warm cream background, not pure white everywhere
- White and lightly tinted cards
- Forest-green primary actions
- Sunny orange and lime accents
- Friendly illustrations and rounded controls
- Clear typography, short copy, and useful feedback
- Small moments of delight without distracting motion

Avoid muddy brown full-page backgrounds, gray-on-gray cards, clipped tabs, tiny labels, dense mobile tables, glassmorphism, neon, excessive gradients, and generic AI-dashboard styling.

## 11. Acceptance criteria
- First-time users can identify Home, Rooms, Energy, and Devices without instruction.
- Authorized testers can reach every major feature on mobile.
- Older/low-literacy users can navigate with icons paired with words and short instructions.
- Camera status and freshness are obvious.
- No unintended horizontal page overflow.
- Real and demo data are clearly separated.
- Admin-only actions are protected by server-side permissions.
- Web and mobile feel like one product but are optimized for their screens.

## 12. Out of scope for Stitch
Do not replace the backend, invent new APIs, rewrite YOLO/prediction/device logic, or claim real energy measurement without a real measurement source. Stitch should establish the screen system, navigation, visual language, and interaction patterns.
