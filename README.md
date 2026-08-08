# drawlonger

A Pinterest-style image board. Sign up, post images ("pins"), like and comment,
save things to boards, and follow other creators. Includes a full admin panel.

## What's built in

- **Accounts**: sign up / log in with hashed passwords (bcrypt), sessions via
  JWT in an httpOnly cookie.
- **Three seeded accounts** (created automatically the first time the server runs):
  | Username | Password | Role |
  |---|---|---|
  | `drawlonger` | `ilikecheese` | owner |
  | `hitarthsharma` | `wgoku` | admin |
  | `arrushvashistha` | `ilikefeet` | owner |

  All three start **verified** (blue checkmark). The two owner accounts can do
  everything admins can, plus promote/demote other admins.
- **Pins**: upload an image with a title/description, masonry feed, like,
  comment, save to a personal board.
- **Admin panel** (`/#/admin`, visible to admins/owners only):
  - Ban / unban any non-owner user (with an optional reason shown to them on login attempt)
  - Verify / unverify accounts (blue checkmark)
  - **Owners only**: promote a user to admin, or demote an admin back to a
    regular user
  - Change the site's **holiday theme** (Default / Halloween / Christmas /
    New Year / Valentine's / Summer) — this recolors the whole site and adds
    a light animated decoration layer (bats/pumpkins for Halloween, snow for
    Christmas, etc.)
  - Set a site-wide **banner message** (e.g. "Happy Halloween! 🎃")
  - Activity log of every admin action, who did it, and when

Owners can never be banned or demoted by another admin, so the two owner
accounts are always safe.

## Tech stack

- Backend: Node.js + Express
- Database: SQLite (`better-sqlite3`) — a single file, no separate DB server needed
- Auth: bcrypt password hashing + JWT cookies
- Image hosting: Cloudinary (falls back to local disk storage automatically
  if no Cloudinary keys are set, so it still works before you configure it —
  note local disk storage does **not** persist across Render deploys/restarts,
  so set up Cloudinary before going live for real)
- Frontend: plain HTML/CSS/JS, no build step, no framework

## Running locally

```bash
npm install
cp .env.example .env
# edit .env and fill in JWT_SECRET (and Cloudinary keys once you have them)
npm start
```

Then open `http://localhost:3000`.

The database file (`drawlonger.db`) is created automatically on first run,
along with the three seeded accounts above.

## Deploying to Render

1. **Push this folder to a GitHub repo** (if you haven't already):
   ```bash
   git init
   git add .
   git commit -m "drawlonger"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/drawlonger.git
   git push -u origin main
   ```
   Your `.gitignore` already excludes `.env`, `node_modules`, and the local
   database file, so none of that gets pushed.

2. **On Render**: New → Web Service → connect your GitHub repo.

3. Configure the service:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free is fine to start

4. **Environment variables** (Render dashboard → your service → Environment):
   | Key | Value |
   |---|---|
   | `JWT_SECRET` | any long random string (e.g. run `openssl rand -hex 32` locally and paste the result) |
   | `CLOUDINARY_CLOUD_NAME` | from your Cloudinary dashboard |
   | `CLOUDINARY_API_KEY` | from your Cloudinary dashboard |
   | `CLOUDINARY_API_SECRET` | from your Cloudinary dashboard |

   Render sets `PORT` automatically — you don't need to add it yourself.

5. Deploy. Render will give you a URL like `https://drawlonger.onrender.com`.

### Important: add a persistent disk for the database

Render's free web services have an **ephemeral filesystem** — anything written
to disk (like the SQLite database file) is wiped on every redeploy or restart.
To keep your users and pins permanently:

- Go to your service → **Disks** → Add Disk
- Mount path: `/opt/render/project/src` (or any path — just make sure it's
  where `drawlonger.db` actually gets created, which is the project root)
- Size: 1GB is plenty to start

Without this, the site works fine day-to-day, but a redeploy will reset
everyone's accounts back to just the three seeded ones. Cloudinary-hosted
images are unaffected either way since they don't live on Render's disk.

## Notes on the seeded passwords

The three passwords you gave me (`ilikecheese`, `wgoku`, `ilikefeet`) are
stored as bcrypt hashes in the database — never in plain text. That said,
they're still easy to guess if someone tries common phrases against the
login form. Once the site is live, it'd be worth having those three accounts
change their passwords to something less guessable (there's no in-app
"change password" flow yet — if you want one, that's a quick add).
