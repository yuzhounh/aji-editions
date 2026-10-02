'use client';

import { firebaseConfig, firestoreDatabaseId } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, CollectionReference, DocumentData, DocumentReference } from 'firebase/firestore'
import { addDocumentNonBlocking as originalAddDocumentNonBlocking, setDocumentNonBlocking } from './non-blocking-updates';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (getApps().length) {
    // If already initialized, return the SDKs with the already initialized App
    return getSdks(getApp());
  }

  // Directly initialize with the config from config.ts, which uses the .env.local variable.
  // This ensures the correct API key is used in all environments.
  const firebaseApp = initializeApp(firebaseConfig);
  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {}, firestoreDatabaseId);
  } catch {
    firestore = getFirestore(firebaseApp, firestoreDatabaseId);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
  };
}

// Overload for addDocumentNonBlocking to accept a DocumentReference
export function addDocumentNonBlocking(docRef: DocumentReference, data: DocumentData): void;
export function addDocumentNonBlocking(colRef: CollectionReference, data: DocumentData): ReturnType<typeof originalAddDocumentNonBlocking>;
export function addDocumentNonBlocking(targetRef: DocumentReference | CollectionReference, data: DocumentData) {
    if (targetRef.type === 'document') {
        setDocumentNonBlocking(targetRef, data, {});
        return;
    }
    return originalAddDocumentNonBlocking(targetRef, data);
}


export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
// We export the original addDoc function with a different name to avoid conflicts.
export { originalAddDocumentNonBlocking };
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

