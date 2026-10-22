import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const ROLES = ["staff", "hod", "facility_manager", "principal"];
const clean = (v, max=500) => String(v ?? "").trim().slice(0, max);

async function actor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const snap = await db.collection("users").doc(request.auth.uid).get();
  if (!snap.exists || !ROLES.includes(snap.data().role) || snap.data().active === false) throw new HttpsError("permission-denied", "Account is not active or its role is not configured.");
  return { uid: request.auth.uid, ...snap.data() };
}

export const createConveyanceRequest = onCall(async (call) => {
  const u = await actor(call);
  if (u.role !== "staff") throw new HttpsError("permission-denied", "Only staff can submit requests.");
  const d = call.data || {};
  const department = clean(d.department, 120);
  const purpose = clean(d.purpose, 1000);
  const requesterName = clean(d.requesterName, 160);
  const requiredDate = clean(d.requiredDate, 20);
  const departureTime = clean(d.departureTime, 10);
  const returnTime = clean(d.returnTime, 10);
  if (!department || !purpose || !requesterName || !requiredDate || !departureTime || !returnTime)
    throw new HttpsError("invalid-argument", "Complete department, name, purpose, date and travel times.");
  if (u.department && u.department !== department) throw new HttpsError("permission-denied", "Your account is not assigned to this department.");
  const rawStops = Array.isArray(d.stops) ? d.stops.slice(0, 5) : [];
  if (!rawStops.length) throw new HttpsError("invalid-argument", "Add at least one destination.");
  const stops = rawStops.map((s) => ({
    place: clean(s.place, 200),
    passengers: Math.max(0, Math.min(500, Number(s.passengers) || 0)),
    vehicleType: clean(s.vehicleType, 80),
    distanceKm: Math.max(0, Math.min(10000, Number(s.distanceKm) || 0)),
    remarks: clean(s.remarks, 500)
  }));
  if (stops.some(s => !s.place || s.passengers < 1)) throw new HttpsError("invalid-argument", "Each destination needs a place and at least one passenger.");
  const ref = db.collection("requests").doc();
  const record = {
    requestNo: `CS-${new Date().getFullYear()}-${ref.id.slice(0,6).toUpperCase()}`,
    department, requesterName, purpose, requiredDate, departureTime, returnTime, stops,
    createdBy: u.uid, createdByEmail: u.email || "",
    createdAt: FieldValue.serverTimestamp(),
    status: "pending_hod", currentStage: "hod",
    approvals: [],
    lastActionAt: FieldValue.serverTimestamp()
  };
  await ref.set(record);
  return { id: ref.id, requestNo: record.requestNo };
});

export const decideConveyanceRequest = onCall(async (call) => {
  const u = await actor(call);
  if (!["hod", "facility_manager", "principal"].includes(u.role))
    throw new HttpsError("permission-denied", "Your role cannot approve requests.");
  const id = clean(call.data?.requestId, 150);
  const decision = clean(call.data?.decision, 20);
  const comment = clean(call.data?.comment, 1000);
  if (!id || !["approve", "reject", "return"].includes(decision))
    throw new HttpsError("invalid-argument", "Invalid request or decision.");
  const ref = db.collection("requests").doc(id);
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Request not found.");
    const r = snap.data();
    const expected = { pending_hod: "hod", pending_facility: "facility_manager", pending_principal: "principal" }[r.status];
    if (expected !== u.role) throw new HttpsError("failed-precondition", "This request is not awaiting your approval stage.");
    if (u.role === "hod" && u.department !== r.department) throw new HttpsError("permission-denied", "You can only review your own department's requests.");
    if (decision === "reject" && !comment) throw new HttpsError("invalid-argument", "Add a reason when rejecting.");
    const approval = { role: u.role, actorUid: u.uid, actorName: clean(u.name || u.email || u.role, 160), decision, comment, at: new Date().toISOString() };
    let status = r.status;
    let currentStage = r.currentStage;
    if (decision === "approve") {
      if (u.role === "hod") { status = "pending_facility"; currentStage = "facility_manager"; }
      else if (u.role === "facility_manager") { status = "pending_principal"; currentStage = "principal"; }
      else { status = "approved"; currentStage = "complete"; }
    } else if (decision === "reject") { status = "rejected"; currentStage = "complete"; }
    else { status = "returned"; currentStage = "staff"; }
    tx.update(ref, {
      status, currentStage,
      approvals: [...(r.approvals || []), approval],
      lastActionAt: FieldValue.serverTimestamp(),
      ...(decision === "return" ? { returnComment: comment } : {}),
      ...(decision === "reject" ? { rejectionReason: comment } : {})
    });
    return { status, requestNo: r.requestNo };
  });
  return result;
});

export const resubmitConveyanceRequest = onCall(async (call) => {
  const u = await actor(call);
  if (u.role !== "staff") throw new HttpsError("permission-denied", "Only staff can resubmit.");
  const id = clean(call.data?.requestId, 150);
  const d = call.data?.updates || {};
  const ref = db.collection("requests").doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Request not found.");
    const r = snap.data();
    if (r.createdBy !== u.uid || r.status !== "returned") throw new HttpsError("permission-denied", "Only the owner can resubmit a returned request.");
    const purpose = clean(d.purpose ?? r.purpose, 1000);
    const requiredDate = clean(d.requiredDate ?? r.requiredDate, 20);
    const departureTime = clean(d.departureTime ?? r.departureTime, 10);
    const returnTime = clean(d.returnTime ?? r.returnTime, 10);
    tx.update(ref, { purpose, requiredDate, departureTime, returnTime, status: "pending_hod", currentStage: "hod", lastActionAt: FieldValue.serverTimestamp(), resubmittedAt: FieldValue.serverTimestamp() });
  });
  return { status: "pending_hod" };
});