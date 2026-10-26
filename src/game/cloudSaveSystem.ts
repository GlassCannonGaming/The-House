/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  db,
  auth,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { Character, SmartObject } from './simulation';

export interface UserFolderSave {
  saveId: string;
  userId: string;
  slotName: string;
  folder: string;
  isAutoSave: boolean;
  timestamp: string;
  simHour: number;
  simDay: number;
  characterCount: number;
  characters: string; // JSON stringified characters
  objects: string; // JSON stringified smart objects
  mechanicsData: string; // JSON stringified mechanics & world metrics
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfileConfig {
  userId: string;
  displayName: string;
  email?: string;
  autoSaveEnabled: boolean;
  autoSaveIntervalSeconds: number;
  lastSavedSlot?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Listen to auth changes
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Save simulation state to Firestore under user folder system: /users/{userId}/saves/{saveId}
 */
export async function saveGameToCloud(
  userId: string,
  slotName: string,
  folder: string,
  isAutoSave: boolean,
  simHour: number,
  simDay: number,
  characters: Character[],
  objects: SmartObject[],
  mechanics: Record<string, any>
): Promise<string> {
  const saveId = isAutoSave ? `autosave_${slotName.replace(/\s+/g, '_').toLowerCase()}` : `save_${Date.now()}`;
  const savePath = `users/${userId}/saves/${saveId}`;

  const payload: UserFolderSave = {
    saveId,
    userId,
    slotName: slotName.trim() || (isAutoSave ? 'Auto-Save' : 'Manual Save'),
    folder: folder || (isAutoSave ? 'Autosaves' : 'My Saves'),
    isAutoSave: Boolean(isAutoSave),
    timestamp: new Date().toLocaleString(),
    simHour: Math.round(simHour * 10) / 10,
    simDay: Math.max(1, simDay),
    characterCount: characters.length,
    characters: JSON.stringify(characters),
    objects: JSON.stringify(objects),
    mechanicsData: JSON.stringify(mechanics),
    updatedAt: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, 'users', userId, 'saves', saveId);
    await setDoc(docRef, payload, { merge: true });
    return saveId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, savePath);
    throw error;
  }
}

/**
 * List all saved games for the current user, optionally filtered by folder
 */
export async function listUserSaves(userId: string): Promise<UserFolderSave[]> {
  const collectionPath = `users/${userId}/saves`;
  try {
    const savesRef = collection(db, 'users', userId, 'saves');
    const snapshot = await getDocs(savesRef);
    const saves: UserFolderSave[] = [];
    snapshot.forEach((docSnap) => {
      saves.push(docSnap.data() as UserFolderSave);
    });
    // Sort latest first
    saves.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return saves;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionPath);
    return [];
  }
}

/**
 * Delete a save slot
 */
export async function deleteUserSave(userId: string, saveId: string): Promise<void> {
  const savePath = `users/${userId}/saves/${saveId}`;
  try {
    const docRef = doc(db, 'users', userId, 'saves', saveId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, savePath);
    throw error;
  }
}

/**
 * Save user preferences & autosave settings
 */
export async function saveUserProfileConfig(
  userId: string,
  config: Partial<UserProfileConfig>
): Promise<void> {
  const configPath = `users/${userId}/profile/config`;
  try {
    const docRef = doc(db, 'users', userId, 'profile', 'config');
    await setDoc(
      docRef,
      {
        userId,
        displayName: auth.currentUser?.displayName || 'Simulator Resident',
        email: auth.currentUser?.email || '',
        autoSaveEnabled: config.autoSaveEnabled ?? true,
        autoSaveIntervalSeconds: config.autoSaveIntervalSeconds ?? 30,
        lastSavedSlot: config.lastSavedSlot || 'Default',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, configPath);
  }
}

/**
 * Load user preferences & autosave settings
 */
export async function loadUserProfileConfig(userId: string): Promise<UserProfileConfig | null> {
  const configPath = `users/${userId}/profile/config`;
  try {
    const docRef = doc(db, 'users', userId, 'profile', 'config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfileConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, configPath);
    return null;
  }
}
