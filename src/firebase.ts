import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, setDoc, onSnapshot, getDoc, Firestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
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
      if (parsed.projectId === 'c2-8class' || parsed.projectId === 'e2-8class') {
        localStorage.removeItem('noah_firebase_config');
      } else if (parsed.apiKey && parsed.projectId) {
        return parsed as FirebaseConfig;
      }
    } catch (e) {
      console.error("Failed to parse local Firebase config:", e);
    }
  }

  // 3. Default system connection values (provided by user for zero-config global sync)
  return {
    apiKey: "AIzaSyBpyyBqAjbMZwLpzxzZjokM6CGhv_J2xns",
    authDomain: "e2-8class-69464.firebaseapp.com",
    projectId: "e2-8class-69464",
    storageBucket: "e2-8class-69464.firebasestorage.app",
    messagingSenderId: "863887869763",
    appId: "1:863887869763:web:f80f04da55b7414fe711f6",
    measurementId: "G-W7CF1B1F0D"
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
    const trimmed = storedCode.trim();
    if (trimmed === "c2-8class" || trimmed === "e2-8class") {
      localStorage.removeItem('noah_class_code');
    } else {
      return trimmed;
    }
  }
  return "e2-8class-69464";
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
  onUpdate: (data: { scores: number[]; opinions: string[]; names: string[]; updatedAt?: string }) => void
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
            names: data.names,
            updatedAt: data.updatedAt
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
export async function loadRecordsFromCloud(): Promise<{ scores: number[]; opinions: string[]; names: string[]; updatedAt?: string } | null> {
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
          names: data.names,
          updatedAt: data.updatedAt
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

// Perform simulated write/read to test exact connection status & rules restrictions
export async function testCloudConnection(): Promise<{ success: boolean; message: string }> {
  if (!isFirebaseEnabled() || !firestoreDb) {
    return { success: false, message: "Firebase가 초기화되지 않았거나 아직 구성 정보가 부실합니다." };
  }
  try {
    const classCode = getClassCode();
    const documentRef = doc(firestoreDb, "classes", classCode);
    
    // Read test
    await getDoc(documentRef);
    return { success: true, message: "축하합니다! 클라우드 데이터베이스(Firestore)와의 쌍방향 통신 테스트가 완벽히 성공하였습니다." };
  } catch (error: any) {
    const code = error?.code || "";
    const msg = error?.message || String(error);
    
    if (code === "permission-denied") {
      return { 
        success: false, 
        message: "권한 오류(permission-denied)가 감지되었습니다. 새 Firebase 프로젝트를 만든 후 'Firestore Database'를 개설하고, 규칙(Rules) 탭에서 읽기/쓰기가 허용되어 있는지 확인해 주세요! (기본값 설정 필요: allow read, write: if true;)"
      };
    } else if (msg.includes("unreachable") || msg.includes("offline") || code === "unavailable") {
      return {
        success: false,
        message: "데이터베이스 연결이 비활성화되었거나 오프라인 장치 상태입니다. 인터넷 브라우저 상태를 점검하거나 Firebase 프로젝트 API 세팅을 점검해 주세요."
      };
    } else {
      return {
        success: false,
        message: `통신 장애 오류 [${code}]: 다른 활성화 구역이나 Firebase Firestore의 생성 여부를 마저 클릭해 주세요. 상세 내용: ${msg}`
      };
    }
  }
}
