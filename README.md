# Course to FIT

Turns a saved course (GPX or TCX, e.g. exported from Garmin Connect) into a FIT running activity that you can import into Garmin Connect. This lets you use a course with apps and services that only accept routes from recorded activities.

It runs entirely in your web browser on Mac or Windows. There is nothing to install and nothing is uploaded anywhere.

## How to use it

1. Download this repository: green **Code** button → **Download ZIP**, then unzip it.
2. Open `index.html` in Chrome, Edge, Safari or Firefox (double-click it). On Windows, unzip first rather than opening it from inside the ZIP.
3. Choose a course file. To get one, open the course in Garmin Connect, click the gear icon and choose **Export GPX** (or TCX).
4. Set the pace, start time and device, then click **Create FIT file**. In Chrome or Edge a Save window opens so you can choose the folder and file name. Safari and Firefox save to your Downloads folder instead, unless you turn on "Ask where to save" in the browser's download settings.
5. In Garmin Connect on the web, click the cloud icon → **Import Data** and choose the new `.fit` file.

## What the file contains

- One GPS point per second along the course, at a constant pace, with the course's elevation.
- Sport set to **running**, and the device set to the fēnix 8 model you choose (or the serial number you enter).
- Cadence (on by default) and, only if you tick **Include heart rate**, synthetic heart rate drifting gently between the start and finish values. Heart rate is **off by default**, so files don't contain it unless you ask for it.
- Lap, session and activity summaries: distance, time, ascent and descent.

## Effect on your Garmin metrics

An imported activity is treated like a real run. Deleting it afterwards fixes some things straight away, but not everything.

| Metric | Affected? | Does deleting the activity fix it? |
|---|---|---|
| Weekly / monthly distance and totals in Garmin Connect | Yes | Yes, straight away |
| Training Load, Training Status, recovery time | Yes, if heart rate is included and your watch syncs after the import | Not always. The watch may keep the load, which then ages out over about 4 weeks (acute load ~7 days, chronic ~28 days) |
| VO2 max estimate | Possibly, if heart rate is included | No. Your next real runs will correct it |
| Personal records | Unlikely at an easy pace | Not always recalculated; remove a record manually if needed |
| Strava | Yes, if auto-sync is on | No. Delete it in Strava as well |
| Apps connected to Garmin | Yes, that's usually the point | Deleting in Garmin may also remove it from those apps |

## How to prevent it

1. **Leave heart rate off.** It is unticked by default; only tick **Include heart rate** if you really need it. This is the most important step. Without heart rate the run adds little or nothing to Training Load and can't change VO2 max, so there is very little to undo.
2. **Use a slow pace.** The default is 17:04/km (27:28/mile), which is a 12-hour marathon, with a matching walking cadence of 105 steps per minute. That pace won't set records or count as a hard effort. Change it on the page if you want something else.
3. **Disconnect Strava before importing.** There is no pause button: in Garmin Connect go to **Settings → Connected Apps → Strava → Disconnect** (or in Strava, **Settings → My Apps → Garmin → Revoke Access**). Import the file, then reconnect. Garmin only sends activities recorded after you reconnect, so the import won't be sent later. Any real run you record while disconnected won't reach Strava automatically either, so do this in one go.
4. **Make it private.** A FIT file can't set privacy. Garmin applies your account default, so set **Account Settings → Privacy → Activities** to **Only Me** before importing if you want it hidden, and switch it back afterwards.
5. **Pick a past start time that doesn't overlap a real activity.** The default is yesterday at 06:00, so a 12-hour marathon finishes at about 18:00. Longer courses or slower paces finish later, so check the finish time shown on the page.
6. **Don't sync your watch until you've finished.** Import, let the app you're using pick up the run and check it's there, then delete the activity in Garmin before your watch next syncs. That gives the watch the least chance to take the activity's load.

## Connected apps

Whether a connected app picks up a manually imported activity depends on Garmin passing it on. If the activity never appears in that app's history, the file is not the problem.

## Files

- `index.html` – the whole app in one file: the page, course parsing and the FIT encoder. You can copy this single file anywhere and open it.
