# Two Lane Drive Thru Timer Website

This is a static GitHub Pages-ready drive thru timer dashboard.

## Version changes in this build

- Added two separate order lanes: Lane 1 and Lane 2.
- Added separate buttons to add cars to Lane 1 or Lane 2.
- Each car spawns two spaces before the speaker box.
- Cars automatically move forward one space every second if the next space is clear.
- If a car is in front, the car waits until the space opens.
- The order timer starts when the car reaches its lane speaker box.
- Lane 1 order time and Lane 2 order time are counted separately.
- Total time does not include order time.
- Total time starts only when the car leaves the order section.
- After order, both lanes join the shared cash/present lane.
- Cash and Present are completed manually using buttons.

## Controls

### Buttons

- Add Car Lane 1
- Add Car Lane 2
- Complete Lane 1 Order
- Complete Lane 2 Order
- Complete Cash
- Complete Present
- Reset Day

### Keyboard shortcuts

- `1` = Add car to Lane 1
- `2` = Add car to Lane 2
- `Q` = Complete Lane 1 order
- `W` = Complete Lane 2 order
- `C` = Complete cash
- `P` = Complete present

## How the timing works

### Before order

Cars are not included in total time before or during order.

### At speaker/order

The order timer starts when the car reaches the speaker box.

### After order

When you press **Complete Lane 1 Order** or **Complete Lane 2 Order**, the car leaves the order section and joins the shared lane. This is when total time starts.

### Cash and present

Cash and present are timed separately. Total time keeps counting until the car completes present.

## How to publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `README.md`
3. Go to **Settings** → **Pages**.
4. Choose **Deploy from a branch**.
5. Select the `main` branch and `/root`.
6. Save and wait for GitHub to provide the website URL.

## Future upgrades

This is still a front-end demo. A real restaurant system could later add:

- Real car sensor integration
- Camera/AI detection
- Manager login
- Daily reports
- Export to CSV
- Store settings
- Database storage using Firebase or Supabase
