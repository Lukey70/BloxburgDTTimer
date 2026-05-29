# Drive Thru Timer Website

A static GitHub Pages-ready drive thru timer dashboard inspired by restaurant lane timer screens.

## What it does

- Adds cars to a simulated drive thru lane
- Moves cars through Order-1, Order-2, Cash, and Present
- Tracks live station timers
- Calculates average station times
- Calculates total lane time and car count
- Stores demo data in the browser using localStorage
- Works as a static website, so it can be hosted on GitHub Pages

## Keyboard shortcuts

- `A` = Add car
- `M` = Move next car
- `P` = Pull forward

## How to publish on GitHub Pages

1. Create a new GitHub repository, for example `drive-thru-timer`.
2. Upload these files to the repository:
   - `index.html`
   - `styles.css`
   - `script.js`
3. Go to **Settings** → **Pages**.
4. Under **Build and deployment**, set source to **Deploy from a branch**.
5. Select the `main` branch and `/root`, then save.
6. GitHub will give you a website link after it deploys.

## Next upgrades

This version is a front-end demo. To turn it into a real store system, you could add:

- Staff login
- Daily reports
- Export to CSV
- Real car sensor integration
- A backend database such as Firebase or Supabase
- Multiple lanes/stores
- Admin settings for service targets
