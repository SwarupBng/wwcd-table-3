# WWCD Table

A lean, fast points table maker for **BGMI** and **PUBG Mobile** tournaments. Enter each match's results and the app keeps a per-match table and a running overall table, sorted automatically, with rank movement arrows, gold/silver/bronze highlights, the smash rule, and one-click image export in several themes.

> **WWCD** = "winner winner chicken dinner", the term both communities use.

---

## Quick start (local)

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints (normally http://localhost:5173).

Other commands:

```bash
npm test          # run the standings and tiebreaker tests
npm run build     # type-check and build static files into dist/
npm run preview   # serve the built files locally
```

No backend or database is needed. Everything is saved in your browser and the built `dist/` folder can be hosted on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

---

## What it does

1. **Create a tournament:** pick the game (BGMI or PUBG), enter the number of teams, then fill in a table with each team's **slot number** and name. Also set the **players in each lobby** (it starts at 4 per team, so 10 teams gives 40).
2. **Enter each match:** placement points and finish points per team, listed in slot order. Every match gets its own table.
3. **Overall standings** update after every match and are remembered per match, so you can step back to "standings after match 2" while match 3 exists. Use the **‹ and › buttons** on either side of the table to move between matches (each match is a map), or pick a match from the buttons above.
4. **Export** any table as a PNG or JPEG in the theme you choose.

**Progress count:** the header and the table say "**15 out of 18** matches played".

**Single-day tournaments:** set Days to 1 and every day label disappears (no day tabs, no "Day 1" on the table or in the buttons).

### Team slots
Each team has a slot number (its slot in the in-game lobby). The results entry grid lists teams in slot order and shows the slot, which makes entering data quicker. **Slots are never shown on the standings tables or exported images.**

**Terminology:** the app says **finish points** everywhere (never "kill points"), matching official tournament pages.

### Team logos (optional per team)
- Upload a logo, or
- Use an **auto-generated initials logo** (for example "Team Soul" becomes "TS"), or
- Leave it empty.

Tournament and organizer logos, plus a footer line (social handles etc.), can also be added and appear on exported images.

### Entering results
Two entry modes, chosen per tournament:
- **Points (default):** type placement points and finish points per team. The chicken dinner box is ticked automatically when the placement points equal the 1st place value, and can be changed.
- **Rank:** type each team's placement (1, 2, 3...) and number of finishes. The app converts them to points using the points table.

**Mistakes are flagged as you type:**
- A **repeated placement** turns both boxes red and shakes them. The same happens to the chicken dinner boxes if more than one team is ticked.
- A **finish meter** shows the running total against the lobby limit. Total finishes in a match can be at most the players in the lobby minus one (39 for a 40-player lobby). Going over turns the meter and the finish boxes red and shakes them, and saving is blocked until it is fixed. In points mode the finish points are divided by the points per finish to count finishes.
- Non-numeric entries, and placements outside 1 to the number of teams, are rejected.

Press **Enter** to jump to the next team in the same column. Any past match can be reopened and edited, and every later table recalculates.

### Overall table columns (left to right)

| Column | Notes |
|---|---|
| Rank | with the movement arrow beside it |
| Team | logo beside the name, plus SMASH / WINNER tag when relevant |
| Matches | matches played so far |
| WWCD | chicken dinners, shown as a chicken leg with a multiplication sign, e.g. 🍗 × 2 |
| Place Pts | total placement points so far |
| Finish Pts | total finish points so far |
| Total | emphasized |

Match tables use the same columns (without Matches and the movement arrow).

The top three rows get **gold, silver and bronze** highlighting at any point in the tournament, not only on the final table.

### Rank movement
Each team's rank after match N is compared with its rank after the previous match. Shown as a green **▲ with the number of places climbed**, a red **▼ with the number dropped**, or a dash for no change. Nothing is shown after the first match. Stepping back to an earlier match shows the movement as it was at that point.

---

## Points system

Per match, a team's points = **placement points + finish points**.

Default preset (editable per tournament):

| Placement | Points |
|---|---|
| 1st (chicken dinner) | 10 |
| 2nd | 6 |
| 3rd | 5 |
| 4th | 4 |
| 5th | 3 |
| 6th | 2 |
| 7th and 8th | 1 |
| 9th to 16th | 0 |

Finish points: **1 point per finish** (editable).

---

## Tiebreakers

Applied when total points are equal. Default order:

1. **Chicken dinners** (more is better)
2. **Finish points** (more is better)
3. **Who reached that total first**, meaning the team whose running total hit the tied figure in an earlier match

Placement points can also be switched on as a tiebreaker, and the order can be changed in the tournament settings.

If teams are still tied after all of that (for example both reached the total in the same match), the app has no way to know who got there first inside a match, so they stay in the order the teams were entered.

---

## Smash rule

Optional per tournament.

- It applies from the chosen day (default **Day 3**).
- The threshold is set after the previous day: **the leader's total after Day 2, plus 10 extra points** (the 10 is editable).
- A team whose total reaches or passes the threshold is tagged **SMASH**.
- If a team that was already at or above the threshold **before** a match wins a chicken dinner in that match, it is tagged **WINNER** and placed first in the standings. Crossing the threshold and winning the chicken dinner in the same match does not count.
- The smash point is shown in the table footer once it is active.

---

## Themes and export

Three themes, switchable at any time and used for the downloaded image:

| Theme | Look |
|---|---|
| **Esports Amaze style (default)** | Clean light layout, purple accents, bold italic title |
| **Dark Blue & Orange** | Dark banner style inspired by BMIC graphics |
| **Beige Stripes** | Dark header with alternating beige rows, inspired by India Series graphics |

Every theme supports team logos, movement arrows, gold/silver/bronze rows, the smash tags, and tournament/organizer logos. Images are exported at 2x resolution.

---

## Saving and moving data

- Everything **auto-saves in your browser** (localStorage). There is no save button.
- On the home screen, **Save a copy** downloads all tournaments as a file and **Load a copy** restores them, on the same device or another one.
- A reminder on the home screen says the data lives on this device only.
- Tournaments saved by an earlier version still open: they get slot numbers in entry order and a lobby size of 4 players per team.
- All storage code lives in `src/storage.ts`, so a hosted backend (Firebase, Supabase) can replace it later without touching the rest of the app.

---

## Project structure

```
src/
  logic/standings.ts      standings, tiebreakers, movement, smash rule (pure functions)
  logic/standings.test.ts tests for the logic
  logic/entry.ts          entry checks (duplicate values, finish limit)
  logic/entry.test.ts     tests for the entry checks
  logic/tournament.ts     helpers (ids, initials, building matches)
  storage.ts              browser storage and Save/Load a copy
  presets.ts              points presets, defaults, theme list
  components/             Home, TournamentForm, ResultsEntry, Dashboard,
                          StandingsSheet (the exported table), TeamLogo
  styles.css              app styles and the three table themes
```

Built with React, TypeScript and Vite. Image export uses `html-to-image`.

---

## Decisions and assumptions

- Built as a **lean alternative** to feature-heavy apps like Pointcalc (AI screenshot reading, certificates, posters and hundreds of templates are out of scope).
- Default entry mode is **rank**: you type each team's placement and number of finishes, and the placement points come from the points table. Typing placement points directly is one switch away.
- The two similar Esports Amaze-style references are merged into one default theme. Their exact fonts, colors and spacing can be refined once more Esports Amaze screenshots are available.
- Match tables are sorted by match total, then chicken dinner, then finish points, then placement points.

## Future ideas

- Share link or QR code (a snapshot of the table)
- Cloud sync with login and a public live link (Firebase or Supabase)
- AI screenshot reading to fill in results
- Manual override for ties that cannot be resolved
- More games, more themes, elimination zone labels (for example "Bottom 16, Eliminated")
