# S.E.R.O.S. — Design System & UX Guidelines

**Direction:** Playful Utility  
**Audience:** Administrators, teachers, staff, first-time users, older adults, and people with limited reading confidence.  
**Principle:** Make the next useful action obvious.

## 1. Design philosophy
S.E.R.O.S. should feel like a friendly, dependable everyday tool—not a control-room console. Keep advanced capabilities available, but reveal complexity only when needed.

### Five rules
1. One main job per screen.
2. Plain language before technical terminology.
3. Icons always accompany words for important actions.
4. Common tasks first; advanced controls in Admin & Testing.
5. Always explain whether information is live, loading, offline, stale, or demo.

## 2. Color palette — Fresh Garden

| Token | Hex | Usage |
|---|---|---|
| Canvas | `#F7F4E8` | Warm cream page background |
| Surface | `#FFFFFF` | Main cards |
| Surface green | `#EAF5DD` | Positive summaries / selected areas |
| Surface peach | `#FFF0E4` | Tips and secondary highlights |
| Surface yellow | `#FFF4CC` | Helpful notices |
| Primary green | `#27834A` | Main actions and selected navigation |
| Pressed green | `#1F693B` | Pressed primary controls |
| Orange | `#FFB547` | Highlights |
| Lime | `#DFF3A3` | Progress and illustration accents |
| Main text | `#26372D` | Headings and body |
| Secondary text | `#68766B` | Supporting text |
| Border | `#E3E5D8` | Card/input boundaries |
| Danger | `#B93832` | Errors and destructive actions |
| Danger surface | `#FCE8E6` | Error backgrounds |
| Info | `#276B8C` | Informational state |
| Info surface | `#E5F2F8` | Informational backgrounds |

### Color rules
- Use mostly cream and white surfaces, with small purposeful bursts of color.
- Green means primary action or positive state; orange is an accent, not the sole warning indicator.
- Red is reserved for real errors, offline states, or destructive actions.
- Every state needs a label or symbol plus text; never rely on color alone.
- Verify contrast during implementation.
- Avoid muddy brown full-screen backgrounds and low-contrast gray-on-gray.

## 3. Typography
Use **Nunito** for a friendly feel; use Inter or a clear system sans-serif as fallback.

Recommended sizes:
- Page title: 28–32 px, bold
- Section title: 22–24 px
- Card title: 18–20 px
- Body: 16–18 px
- Supporting text: 14–16 px
- Data labels: preferably 14 px or larger
- Key values: 28–36 px

Avoid all-caps labels, overly spaced lettering, long paragraphs, and tiny chart labels. Support device text scaling.

## 4. Shapes and spacing
- Main cards: 18–24 px radius
- Buttons/inputs: 14–18 px radius
- Spacing rhythm: 8, 12, 16, 24, 32 px
- Mobile card padding: 16–20 px
- Desktop card padding: 20–24 px
- Use visible but subtle borders and limited soft shadows.
- Use simple friendly illustrations related to rooms, leaves, lights, energy, and devices.
- Playfulness comes from color, shape, clear feedback, and friendly copy—not clutter or constant animation.

## 5. Accessibility and low-literacy design

### Always
- Pair important icons with short labels.
- Use familiar icons consistently: home, room, bolt, lightbulb, camera, person, settings.
- Use common words and short sentences.
- Break multi-step tasks into small steps with visible progress.
- Use large buttons with action verbs: “View camera”, “Turn light off”, “Try again”.
- Confirm important actions and explain results.
- Offer optional audio guidance/read-aloud for key instructions where feasible.
- Offer language selection and prepare text for translation.
- Put error explanations and next steps together.
- Let users go back without losing work.

### Never
- Use an icon alone for a critical action.
- Communicate status only through color.
- Depend on hover interactions.
- Use unexplained acronyms like YOLO, API, HVAC, or kWh without a plain-language explanation.
- Make dense tables the only mobile view.
- Use tiny text or tightly packed controls.

### Accessibility settings
Under **More → Settings → Accessibility**, design controls for:
- Text size: Standard / Large / Extra large
- Reduce motion
- Audio guidance
- High contrast
- Language
- Screen-reader-friendly labels

These controls should be implemented as working preferences, not decorative toggles.

## 6. Navigation

### Mobile bottom navigation
Five items, each with icon and text:
1. **Home**
2. **Rooms**
3. **Energy**
4. **Devices**
5. **More**

Use green for the selected item and a pale-green selection surface/indicator. Do not use a horizontally clipped strip of section tabs.

### More screen
Use large rows with icon, label, and optional one-line description:
- Assistant
- Alerts
- Automation
- Admin & Testing (authorized users)
- Users (admins only)
- Rooms & System Settings (admins only)
- Help & Accessibility
- About S.E.R.O.S.

### Website navigation
Use a left sidebar on desktop, grouped as:
- Everyday: Home, Rooms, Energy, Devices
- Manage: Automation, Assistant, Alerts
- Administration: Admin & Testing, Users, System Settings

Use a clear navigation drawer on smaller screens.

## 7. Screen specifications

### Welcome / first-time setup
- Friendly energy/room illustration.
- Heading: “Welcome to S.E.R.O.S.”
- Copy: “See room activity and understand energy use.”
- Primary button: “Get started”
- Secondary action: “I’m already set up”
- Visible language selector.
- Guided checklist: Connect to S.E.R.O.S. → Choose a room → Check camera (if authorized) → Check devices → Finish.
- Allow optional steps to be skipped. Ordinary users should not need server URLs or technical configuration.

### Home
Order content as:
1. Greeting and selected site/room
2. System status card
3. Two or three key summaries (rooms occupied, energy today, alerts)
4. Large shortcuts to Rooms, Energy, Devices
5. One relevant tip if supported by real data

Do not fill empty space with fake charts.

### Rooms list and detail
- Use large room cards, not a dense table.
- Show room name, occupancy text, recognizable icon, camera status, and “Open room”.
- Detail screen: room status, “View live camera” if authorized, last update, devices, energy summary, and collapsed advanced diagnostics.

### Camera and occupancy
- Room/camera selector
- Large stable-aspect-ratio camera feed
- Status with icon and text: Live, Connecting, Paused, Offline, Error
- Occupancy result in plain language
- Last-updated time
- Supported controls: Start, Stop, Retry, Flip
- Advanced detection information collapsed by default
- Never call stale or disconnected footage live.

### Energy
- Lead with “Energy today” and “Estimated cost” when available.
- Simple chart with Today / 7 days / 30 days filters.
- Link to detailed analytics.
- Label measured versus estimated data. If no meter exists, do not imply that estimated usage is measured.

### Analytics and heatmap
- Begin with a one-sentence summary.
- One chart per card, readable axes, direct labels, and accessible legend.
- On phones, simplify heatmaps or scroll only inside the visualization—not the whole page.
- Use labels like “Low use”, “Medium use”, and “High use”.
- Put detailed breakdowns below the summary.

### Predictions / bill estimator
- Simple forecast chart, estimated bill, period covered, and data source.
- Explain that predictions can differ from actual usage.
- Put tariff assumptions in an expandable panel.
- Use “Estimated monthly bill”, not “Confirmed bill”.

### Devices
Use cards on mobile. Each card has:
- Familiar icon, device name, room
- On / Off / Offline / Unknown status
- Power/usage if available
- Large control with explicit action text
- Pending/failure feedback

Do not show success until the backend confirms it. Confirm high-impact or multi-device actions.

### Automation
Use readable rule cards:
- **WHEN:** “Room is empty for 10 minutes”
- **THEN:** “Turn off the lights”
- Status: On / Paused / Needs attention
- Actions: Edit / Pause / Resume

Rule builder steps: Choose trigger → Choose condition → Choose action → Review summary → Confirm. State which devices may be affected and whether the action is simulated or real.

### Assistant
- Friendly introduction and prominent input.
- Suggested questions: “How much energy did we use today?” and “Which room used the most energy?”
- Short answers first; “See details” for more.
- Read-aloud option where feasible.
- Be clear when current data is unavailable.

### Admin & Testing
A clearly titled area for authorized testers. Include grouped cards:
- Monitoring: Camera, Occupancy
- Insights: Analytics, Heatmap, Predictions
- Control: Devices, Automation
- Setup: Rooms, Users, System Settings
- Diagnostics: Backend, database, camera, device connections

All features must be reachable on mobile for authorized testing. Production permissions must still be enforced by the backend.

### Users, rooms, settings
- Searchable lists with large rows.
- Clear role descriptions and account status.
- Guided room setup; essential fields first.
- Advanced settings collapsed by default.
- Confirm destructive actions.
- Never expose secret keys or passwords.

## 8. Component rules

### Buttons
- Primary: forest green with high-contrast text
- Secondary: cream/white with visible border
- Destructive: red and clearly labeled
- Aim for at least 48 × 48 px touch targets.
- Use action verbs and show pending/disabled states.

### Cards
- White or lightly tinted surfaces.
- One main purpose per card.
- Short heading and concise supporting text.
- Avoid unnecessary nested cards.

### Status chips
Combine a symbol and word:
- Connected
- Needs attention
- Offline
- Unknown

Do not treat a database-connected indicator as proof that the backend API works. Show separate states only when checked independently.

### Forms
- Visible label above each input; never rely on placeholder-only labels.
- Minimal required fields.
- Plain-language validation next to the field.
- Advanced options in a separate expandable section.

### Charts
- Clear title, period, direct labels, readable axes.
- Use color plus labels/shapes/patterns.
- Provide a useful empty state.
- Never present fabricated values as real readings.

## 9. Copy and microcopy

| Avoid | Prefer |
|---|---|
| Occupancy inference: 0 | Room appears empty |
| Backend unreachable | S.E.R.O.S. is not responding |
| Telemetry unavailable | No recent device data |
| Execute automation | Turn on this rule |
| Consumption forecast | Estimated future energy use |
| Invalid credentials | Check your email and password |
| No records found | No data yet — check again after the system runs |

Only say “Room appears empty” when detection supports it. If detection is unavailable, say “Room status unavailable.”

## 10. Responsive behavior

### Mobile
- One main content column.
- Persistent bottom navigation.
- Large touch targets and cards instead of wide tables.
- No unintended horizontal page overflow.
- Advanced information in expandable sections.
- Keep primary actions clear and above fixed navigation.

### Tablet
- Two-column cards when space permits.
- Camera and occupancy status may share a row.

### Desktop
- Sidebar plus content area.
- Multi-column summaries where useful.
- Use tables for admin data only when they improve scanning.
- Keep primary status and action near the top.

## 11. Loading, empty, error, and success states
Every data-driven feature needs relevant states:
- **Loading:** calm skeleton or short “Loading…” label.
- **Empty:** explain what is missing and how to collect it.
- **Offline:** show last update and retry/help action.
- **Error:** short explanation plus a specific next step.
- **Success:** confirm only an action that actually succeeded.
- **Stale:** show the last update time; do not call it live.
- **Demo:** persistent “Demo data” / “Sample data” label.

Never leave an endless spinner without explanation or recovery action.

## 12. Google Stitch prompt / deliverables

Create a cohesive responsive design system for S.E.R.O.S. using this document. Produce mobile-first Android screens and a matching desktop web-admin layout for:
1. Welcome / first-time setup
2. Home dashboard
3. Rooms list
4. Room details
5. Camera monitoring and YOLO occupancy
6. Energy overview
7. Detailed analytics
8. Usage heatmap
9. Predictions / bill estimator
10. Device inventory and device detail
11. Automation list and guided rule builder
12. AI assistant
13. Alerts
14. Admin & Testing hub
15. User management
16. Room and zone management
17. System settings and connection diagnostics
18. Accessibility and language settings
19. Loading, empty, offline, error, and success states

Use clearly labeled sample data in mockups. Keep all feature groups reachable on mobile for authorized testing. Keep the default experience simple: everyday destinations first, advanced administration grouped under Admin & Testing. Do not invent a backend redesign or remove any feature.

## 13. Design review checklist
- [ ] Welcome screen explains the app in simple language.
- [ ] Main navigation has icons and words and never clips.
- [ ] Authorized testers can reach all major features on mobile.
- [ ] Admin-only screens are labeled and permission-aware.
- [ ] No critical action relies on color or icon alone.
- [ ] Text remains readable when enlarged.
- [ ] Main tasks use plain language and short steps.
- [ ] Camera/backend/database/device states are not contradictory.
- [ ] Live, estimated, historical, and demo data are distinct.
- [ ] Errors offer a next step.
- [ ] Device actions provide honest feedback.
- [ ] No unintended horizontal overflow.
- [ ] The interface feels warm and playful without becoming childish or cluttered.
