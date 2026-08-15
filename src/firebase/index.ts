'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, DocumentReference } from 'firebase/firestore'
import { addDocumentNonBlocking as originalAddDocumentNonBlocking } from './non-blocking-updates';

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
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

// Overload for addDocumentNonBlocking to accept a DocumentReference
export function addDocumentNonBlocking(docRef: DocumentReference, data: any): void;
export function addDocumentNonBlocking(colRef: any, data: any): any {
    if (docRef instanceof DocumentReference) {
        // This is a simplified version. The original non-blocking-updates
        // would need to be updated to handle setDoc with a DocumentReference.
        // For now, we'll just call the original implementation but it might not be perfect.
        // This is a stand-in for a proper implementation.
        const { setDocumentNonBlocking } = require('./non-blocking-updates');
        setDocumentNonBlocking(docRef, data, {});
        return;
    }
    return originalAddDocumentNonBlocking(colRef, data);
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

