# Choice School Transport — Conveyance Facility Request

A responsive React + Firebase app for The Choice School, Thiruvalla. It implements the school's conveyance form and the approval route **Staff → HOD → Facility Manager → Principal**.

## Included
- Responsive sign-in and role-based dashboards
- Conveyance request form based on the supplied school spreadsheet:
  - Department, staff name, purpose
  - Required travel date, departure time and return time
  - Up to five destinations, passenger count, vehicle type, approximate distance and remarks
- Staff request history; HOD department queue; Facility Manager and Principal institution-wide visibility
- Server-side workflow enforcement via Firebase Cloud Functions
- Approval / rejection / return-for-changes with comments and history
- CSV export for approvers
- Android Capacitor wrapper configuration
- Firestore rules and demo-user provisioning script

## Important before use
This source project is not yet connected to a live Firebase project and no APK is prebuilt. You must configure Firebase, deploy the backend, create accounts and build/test the Android package. Demo passwords are for development only. Do not use demo credentials in production.

## 1. Prerequisites
Install:
- Node.js 20 LTS or later
- npm
- Firebase CLI: `npm install -g firebase-tools`
- Android Studio (current stable) and Android SDK
- A Google account with permission to create a Firebase project

## 2. Create and configure Firebase
1. Create a Firebase project in the Firebase Console.
2. Enable **Authentication → Email/Password**.
3. Create a **Cloud Firestore** database.
4. Register a Web app in Firebase project settings.
5. Copy `.env.example` to `.env` and replace each `VITE_FIREBASE_*` value with the Web app's Firebase config. Do not commit `.env`.
6. In `firebase.json`, keep the Firestore rules and Functions paths. This project uses the `asia-south1` region for callable functions.
7. In the Firebase console, ensure billing/plan requirements for Cloud Functions are met; deploy may require the Blaze plan.

## 3. Install and run the app
From this directory:
```bash
npm install
cp .env.example .env
# edit .env with your Firebase web-app values
npm run dev
```
Open the local URL printed by Vite. A real sign-in requires a provisioned account.

## 4. Deploy the secure backend
```bash
firebase login
firebase use --add
npm --prefix functions install
firebase deploy --only firestore:rules,firestore:indexes,functions
```
Cloud Functions are the only client-facing path for creating and changing requests. Firestore rules block direct request writes, and role documents are writable only by trusted Admin SDK code.

## 5. Provision demo accounts (development only)
Create a service-account key from Firebase Console → Project settings → Service accounts. Keep it outside this project and never put it in the APK or source control.
```bash
# Linux/macOS
export GOOGLE_APPLICATION_CREDENTIALS="/secure/path/service-account.json"
node scripts/seed-demo-users.mjs
```
The script creates these accounts (change all passwords before real use):
| Role | Email/login ID | Temporary password |
|---|---|---|
| Staff | `staff.demo@choiceschool.local` | `StaffDemo#2026` |
| HOD | `hod.demo@choiceschool.local` | `HodDemo#2026` |
| Facility Manager | `facility.demo@choiceschool.local` | `Facility#2026` |
| Principal | `principal.demo@choiceschool.local` | `Principal#2026` |

The Staff and HOD demo accounts are assigned to `Administration`. The HOD can only approve requests from the same department. For production, provision named school accounts and assign each HOD to the exact department they manage. Use a real school email domain if email delivery/reset is required.

## 6. Build the Android APK
Build the web app and add the Android wrapper:
```bash
npm run build
npx cap add android       # only the first time
npx cap sync android
npx cap open android
```
In Android Studio:
1. Wait for Gradle sync and install any SDK packages it requests.
2. Select **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. For a signed release, use **Build → Generate Signed Bundle / APK** and create a secure keystore. Keep the keystore and passwords private.
4. The debug APK is usually at `android/app/build/outputs/apk/debug/app-debug.apk`. The release APK is usually under `android/app/build/outputs/apk/release/` after a release build.
5. Install the debug APK on a test Android device, sign in using a provisioned account and test all four roles before distributing.

When changing frontend code, run `npm run build` then `npx cap sync android` again.

## 7. iPhone and tablet support
- Android phones/tablets: build and distribute the APK.
- iPhone/iPad: an APK cannot be installed on iOS. For quick internal use, host the responsive web app over HTTPS and use Safari → Share → Add to Home Screen. For a native iOS app, use a Mac with Xcode, run `npx cap add ios`, `npx cap sync ios`, then open the iOS project in Xcode and sign it for testing/distribution.
- Tablets and desktop browsers can use the same responsive web app.

## Security and production checklist
- Replace all demo accounts and passwords.
- Configure Firebase App Check, appropriate authentication restrictions and password policies.
- Review school data privacy obligations before storing staff or student information.
- Back up Firestore and set budget alerts.
- Configure email action links / password reset domain.
- Add an admin-only account management interface or use a controlled provisioning process.
- Add server-side notification delivery (email/push) if the school requires notifications; this starter currently provides live dashboard updates, but does not yet send push/email alerts.
- If staff may resubmit returned requests, review whether request fields should be editable in the resubmission form before production. Current starter resubmission reopens the request using the currently saved details.
- Test concurrency, department mappings and audit retention with school administrators.

## Data model
`users/{uid}`:
```json
{ "name": "Staff Name", "email": "staff@school.example", "role": "staff", "department": "Administration", "active": true }
```
`requests/{id}` stores request fields, destination array, `createdBy`, current status/stage and append-only-style approval records. The Cloud Functions own the workflow transitions.

## Workflow states
- `pending_hod` → HOD only, matching department
- `pending_facility` → Facility Manager only
- `pending_principal` → Principal only
- `approved` / `rejected` → completed
- `returned` → returned to staff for changes

## Current implementation notes
- This is a starter implementation intended for setup and validation, not a deployed school production service.
- Role setup and request transitions are enforced by the backend. The client UI is not a substitute for backend security.
- Uploading attachments, sending push notifications and an admin UI are not included in this first build.


## Phone-only build option with GitHub Actions
This repository includes `.github/workflows/android-apk.yml` so you can request an Android build from a phone using GitHub's hosted runner.

1. Create a private repository on GitHub in your mobile browser and upload the extracted project files (including hidden `.github` folder; if the browser makes that difficult, upload the ZIP to a repository using GitHub's upload interface or a desktop-mode browser).
2. Create a Firebase project and configure Authentication, Firestore and Cloud Functions as described above. Deploy backend rules/functions from a trusted environment.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add the six `VITE_FIREBASE_*` values from your Firebase Web app config as secrets with the exact names shown in the workflow.
4. Open **Actions → Build Choice School Transport APK → Run workflow**. Wait for the workflow to finish.
5. Open the completed workflow run, scroll to **Artifacts**, and download `choice-school-transport-debug-apk`. Extract the APK from the downloaded artifact ZIP and open it on Android. You may need to allow installation from your browser/file manager.
6. A debug APK is for testing, not official store distribution. Generate a signed release build before broad distribution.

The workflow creates a debug APK. Firebase Web configuration values are used by the client app; they are not privileged service-account credentials. Never store Firebase service-account keys or Android signing keystores in GitHub source. Use a private repository and review access carefully.
