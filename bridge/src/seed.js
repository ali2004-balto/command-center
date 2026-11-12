// Seed rows written by setup() when absent. These are the real starting values for the owner's system.
var SEED = {
  Switches: [
    ['team_views', 'FALSE', 'Show the Team page with each employee\'s jobs.', '', ''],
    ['email_triage', 'FALSE', 'Let the morning run sort email and add items to Needs you.', '', ''],
    ['drafts', 'FALSE', 'Let the morning run write draft replies for you to approve.', '', ''],
    ['send_on_approve', 'FALSE', 'Let the Approve button send the draft itself (needs the send build).', '', ''],
    ['yardi', 'FALSE', 'Reserved for Yardi Voyager data. Not connected.', '', '']
  ],
  Views: [
    ['tv', 'live', '', ''],
    ['home', 'live', '', ''],
    ['team', 'preview', '', ''],
    ['approvals', 'preview', '', '']
  ],
  Config: [
    ['owner_name', 'Ali', 'Name shown in the greeting.'],
    ['timezone', 'America/Toronto', ''],
    ['my_stages', '2. Scope of work; 6. Leasing upload', 'Stages that are waiting on you, separated by semicolons.'],
    ['turnover_sheet_url', 'https://docs.google.com/spreadsheets/d/1czLrS6VfIPNP8lVxnF4NOZbU274tp5jFbsAysjSwvj0', 'Source of the turnover copy.'],
    ['turnover_tab', 'From the app', 'Tab name in the turnover sheet.'],
    ['turnover_stale_hours', '72', 'Hours before the turnover copy counts as stale.'],
    ['morning_due_time', '09:30', 'Morning run counts as late after this time.'],
    ['morning_days', '1,2,3,4,5', 'Run days, 1 = Monday.'],
    ['dd_window_days', '14', 'Due-diligence dates inside this many days show in Needs you.'],
    ['work_projects', 'Edmonton B Renos & Ops; Yellowknife; Regina; Decon; Acquisitions & Deals', 'Projects shown on the board, separated by semicolons.'],
    ['tv_show_event_titles', 'TRUE', 'FALSE shows "Busy" for meetings on the TV.'],
    ['max_sends_per_hour', '10', 'Send limit when send_on_approve is on.']
  ],
  Yardi: [['Not connected. Reserved for Yardi Voyager data.']]
};
