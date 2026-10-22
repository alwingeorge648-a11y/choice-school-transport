/**
 * Run only from a trusted local admin environment after configuring service-account credentials.
 * Never ship this script or its credentials inside the APK.
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json node scripts/seed-demo-users.mjs
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault() });
const auth = getAuth(), db = getFirestore();

const demos = [
  { email: "staff.demo@example.com", password: "StaffDemo#2026", name: "Demo Staff", role: "staff", department: "Administration" },
  { email: "hod.demo@example.com", password: "HodDemo#2026", name: "Demo HOD", role: "hod", department: "Administration" },
  { email: "facility.demo@example.com", password: "Facility#2026", name: "Demo Facility Manager", role: "facility_manager", department: "" },
  { email: "principal.demo@example.com", password: "Principal#2026", name: "Demo Principal", role: "principal", department: "" }
];
for (const d of demos) {
  let user;
  try { user = await auth.getUserByEmail(d.email); }
  catch { user = await auth.createUser({ email: d.email, password: d.password, displayName: d.name, disabled: false }); }
  await db.collection("users").doc(user.uid).set({
    name: d.name, email: d.email, role: d.role, department: d.department, active: true,
    createdAt: new Date().toISOString()
  }, { merge: true });
  console.log(`Provisioned ${d.role}: ${d.email} / ${d.password}`);
}
console.log("DEMO ONLY: change passwords and replace these accounts before production use.");