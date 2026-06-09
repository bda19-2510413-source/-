import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, setDoc, onSnapshot, getDoc, Firestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Check if valid config exists in environment keys or localStorage
export function getStoredFirebaseConfig(): FirebaseConfig | null {
  // 1. Try to read from environment variables (useful for pre-configured Vercel/GitHub Pages deployments)
  const metaEnv = (import.meta as any).env;
  const envKey = metaEnv?.VITE_FIREBASE_API_KEY;
  if (envKey && envKey.trim() !== "") {
    return {
      apiKey: envKey,
      authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "",
      projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "",
      storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: metaEnv.VITE_FIREBASE_APP_ID || "",
    };
  }

  // 2. Try to read from local storage (for dynamic user customization)
  const localConfigStr = localStorage.getItem('noah_firebase_config');
  if (localConfigStr) {
    try {
      const parsed = JSON.parse(localConfigStr);
      if (parsed.apiKey && parsed.projectId) {
        return parsed as FirebaseConfig;
      }
    } catch (e) {
      console.error("Failed to parse local Firebase config:", e);
    }
  }

  // 3. Default system connection values (provided by user for zero-config global sync)
  return {
    apiKey: "AIzaSyCpjiht5MHfdN5JgHjyJ561sMQovQwnisM",
    authDomain: "c2-8class.firebaseapp.com",
    projectId: "c2-8class",
    storageBucket: "c2-8class.appspot.com",
    messagingSenderId: "652780236309",
    appId: "1:652780236309:web:97fb8a64afdc28a4d1281c"
  };
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

// Initialize Firebase dynamically based on the current configuration
export function initializeFirebase(): boolean {
  const config = getStoredFirebaseConfig();
  if (!config) {
    firebaseApp = null;
    firestoreDb = null;
    return false;
  }

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }
    
    // Safely attempt initializeFirestore first with force long polling enabled
    try {
      firestoreDb = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
      });
      console.log("Firebase & Firestore initialized with Long Polling successfully!");
    } catch (e) {
      // If already initialized, get the existing occurrence
      firestoreDb = getFirestore(firebaseApp);
      console.log("Firestore retrieved existing instance.");
    }
    return true;
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    firebaseApp = null;
    firestoreDb = null;
    return false;
  }
}

// Get the unique class code for document sync to support multiple classrooms or simple room codes
export function getClassCode(): string {
  const storedCode = localStorage.getItem('noah_class_code');
  if (storedCode && storedCode.trim() !== "") {
    return storedCode.trim();
  }
  return "c2-8class";
}

export function setClassCode(code: string) {
  localStorage.setItem('noah_class_code', code.trim().toLowerCase());
}

// Check if Cloud database is enabled
export function isFirebaseEnabled(): boolean {
  if (!firestoreDb) {
    initializeFirebase();
  }
  return firestoreDb !== null;
}

// Save records to Cloud Firestore (Atomic single-document model to minimize write quotas)
export async function saveRecordsToCloud(
  scores: number[],
  opinions: string[],
  names: string[]
): Promise<boolean> {
  if (!isFirebaseEnabled() || !firestoreDb) return false;

  const classCode = getClassCode();
  try {
    const documentRef = doc(firestoreDb, "classes", classCode);
    await setDoc(documentRef, {
      scores,
      opinions,
      names,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (error: any) {
    const isOffline = error?.message?.includes('offline') || error?.code === 'unavailable';
    if (isOffline) {
      console.log("Firestore cloud database is currently offline or unreachable. Saving locally first.");
    } else {
      console.warn("Failed to save records to Firebase cloud:", error);
    }
    return false;
  }
}

// Subscription setup for real-time live synchronization (No manual refreshing required!)
export function setupCloudSyncListener(
  onUpdate: (data: { scores: number[]; opinions: string[]; names: string[] }) => void
): (() => void) | null {
  if (!isFirebaseEnabled() || !firestoreDb) return null;

  const classCode = getClassCode();
  try {
    const documentRef = doc(firestoreDb, "classes", classCode);
    
    // Set up standard realtime listener
    const unsubscribe = onSnapshot(documentRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.scores && data.opinions && data.names) {
          onUpdate({
            scores: data.scores,
            opinions: data.opinions,
            names: data.names
          });
        }
      }
    }, (error) => {
      console.warn("Firestore listener failed or permission denied:", error);
    });

    return unsubscribe;
  } catch (err: any) {
    console.warn("Failed to bind live Cloud Sync listener:", err?.message || err);
    return null;
  }
}

// One-time load from Cloud
export async function loadRecordsFromCloud(): Promise<{ scores: number[]; opinions: string[]; names: string[] } | null> {
  if (!isFirebaseEnabled() || !firestoreDb) return null;

  const classCode = getClassCode();
  try {
    const documentRef = doc(firestoreDb, "classes", classCode);
    const docSnap = await getDoc(documentRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.scores && data.opinions && data.names) {
        return {
          scores: data.scores,
          opinions: data.opinions,
          names: data.names
        };
      }
    }
  } catch (err: any) {
    const isOffline = err?.message?.includes('offline') || err?.code === 'unavailable';
    if (isOffline) {
      console.log("Firestore client is offline. Falling back to local values gracefully.");
    } else {
      console.warn("Failed one-time fetch from Cloud:", err?.message || err);
    }
  }
  return null;
}
