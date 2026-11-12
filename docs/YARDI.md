# Yardi Voyager: not connected

Nothing in this system talks to Yardi today. These pieces are reserved so adding it later is small:

- The `yardi` switch in the Switches tab (off, and nothing reads it yet).
- The `Yardi` tab in the Feed sheet (one row: "Not connected. Reserved for Yardi Voyager data.").
- `src/lib/domain/yardi.ts`, whose `getYardiData()` returns `null`. The Settings page shows a greyed "Yardi Voyager: not connected" card.

## Realistic first step

Have Yardi produce a scheduled report and save it as a **spreadsheet in a Google Drive folder** (not an email). Then extend the morning run so that, when the `yardi` switch is on, it reads the newest file in that folder and writes a few summary rows into the `Yardi` tab. The screen app then reads that tab like any other, and `getYardiData()` returns real numbers.

## What will not work

A report that Yardi only sends **as an email attachment** cannot be read: the Gmail connector used by the morning run does not open attachments. Save the report to Drive instead.

Keep the rules of this system: read-only, short neutral text in the Feed, no tenant names or dollar amounts on the TV board.
