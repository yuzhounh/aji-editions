import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { ChunkedWriteBatch } from "@/lib/firestore-batch";
import { resolveUniqueListName } from "@/lib/favorites-csv";

export const SHARED_LIST_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type SharedListRecord = {
  listName: string;
  journalIds: string[];
  ownerId: string;
  sourceEditionId: string;
  sourceEditionLabel: string;
  journalCount: number;
  createdAt: unknown;
  expiresAt: Timestamp;
  revoked: boolean;
};

export type SharedListStatus = "ok" | "not_found" | "revoked" | "expired";

export function getShareUrl(shareId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/share/${shareId}`;
  }
  return `/share/${shareId}`;
}

export function getSharedListStatus(data: SharedListRecord | null | undefined): SharedListStatus {
  if (!data) return "not_found";
  if (data.revoked) return "revoked";
  if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return "expired";
  return "ok";
}

export async function createSharedList(
  firestore: Firestore,
  ownerId: string,
  input: {
    listName: string;
    journalIds: string[];
    sourceEditionId: string;
    sourceEditionLabel: string;
  }
): Promise<string> {
  const shareId = uuidv4();
  const expiresAt = Timestamp.fromMillis(Date.now() + SHARED_LIST_TTL_MS);

  await setDoc(doc(firestore, "shared_lists", shareId), {
    listName: input.listName,
    journalIds: input.journalIds,
    ownerId,
    sourceEditionId: input.sourceEditionId,
    sourceEditionLabel: input.sourceEditionLabel,
    journalCount: input.journalIds.length,
    createdAt: serverTimestamp(),
    expiresAt,
    revoked: false,
  });

  return shareId;
}

export async function fetchSharedList(
  firestore: Firestore,
  shareId: string
): Promise<{ data: SharedListRecord | null; status: SharedListStatus }> {
  const snapshot = await getDoc(doc(firestore, "shared_lists", shareId));
  if (!snapshot.exists()) {
    return { data: null, status: "not_found" };
  }

  const data = snapshot.data() as SharedListRecord;
  const status = getSharedListStatus(data);
  return { data, status };
}

export async function revokeSharedList(
  firestore: Firestore,
  ownerId: string,
  shareId: string
): Promise<void> {
  const ref = doc(firestore, "shared_lists", shareId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;

  const data = snapshot.data() as SharedListRecord;
  if (data.ownerId !== ownerId) {
    throw new Error("Not authorized to revoke this share link.");
  }

  await updateDoc(ref, { revoked: true });
}

export async function importSharedListToUser(
  firestore: Firestore,
  userId: string,
  shared: SharedListRecord,
  validJournalIds: string[],
  existingListNames: string[]
): Promise<{ listName: string; imported: number; skipped: number }> {
  const existingNames = new Set(existingListNames);
  const listName = resolveUniqueListName(shared.listName, existingNames);
  const skipped = shared.journalIds.length - validJournalIds.length;

  const listRef = await addDoc(collection(firestore, `users/${userId}/journal_lists`), {
    name: listName,
    userId,
    createdAt: serverTimestamp(),
  });

  try {
    const batch = new ChunkedWriteBatch(firestore);
    for (const journalId of validJournalIds) {
      const favoriteId = `${journalId}_${listRef.id}`;
      await batch.set(doc(firestore, `users/${userId}/favorite_journals`, favoriteId), {
        journalId,
        userId,
        listId: listRef.id,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    await deleteDoc(listRef);
    throw error;
  }

  return { listName, imported: validJournalIds.length, skipped };
}
