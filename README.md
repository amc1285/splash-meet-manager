# Splash Meet Manager

A free, open-source swim meet manager that runs entirely in your web browser. Run high-school dual meets, intrasquads and small invitationals: entries, heats and lanes, timing, scoring, printouts and a live scoreboard. No install, no server, no subscription.

**Use it:** once GitHub Pages is on, open `https://<your-username>.github.io/splash-meet-manager/`

## What it does

| Area | Features |
| --- | --- |
| Meet setup | NFHS high-school event order (girls & boys alternating, diving, breaks after diving and the 200 free relay), custom events, 4–10 lanes, SCY/SCM/LCM |
| Scoring | Dual 6-4-3-2-1 / 8-4-2, invitational and championship presets, custom points, max scorers per team, tie splitting, Varsity/JV scored separately (or JV as exhibition) |
| Rosters | Teams with colors, swimmers with grade and Varsity/JV, paste or upload a CSV |
| Entries | Coach-friendly lineup grid (type a seed time to enter), relays with four legs, exhibition swims, entry limit warnings (2 individual / 4 total by default), CSV entry import |
| Seeding | Fastest heat last, center-lane seeding, at least 3 swimmers in the first heat, scratches, manual heat/lane edits |
| Running the meet | Built-in running clock, tap-to-touch lane buttons (or keys 1–9), manual time entry, DQ / NS / DNF, diving scores, auto places and points |
| Reports | Psych sheet, heat sheet, timer sheets per lane, entries by team, timeline, results, award labels (30-up 1" × 2⅝" labels) |
| Live results | Projector scoreboard with running clock on the meet computer (no internet needed); free online fan page through GitHub |
| Data | Auto-saved in the browser, multiple meets, backup/restore file |

## Quick start

1. Open the app and choose **Load demo meet** to try it, or **Create meet**.
2. **Roster** – add teams and swimmers or paste a CSV (`first,last,gender,grade,team,division`; see `sample-roster.csv`).
3. **Entries** – pick a team, type seed times into the lineup grid, and build relays.
4. **Heats** – **Seed all events**, then print the heat sheet and timer sheets from **Reports**.
5. **Run** – press **Start** (or Space) at the horn, tap **Touch** per lane (or press the lane number), fix times from the timers' watches if needed, then **Save heat & next** (or Enter).
6. **Results** – team scores update live. Print results and award labels from **Reports**.

> Your meet is saved in the browser on that computer. Use **Meet → Download backup** before and after the meet.

## Live results for fans (free)

Splash can publish a small results file to your GitHub repository after every heat; the public `live.html` page reads it and refreshes every minute.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Repository access: **Only select repositories** → this repository. Permissions: **Contents: Read and write**.
3. In Splash, open the **Live** tab, enter your username, repository name and token, and save. Copy the fan link or show the QR code.

Results are written to a separate `live-results` branch so they don't rebuild your site. The token is stored only in that browser — use **Forget token** after the meet on shared computers.

For a scoreboard at the pool with no internet, use **Live → Open scoreboard / Big projector view** on the meet computer.

## Host your own copy

1. Fork or copy this repository.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. Open the URL GitHub shows. Everything is static HTML, CSS and JavaScript — you can also just double-click `index.html` to run it offline.

## Files

- `index.html`, `app.js`, `style.css` – the meet console
- `core.js` – times, seeding, scoring, timeline and CSV logic (also runs in Node for testing)
- `live.html` – fan / projector results page
- `sample-roster.csv` – example roster import

## Not included (yet)

Hardware touchpad/timing-console connections, Hy-Tek file import/export, prelims/finals, online entry fees and multi-person live editing. Pull requests welcome.

## License

MIT. Splash Meet Manager is an independent project and is not affiliated with any commercial meet-management product.
