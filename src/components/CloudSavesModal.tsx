/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  Folder,
  FolderPlus,
  Save,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Sparkles,
  Download,
  Upload,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  UserFolderSave,
  signInWithGoogle,
  signOutUser,
  saveGameToCloud,
  listUserSaves,
  deleteUserSave,
  saveUserProfileConfig,
  loadUserProfileConfig,
} from '../game/cloudSaveSystem';
import { Character, SmartObject } from '../game/simulation';

interface CloudSavesModalProps {
  onClose: () => void;
  currentUser: User | null;
  characters: Character[];
  smartObjects: SmartObject[];
  gameSeconds: number;
  timeScale: number;
  funds: number;
  expansionLevel: number;
  onLoadSave: (save: UserFolderSave) => void;
  autoSaveInterval: number;
  onSetAutoSaveInterval: (intervalSeconds: number) => void;
  isDarkMode: boolean;
}

export const CloudSavesModal: React.FC<CloudSavesModalProps> = ({
  onClose,
  currentUser,
  characters,
  smartObjects,
  gameSeconds,
  timeScale,
  funds,
  expansionLevel,
  onLoadSave,
  autoSaveInterval,
  onSetAutoSaveInterval,
  isDarkMode,
}) => {
  const [saves, setSaves] = useState<UserFolderSave[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Folder navigation
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [customFolders, setCustomFolders] = useState<string[]>([
    'My Saves',
    'Autosaves',
    'Scenarios',
    'Backups',
  ]);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [showNewFolderInput, setShowNewFolderInput] = useState<boolean>(false);

  // New Save Slot Input
  const [slotNameInput, setSlotNameInput] = useState<string>('');

  // Auto-save toggle
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(autoSaveInterval > 0);

  // Load saves on mount or when user changes
  useEffect(() => {
    if (currentUser) {
      loadSavesList();
      loadUserProfile();
    }
  }, [currentUser]);

  const loadSavesList = async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listUserSaves(currentUser.uid);
      setSaves(data);

      // Collect any unique folders created
      const folderSet = new Set(customFolders);
      data.forEach((s) => {
        if (s.folder) folderSet.add(s.folder);
      });
      setCustomFolders(Array.from(folderSet));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to fetch cloud saves.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    if (!currentUser) return;
    const config = await loadUserProfileConfig(currentUser.uid);
    if (config) {
      setAutoSaveEnabled(config.autoSaveEnabled);
      if (config.autoSaveIntervalSeconds) {
        onSetAutoSaveInterval(config.autoSaveIntervalSeconds);
      }
    }
  };

  const handleSignIn = async () => {
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      setStatusMsg('Successfully signed in with Google!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In was cancelled or failed.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setSaves([]);
      setStatusMsg('Signed out.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign-out failed.');
    }
  };

  const handleCreateSave = async (folderToUse?: string) => {
    if (!currentUser) {
      setErrorMsg('Please sign in with Google to save your game to the cloud database.');
      return;
    }

    const folder = folderToUse || (selectedFolder === 'All' ? 'My Saves' : selectedFolder);
    const slotName = slotNameInput.trim() || `Save Slot ${saves.length + 1}`;

    const simHour = (gameSeconds % 86400) / 3600;
    const simDay = Math.floor(gameSeconds / 86400) + 1;

    setLoading(true);
    setErrorMsg(null);
    try {
      await saveGameToCloud(
        currentUser.uid,
        slotName,
        folder,
        false,
        simHour,
        simDay,
        characters,
        smartObjects,
        { funds, expansionLevel, gameSeconds, timeScale }
      );
      setSlotNameInput('');
      setStatusMsg(`Saved snapshot "${slotName}" to folder "${folder}"!`);
      setTimeout(() => setStatusMsg(null), 3500);
      await loadSavesList();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save to Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSave = async (saveId: string, name: string) => {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to delete save "${name}"?`)) return;

    setLoading(true);
    try {
      await deleteUserSave(currentUser.uid, saveId);
      setStatusMsg(`Deleted save "${name}".`);
      setTimeout(() => setStatusMsg(null), 2500);
      await loadSavesList();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete save slot.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (!customFolders.includes(trimmed)) {
      setCustomFolders([...customFolders, trimmed]);
      setSelectedFolder(trimmed);
    }
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleIntervalChange = async (seconds: number) => {
    onSetAutoSaveInterval(seconds);
    setAutoSaveEnabled(seconds > 0);
    if (currentUser) {
      await saveUserProfileConfig(currentUser.uid, {
        autoSaveEnabled: seconds > 0,
        autoSaveIntervalSeconds: seconds,
      });
    }
  };

  // Filter saves by folder
  const displayedSaves = saves.filter((s) => {
    if (selectedFolder === 'All') return true;
    return s.folder === selectedFolder;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl p-6 overflow-hidden max-h-[92vh] flex flex-col ${
          isDarkMode
            ? 'bg-gray-950 text-gray-100 border-indigo-900/80'
            : 'bg-white text-gray-900 border-gray-200'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Cloud Database & User Folder System</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Firestore Connected
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Persistent multi-slot storage, autosave timer, and folder hierarchy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                  </div>
                )}
                <span className="text-xs font-medium max-w-[120px] truncate">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1 hover:text-red-400 text-gray-400 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications / Alerts */}
        {statusMsg && (
          <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Grid: Left Folders Sidebar + Right Saves Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-4 gap-4 py-4 min-h-0">
          {/* Folders & Auto-Save Control Sidebar */}
          <div className="md:col-span-1 border-r border-gray-200 dark:border-gray-800 pr-3 space-y-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  User Folders
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                  className="text-indigo-500 hover:text-indigo-400 text-xs p-1 rounded"
                  title="Add Folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>

              {showNewFolderInput && (
                <div className="space-y-1.5 p-2 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                  <input
                    type="text"
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setShowNewFolderInput(false)}
                      className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddFolder}
                      className="px-2 py-0.5 text-[10px] rounded bg-indigo-600 text-white font-medium"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              {/* Folders List */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedFolder('All')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedFolder === 'All'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5" />
                    <span>All Saves</span>
                  </div>
                  <span className="text-[10px] opacity-75 font-mono">{saves.length}</span>
                </button>

                {customFolders.map((f) => {
                  const count = saves.filter((s) => s.folder === f).length;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSelectedFolder(f)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        selectedFolder === f
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{f}</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto-Save Interval Settings */}
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Auto-Save Loop
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    autoSaveInterval > 0
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {autoSaveInterval > 0 ? `Every ${autoSaveInterval}s` : 'Off'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                Saves simulation mechanics and active characters every X secs/mins to your folder.
              </p>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleIntervalChange(15)}
                  className={`px-2 py-1 text-[10px] rounded border font-medium ${
                    autoSaveInterval === 15
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  15 Seconds
                </button>
                <button
                  type="button"
                  onClick={() => handleIntervalChange(30)}
                  className={`px-2 py-1 text-[10px] rounded border font-medium ${
                    autoSaveInterval === 30
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  30 Seconds
                </button>
                <button
                  type="button"
                  onClick={() => handleIntervalChange(60)}
                  className={`px-2 py-1 text-[10px] rounded border font-medium ${
                    autoSaveInterval === 60
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  1 Minute
                </button>
                <button
                  type="button"
                  onClick={() => handleIntervalChange(120)}
                  className={`px-2 py-1 text-[10px] rounded border font-medium ${
                    autoSaveInterval === 120
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  2 Minutes
                </button>
                <button
                  type="button"
                  onClick={() => handleIntervalChange(300)}
                  className={`px-2 py-1 text-[10px] rounded border font-medium ${
                    autoSaveInterval === 300
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  5 Minutes
                </button>
                <button
                  type="button"
                  onClick={() => handleIntervalChange(0)}
                  className={`px-2 py-1 text-[10px] rounded border font-medium ${
                    autoSaveInterval === 0
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  Disabled
                </button>
              </div>
            </div>
          </div>

          {/* Right Main Panel: Save Creation & Saves List */}
          <div className="md:col-span-3 flex flex-col space-y-3 overflow-hidden">
            {/* Create Save Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder={`Save Slot Name (Folder: ${
                  selectedFolder === 'All' ? 'My Saves' : selectedFolder
                })...`}
                value={slotNameInput}
                onChange={(e) => setSlotNameInput(e.target.value)}
                className="flex-1 w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleCreateSave()}
                  disabled={loading}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateSave('Autosaves')}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition"
                  title="Quick Auto-Save Snapshot"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Quick Auto-Save</span>
                </button>
              </div>
            </div>

            {/* Saves Listing Header */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                Showing {displayedSaves.length} saves in{' '}
                <strong className="text-indigo-500">{selectedFolder}</strong>
              </span>
              <button
                onClick={loadSavesList}
                className="text-xs text-indigo-500 hover:text-indigo-400 hover:underline"
              >
                Refresh Cloud
              </button>
            </div>

            {/* Saves Grid/List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loading && saves.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400">
                  Connecting to Firestore database and loading user folders...
                </div>
              ) : displayedSaves.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-6 space-y-2">
                  <Folder className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-400">
                    {currentUser
                      ? `No saves found in folder "${selectedFolder}". Click "Save Snapshot" to store current game state.`
                      : 'Please Sign In with Google above to store and access your simulation saves in your personal cloud folder.'}
                  </p>
                </div>
              ) : (
                displayedSaves.map((save) => {
                  let parsedChars: Character[] = [];
                  try {
                    parsedChars = JSON.parse(save.characters);
                  } catch {
                    parsedChars = [];
                  }

                  return (
                    <div
                      key={save.saveId}
                      className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 hover:border-indigo-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate">{save.slotName}</span>
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            {save.folder || 'My Saves'}
                          </span>
                          {save.isAutoSave && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Autosave
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                          <span>📅 Day {save.simDay}</span>
                          <span>⏰ Hour {save.simHour.toFixed(1)}h</span>
                          <span>🕒 {save.timestamp}</span>
                          <span>👥 {save.characterCount} Residents</span>
                        </div>

                        {/* Character avatars preview */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {parsedChars.slice(0, 5).map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px]"
                              title={`${c.name} (${c.ageStage}) - Motives avg: ${(
                                (c.motives.hunger + c.motives.energy + c.motives.fun) /
                                30
                              ).toFixed(1)}/10`}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                              <span className="truncate max-w-[80px]">{c.name.split(' ')[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadSave(save);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Load</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSave(save.saveId, save.slotName)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          title="Delete save"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
