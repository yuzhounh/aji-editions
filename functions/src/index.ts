
import * as logger from "firebase-functions/logger";
import {onCall, HttpsError} from "firebase-functions/v2/onCall";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
