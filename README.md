# Drive Thru Timer Website - Next Version

This is a static GitHub Pages-ready website for a two-lane drive-thru timer.

## Included changes

- Visual map-style drive-thru layout so cars can be seen moving through the route.
- Two separate entry lanes: Lane 1 and Lane 2.
- Cars spawn two spaces before their speaker/order box.
- Cars move forward one space per second whenever the space ahead is clear.
- Cars at Order, Cash and Present do not leave until the matching button is pressed.
- If the button is pressed and the path ahead is blocked, the car is marked ready and automatically moves when clear.
- Lane 1 has a one-space gap between Order 1 and Cash.
- Lane 2 has a two-space gap between Order 2 and Cash.
- There is a one-space gap between Cash and Present.
- The car that completed ordering first gets priority at the merge into Cash.
- Cars leaving Present are counted as completed cars.
- Order time does not count toward total time.
- Total time starts when the car leaves Order.
- Left-side averages only update after a car leaves the drive-thru.
- Percentages show the percentage of completed cars under target for that point.
- All station targets are 30 seconds.
- Total target is 1 minute.
- Cars turn yellow after total time reaches 1 minute.
- Cars turn red after total time reaches 1 minute 30 seconds.
- Lane 1 entry plays `A Bass.wav`.
- Lane 2 entry plays `Pre-Warn.mp3`.
- Yellow threshold plays `SOUND181 (1).wav` once per car.
- Red threshold plays `SOUND136.wav` twice back-to-back once per car.

## Controls

- **Add Car Lane 1**: adds a car to Lane 1 and plays the Lane 1 entry sound.
- **Add Car Lane 2**: adds a car to Lane 2 and plays the Lane 2 entry sound.
- **Complete Order 1**: releases the car at Order 1 when the path is clear.
- **Complete Order 2**: releases the car at Order 2 when the path is clear.
- **Complete Cash**: releases the car at Cash when the path to the Cash/Present gap is clear.
- **Complete Present**: releases the car from Present and counts it as completed.

## Keyboard shortcuts

- `1` = Add Car Lane 1
- `2` = Add Car Lane 2
- `Q` = Complete Order 1
- `W` = Complete Order 2
- `C` = Complete Cash
- `P` = Complete Present

## GitHub Pages upload

Upload all files and folders from this ZIP to your GitHub repository:

- `index.html`
- `styles.css`
- `simulation.js`
- `script.js`
- `assets/`
- `tests/` is optional but useful for development checks

Then go to **Settings → Pages → Deploy from branch → main → /root**.

## Testing

Automated tests are included in `tests/simulation.test.js`. They can be run locally with:

```bash
node tests/simulation.test.js
```
