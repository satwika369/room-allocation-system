Room Allotment System

A conflict-free room booking web app for hostel/room reallotment, built with Google Sheets + Google Apps Script. Replaces a chaotic shared Google Form (where entries got overwritten and multiple students ended up "booked" into the same room) with a live system where each room can only ever be booked once — safely, even if two people click at the exact same moment.


The Problem

Previously, room allotment was done via a Google Form listing room numbers, with students filling in their names as Occupant 1 / Occupant 2. Because a Form has no way to check "is this already taken?" in real time:


Multiple students overwrote each other's entries
The same room got claimed by more than one group
There was no live view of what was actually still available


The Fix

This app is a small reservation system (like booking a movie seat) instead of a shared editable list:


Rooms live in a Google Sheet, one tab per batch (PHD2025, MTECH2025, Batch2023, Batch2024, Batch2025)
The web app (built with Apps Script) shows only rooms that still have space
Every booking click runs through a lock → check → write sequence:

Lock this action so no one else can book at the exact same instant
Check if the room is still available
Only then mark it as booked



If two people click the same room within milliseconds of each other, one is confirmed and the other instantly sees "sorry, someone just took this" — no silent overwrites
Each room holds 2 occupants. A room shows as Available (0/2), Partially Booked (1/2, still visible so a second student can join), or Full (2/2, hidden from the list)
Only official college emails (@iitbhilai.ac.in) can complete a booking — checked both on the page and again on the server, so it can't be bypassed by editing the page



Tech Stack

LayerTechnologyFrontendHTML, CSS, vanilla JavaScriptBackendGoogle Apps Script (Code.gs)DatabaseGoogle Sheets (one tab per batch)Concurrency controlApps Script LockServiceHostingApps Script Web App deployment (free, no server needed)AuthDomain-restricted email validation (client + server side)


Project Structure

room-allotment/
├── Code.gs          # Backend: booking logic, locking, validation
├── index.html        # Frontend: 3-step wizard (email → batch → room)
├── RoomAllotment.xlsx # Starter spreadsheet template (rooms + statuses)
└── README.md


How It Works (Flow)


Step 1 — Email: Student enters their college email. Rejected immediately if the domain doesn't match.
Step 2 — Batch: Student picks their batch/program from a tappable grid.
Step 3 — Rooms: A scrollable, filterable list of rooms for that batch shows up, color-coded:

🟢 Green edge = 2 spots open
🟡 Amber edge = 1 spot left (join as a roommate)
Full rooms don't appear at all



Clicking a room and confirming runs the lock-check-write booking sequence.
A student can view and cancel their own booking at any time.



Setup Instructions

1. Create the Google Sheet


Import RoomAllotment.xlsx into a new Google Sheet (File → Import → Upload → Replace spreadsheet)
Verify each batch tab is named exactly: PHD2025, MTECH2025, Batch2023, Batch2024, Batch2025
Each tab has columns: RoomNo | Wing | Level | Status | Occupant1 | Occupant2 | Time1 | Time2


2. Add the Apps Script


In the Sheet: Extensions → Apps Script
Replace the default Code.gs with the one in this repo
Set ALLOWED_DOMAIN at the top to your college's email domain
Create a new HTML file named exactly index and paste in index.html


3. Deploy


Deploy → New deployment → Web app
Execute as: Me
Who has access: Anyone (or restrict to your organization domain if you want the page itself gated too — the booking is already gated by email domain either way)
Click Deploy, authorize when prompted, and copy the web app URL


4. Redeploying after changes

Any time you edit Code.gs or index.html:


Deploy → Manage deployments → pencil icon → Version: New version → Deploy
Editing code does not auto-update the live link — this step is required every time
