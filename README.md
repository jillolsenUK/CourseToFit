# Course to FIT

Turns a saved course (GPX or TCX, e.g. exported from Garmin Connect) into a FIT running activity that you can import into Garmin Connect. This lets you use a course with apps and services that only accept routes from recorded activities.

It runs entirely in your web browser on Mac or Windows. There is nothing to install and nothing is uploaded anywhere.

## How to use it

1. Download this repository: green **Code** button → **Download ZIP**, then unzip it.
2. Open `index.html` in Chrome, Edge, Safari or Firefox (double-click it).
3. Choose a course file. To get one, open the course in Garmin Connect, click the gear icon and choose **Export GPX** (or TCX).
4. Set the pace, start time and device, then click **Create FIT file**.
5. In Garmin Connect on the web, click the cloud icon → **Import Data** and choose the new `.fit` file.

## What the file contains

- One GPS point per second along the course, at a constant pace, with the course's elevation.
- Sport set to **running**, and the device set to the fēnix 8 model you choose (or the serial number you enter).
- Optional synthetic heart rate (drifting gently between the start and finish values) and cadence.
- Lap, session and activity summaries: distance, time, ascent and descent.

## Things to know

- **Training stats:** Garmin will count the activity toward mileage. If heart rate is included, it also feeds Training Load and recovery time. Turn heart rate off, or delete the activity after you've used it.
- **Sharing:** Pause Strava auto-sync or make the activity private if you don't want it to appear in feeds.
- **Start time:** Pick a time that doesn't overlap a real activity.
- **Connected apps:** Whether a connected app picks up a manually imported activity depends on Garmin passing it on. If the activity never appears in that app's history, the file is not the problem.

## Files

- `index.html` – the app.
- `coursetofit.js` – course parsing and the FIT encoder (no dependencies; also works in Node).
