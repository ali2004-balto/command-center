# HANDOFF: putting the command center live

Do these in order. Each step says what to click. Nothing here is risky: every feature starts switched OFF.

## 1. Merge the code
1. Open the finished changes for this repository on GitHub (the branch `claude/balto-ops-command-center-jhpagi`).
2. Click **Compare & pull request**, then **Create pull request**.
3. Click **Merge pull request**, then **Confirm merge**.

## 2. Create the Feed sheet and the Bridge
1. In Google Drive click **New > Google Sheets > Blank spreadsheet**. Rename it to exactly `Command Center Feed`.
2. In that sheet click **Extensions > Apps Script**.
3. In the Apps Script editor click the gear icon (**Project Settings**) and tick **Show "appsscript.json" manifest file in editor**.
4. Click **Editor** (the `< >` icon). Open `Code.gs`, select everything, delete it, and paste the whole of `bridge/dist/Code.gs` from this repo.
5. Open `appsscript.json` in the file list, select everything, and paste the whole of `bridge/dist/appsscript.json`.
6. Click **Save project**.
7. In the function drop-down at the top choose `setup`, then click **Run**.
8. A permission screen appears. Click **Review permissions**, choose your account, then **Advanced > Go to (project) > Allow**. The three permissions are:
   - *See, edit, create and delete the spreadsheet this script is bound to*: so it can build the tabs and record your taps (it cannot touch any other spreadsheet).
   - *See your calendars*: so it can show today's meetings (read only).
   - *Allow this application to execute when you are not present*: so the 5 am clean-up can run by itself.
9. Back in the sheet, open the **TrackerMirror** tab. In cell A1 click **Allow access** (this lets the sheet read the Unit Turnover sheet; it never changes it).
10. Check that rows of turnover units appear in TrackerMirror.

## 3. Publish the Bridge as a web app
1. In Apps Script click **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
2. **Execute as: Me. Who has access: Anyone.** Click **Deploy**, approve if asked, and copy the **Web app URL**. That is `BRIDGE_URL`.
3. In the function drop-down choose `showSecrets` and click **Run**. Open **Execution log** and copy the three values: `BRIDGE_SECRET`, `TV_KEY`, `AUTH_SECRET`. Keep them private.

## 4. Google sign-in
1. Go to console.cloud.google.com and create a **new project**.
2. Open **Google Auth Platform** (older name: **OAuth consent screen**). Set **Audience** to **Internal** and fill in the app name.
3. Open **Clients > Create client > Web application**.
4. Under **Authorized redirect URIs** add `https://<your-app>.vercel.app/api/auth/callback/google` (replace `<your-app>` with your Vercel address).
5. Click **Create** and copy the **Client ID** (`AUTH_GOOGLE_ID`) and **Client secret** (`AUTH_GOOGLE_SECRET`).

## 5. Vercel
1. At vercel.com click **Add New > Project**, import this repository.
2. Under **Environment Variables** add these eight:
   - `BRIDGE_URL`: the web app URL from step 3.
   - `BRIDGE_SECRET`: from `showSecrets`.
   - `TV_KEY`: from `showSecrets`.
   - `AUTH_SECRET`: from `showSecrets`.
   - `AUTH_GOOGLE_ID`: from step 4.
   - `AUTH_GOOGLE_SECRET`: from step 4.
   - `ALLOWED_DOMAIN`: your company email domain, for example `yourcompany.com`.
   - `OWNER_EMAILS`: your own work email address.
   Do not add `BRIDGE_MODE`. Leave `APP_TIMEZONE` out unless you want a time zone other than Toronto.
3. Click **Deploy**.
4. If the address Vercel gave you differs from the one you used in step 4, go back to the Google client and fix the redirect URI to match.

## 6. First check
1. Open `https://<your-app>.vercel.app/settings` and sign in. In **Health**, check: mode is **Live**, Bridge is **reachable**, and the turnover copy shows a recent time.
2. On the TV browser open `https://<your-app>.vercel.app/tv?k=<TV_KEY>` once. It remembers the TV after that.

## 7. The morning run
1. In Claude create a **scheduled task** named `Command center: morning run`, **weekdays at 8:40 am**, model **Sonnet**.
2. Paste the whole text of `automations/morning-run.md` as the task.
3. Keep only these connectors: **Gmail, Google Calendar, Google Drive, Google Sheets, Claude Docs**.
4. Press **Run now** once. After a few minutes the board's "Done overnight" and project chips should fill in. Check them.

## 8. Switch features on, one at a time
Use **Settings > Switches** (tap the switch, then confirm). Look at the thing named before moving on.
1. `email_triage`: the next morning run sorts email. Look at "Needs you" for a day. Then pause the old "Daily Briefing" task.
2. `team_views`: open Settings > Views > Team > **Preview**. If it looks right press **Approve (set live)**.
3. `drafts`: the run writes draft replies. Open **Approvals** preview, check them, then **Approve (set live)**. Approve opens the draft in Gmail; you press Send there.
4. `send_on_approve`: only after your boss has approved it. Then:
   1. In Apps Script replace `Code.gs` with `bridge/dist-send/Code.gs` and `appsscript.json` with `bridge/dist-send/appsscript.json`.
   2. In the left bar click **Services (+)**, add **Gmail API**.
   3. Run `setup` again and approve the new permission (compose Gmail drafts and send them).
   4. **Deploy > Manage deployments**, click the pencil, set **Version: New version**, **Deploy**. The web app URL stays the same.
   5. Turn the `send_on_approve` switch on in Settings.

## 9. The conversation
In Claude open your Project and paste the whole of `claude/project-instructions.md` into the Project instructions.

## 10. Everyday care
- **STALE notice** (red pill on the TV or phone): the data is late. Open Settings > Health. If the morning run failed, press Run now on the scheduled task. If the turnover copy is old, open the Unit Turnover app and check it is saving.
- **Change the TV link**: change `TV_KEY` in Vercel (Settings > Environment Variables), redeploy, then open the new link on the TV.
- **Settings you can change by hand**: the **Config** tab of the Feed sheet (your name, which stages wait on you, how stale is too stale, the morning due time, project list, hide meeting titles on the TV, send limit).
- **Switch everything off**: turn off every switch in Settings; pause the scheduled task in Claude; in Apps Script click **Deploy > Manage deployments > Archive** to stop the web app.
