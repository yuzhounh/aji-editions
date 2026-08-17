import {
  DocumentData,
  DocumentReference,
  Firestore,
  SetOptions,
  WriteBatch,
  writeBatch,
} from "firebase/firestore";

export const FIRESTORE_BATCH_LIMIT = 500;

/** Commits Firestore writes in chunks of 500 operations. */
export class ChunkedWriteBatch {
  private firestore: Firestore;
  private batch: WriteBatch;
  private opCount = 0;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.batch = writeBatch(firestore);
  }

  async delete(ref: DocumentReference): Promise<void> {
    this.batch.delete(ref);
    this.opCount++;
    await this.flushIfFull();
  }

  async set<T extends DocumentData>(
    ref: DocumentReference<T>,
    data: T,
    options?: SetOptions
  ): Promise<void> {
    if (options) {
      this.batch.set(ref, data, options);
    } else {
      this.batch.set(ref, data);
    }
    this.opCount++;
    await this.flushIfFull();
  }

  private async flushIfFull(): Promise<void> {
    if (this.opCount >= FIRESTORE_BATCH_LIMIT) {
      await this.commit();
    }
  }

  async commit(): Promise<void> {
    if (this.opCount === 0) return;
    await this.batch.commit();
    this.batch = writeBatch(this.firestore);
    this.opCount = 0;
  }
}

export async function deleteRefsInBatches(
  firestore: Firestore,
  refs: DocumentReference[]
): Promise<void> {
  const batch = new ChunkedWriteBatch(firestore);
  for (const ref of refs) {
    await batch.delete(ref);
  }
  await batch.commit();
}
