export const firebaseConfig = {
  "apiKey": "AIzaSyAK2ypYMOk_ckuFICJIpgEsRVc15g4VHlI",
  "authDomain": "academic-journal-index.firebaseapp.com",
  "projectId": "academic-journal-index",
  "storageBucket": "academic-journal-index.firebasestorage.app",
  "messagingSenderId": "201352930588",
  "appId": "1:201352930588:web:0b466cde9377d49c0bc6d9",
  "measurementId": ""
};

/** Named Firestore DB for this project (no `(default)` database exists). */
export const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ??
  "ai-studio-academicjournali-346789f8-f2d1-4924-813d-95393c434b5a";
