
import * as logger from "firebase-functions/logger";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
