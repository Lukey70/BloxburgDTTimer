# Drive Thru Timer Website

This is the latest static GitHub Pages-ready version of the drive thru timer website.

## Included in this version

- Two separate lanes running up the right side of the map.
- Visual map layout matching the requested reference direction.
- Cars spawn two spaces before the speaker in Lane 1 or Lane 2.
- Cars move one space per second anywhere in the drive thru when the space ahead is clear.
- Order, Cash and Present only release when their button is pressed.
- If a station button is pressed while blocked, the car waits there and that section timer keeps counting until the car actually leaves.
- Lane 1 path after order: Order 1 -> 1 gap to Cash -> Cash.
- Lane 2 path after order: Order 2 -> 2 gap to Cash -> 1 gap to Cash -> Cash.
- One gap between Cash and Present.
- Cars leaving Present count as completed.
- The left-side averages and percentages update using completed cars only.
- Percentages are coloured as requested:
  - 75% to 100% = green
  - 50% to under 75% = yellow
  - under 50% = red
- Total target is 1:00.
- Every section target is 0:30.
- Car colours:
  - under 1:00 total = green
  - at 1:00 total = yellow
  - at 1:30 total = red
- Entry and threshold sound files are included in `assets/`.
- Enable Sounds / Test Sound button added to help with browser audio restrictions.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `simulation.mjs`
- `tests.mjs`
- `assets/`

## Keyboard shortcuts

- `1` = Add Car Lane 1
- `2` = Add Car Lane 2
- `Q` = Order 1 complete
- `W` = Order 2 complete
- `C` = Cash complete
- `P` = Present complete

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload everything in this folder.
3. Go to **Settings -> Pages**.
4. Choose **Deploy from a branch**.
5. Select the `main` branch and `/root`.
6. Save.

## Tests run before packaging

- JavaScript syntax check for `simulation.mjs`
- JavaScript syntax check for `app.js`
- Full simulation logic tests in `tests.mjs`
