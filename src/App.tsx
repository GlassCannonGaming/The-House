/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Viewport3D } from './components/Viewport3D';
import { BottomDock } from './components/BottomDock';
import { CharacterInspector } from './components/CharacterInspector';
import { CharacterCreatorModal } from './components/CharacterCreatorModal';
import { HouseChatbotModal } from './components/HouseChatbotModal';
import { AssetStudioModal } from './components/AssetStudioModal';
import { ScenarioModal } from './components/ScenarioModal';
import { MobileSimulatorView } from './components/MobileSimulatorView';
import { SimsWorldBuilderHUD } from './components/SimsWorldBuilderHUD';
import {
  BuildingPartDefinition,
  BuildToolMode,
  WorldBlueprint,
  WORLD_BUILDER_CATALOG,
  createEmptyGridBlueprint,
  placeBuildingPartOnGrid,
  removeBuildingPartAtPosition,
  generateProceduralBlueprintFromPrompt,
} from './game/worldBuilder';
import {
  Character,
  SmartObject,
  Scenario,
  MaturityRating,
  AppDisplayMode,
  BasicNeedKey,
  HouseholdLegacyMilestone,
  PRESET_SCENARIOS,
  DEFAULT_SMART_OBJECTS,
  calculateGameTime,
  formatGameTime,
  simulateOfflineHistory,
  evaluateSurroundingsInfluence,
  getInteractionApproachPoint,
  resolveFurnitureCollision,
  getDisplayModeCapabilities,
  resolveDisplayModeTransition,
  buildAutonomousLifeFlowQueue,
  enqueueSmartObjectInteraction,
  removeScheduledInteraction,
  promoteScheduledInteraction,
  dequeueNextScheduledInteraction,
  resolveNonToonObjectPlacement,
  declipAllSmartObjects,
  advanceWorldLifeAndMortalityCycle,
  createInitialToonKnowledgebase,
  ingestNewspaperAndBookKnowledge,
  getIntelligenceEfficiencyMultiplier,
  createInitialLifeExperienceTracker,
  recordLifeExperienceActivity,
  createInitialDailyAspirationsState,
  generateDailyAspirationsForCharacter,
  evaluateDailyAspirationProgress,
  tickDailyAspirationsAndBoosts,
  doesActivityMatchDailyAspiration,
  motivesToBasicNeeds1To10,
  depleteBasicNeeds1To10,
  fulfillBasicNeedWithAction,
  getRequiredObjectForBasicNeed,
  createInitialSkillTree,
  advanceCharacterSkillFromAction,
  updateRelationshipBetweenToons,
  createInitialRelationshipsForCharacter,
  canHaveBabyTogether,
  haveBabyBetweenToons,
  evaluateCharacterMoodletsAndEmotion,
  createInitialHouseholdLegacyMilestones,
  evaluateHouseholdLegacyMilestones,
  ensurePersonalBedsForAllToons,
} from './game/simulation';
import { WallCutawayMode, WeatherCondition } from './game/sceneBuilder';
import { HomeLayoutPreset } from './AgentArtClass/AgentArtPipeline';
import { sound } from './game/soundSynth';
import {
  evaluateBuilderAutonomousActions,
  executeToonBuildStory,
  getDiverseContextualSelfTalk,
  selectVariedAutonomousObject,
  learnFromMediaObject,
  getCharacterCareerInfo,
  generateMultiToonConversation,
  HouseEvent,
} from './game/builderAgent';
import {
  HouseCrossWorldMemory,
  HouseInteractiveEvent,
  FloorLevel,
  EntityPersuasionResult,
  loadHouseMemoryFromStorage,
  saveHouseMemoryToStorage,
  recordWorldInHouseMemory,
  shouldSpawnAutonomousHouseEvent,
  executeAutonomousHouseEvent,
  evaluateEntityPersuasionRequest,
} from './game/houseAgent';
import {
  subscribeToAuth,
  saveGameToCloud,
} from './game/cloudSaveSystem';
import { User as FirebaseUser } from 'firebase/auth';
import {
  CloudRain,
  Sun,
  CloudSnow,
  CloudLightning,
  Cloud,
  Eye,
  Newspaper,
  Music,
  Mic,
  Brain,
  Zap,
  Skull,
} from 'lucide-react';

interface LiveWeatherState {
  condition: WeatherCondition;
  tempF: number;
  windMph: number;
  description: string;
}

interface NewspaperEdition {
  masthead: string;
  headline: string;
  summary: string;
  sources: Array<{ title: string; uri: string }>;
  readerName: string;
}

export default function App() {
  // World Maturity Setting
  const [maturity, setMaturity] = useState<MaturityRating>('FAMILY_FRIENDLY');
  const isDarkMode = maturity === 'DARK_MODE';

  // Game Clock (Default 1x Real-Life Pacing: 1 real second = 1 in-game second for authentic background life simulation)
  const [gameSeconds, setGameSeconds] = useState<number>(8 * 3600); // 08:00 AM Day 1
  const [timeScale, setTimeScale] = useState<number>(1.0);

  // Household Savings & Multi-Story Architecture Expansion (Upstairs Loft + Subterranean Basement available across levels)
  const [funds, setFunds] = useState<number>(3600);
  const [expansionLevel, setExpansionLevel] = useState<number>(2);
  const [hasBasement, setHasBasement] = useState<boolean>(true);
  const [activeFloor, setActiveFloor] = useState<FloorLevel>('MAIN');
  const hasUpstairs = expansionLevel >= 2;
  const [activeEvent, setActiveEvent] = useState<HouseEvent | null>(null);

  // Home Styling: Wallpapers, Carpets, and Error-Free Open-Concept Wall Layouts
  const [roomWallpapers, setRoomWallpapers] = useState<Record<string, string>>({
    LivingRoom: 'wp_classic_wainscot',
    Kitchen: 'wp_terracotta_venetian',
    Bedroom: 'wp_botanical_sage',
    Bathroom: 'wp_classic_wainscot',
    Study: 'wp_midcentury_teak',
  });
  const [roomCarpets, setRoomCarpets] = useState<Record<string, string>>({
    LivingRoom: 'fl_honey_oak',
    Kitchen: 'fl_checker_marble',
    Bedroom: 'fl_plush_berber',
    Bathroom: 'fl_checker_marble',
    Study: 'fl_mahogany_herringbone',
    Hallway: 'fl_slate_flagstone',
  });
  const [openConceptKitchen, setOpenConceptKitchen] = useState<boolean>(false);
  const [openConceptLiving, setOpenConceptLiving] = useState<boolean>(false);

  // Real-World Weather System (/api/weather)
  const [weather, setWeather] = useState<LiveWeatherState>({
    condition: 'CLEAR',
    tempF: 72,
    windMph: 5,
    description: 'Clear Suburban Skies',
  });

  // In-Game Grounded Newspaper Edition (/api/newspaper)
  const [newspaperEdition, setNewspaperEdition] = useState<NewspaperEdition | null>(null);
  const lastDeliveredNewspaperDayRef = useRef<number>(0);

  // First-Person Viewpoint Mode ("Along for the Ride" - Zero User Control)
  const [firstPersonCharId, setFirstPersonCharId] = useState<string | null>(null);

  // Smart Objects & Characters State (Authentic real-life task durations, career setup, 1-to-1 personal beds & collision-resolved positions)
  const [initialHousehold] = useState(() => {
    const placedChars: Character[] = [];
    const initialStarterObjects = ['obj_stove', 'obj_easel', 'obj_tv'];
    PRESET_SCENARIOS[0].characters.forEach((c, idx) => {
      const career = getCharacterCareerInfo(c);
      const starterObjId = initialStarterObjects[idx % initialStarterObjects.length];
      const starterObj = DEFAULT_SMART_OBJECTS.find((o) => o.id === starterObjId);
      const approach = starterObj
        ? getInteractionApproachPoint(starterObj, idx)
        : { pos: c.pos, lookAtPos: { x: 0, y: 0, z: 0 } };
      const safePos = resolveFurnitureCollision(
        approach.pos,
        DEFAULT_SMART_OBJECTS,
        starterObj?.id,
        placedChars,
        c.id
      );
      const initialized: Character = {
        ...c,
        room: starterObj ? starterObj.room : c.room,
        activeObjectId: starterObj?.id,
        pos: { x: safePos.x, y: approach.pos.y, z: safePos.z },
        lookAtPos: { ...approach.lookAtPos },
        actionTimer: starterObj ? Math.max(7200, starterObj.durationSeconds) : 7200,
        currentAction: starterObj ? starterObj.actionLabel : 'Relaxing at home',
        selfTalk:
          idx === 0
            ? 'Taking my time simmering a slow homemade sauce from scratch.'
            : idx === 1
            ? 'Spending the next three hours layering oil glazes on this canvas.'
            : 'Settling into the couch to watch a three-hour documentary marathon on TV.',
        recentObjectIds: starterObj ? [starterObj.id] : [],
        learnedTopics: [
          'Mid-Century architectural restoration',
          'Neighborhood culinary traditions',
        ],
        careerTitle: career.careerTitle,
        dailySalary: career.dailySalary,
        lastWorkDay: 0,
        isAtWork: false,
      };
      const initKb = createInitialToonKnowledgebase(initialized);
      initialized.knowledgebase = initKb;
      initialized.intelligenceScore = initKb.intelligenceScore;
      initialized.basicNeeds = motivesToBasicNeeds1To10(initialized.motives);
      initialized.skillTree = createInitialSkillTree(initialized);
      const initMood = evaluateCharacterMoodletsAndEmotion(
        initialized,
        DEFAULT_SMART_OBJECTS
      );
      initialized.emotionalState = initMood.emotionalState;
      initialized.activeMoodlets = initMood.activeMoodlets;
      initialized.lifeExperience = createInitialLifeExperienceTracker(initialized);
      initialized.dailyAspirations = createInitialDailyAspirationsState(
        initialized,
        1,
        DEFAULT_SMART_OBJECTS
      );
      const starterBook = initKb.booksRead[0];
      if (starterBook) {
        initialized.privateMemory = [
          ...initialized.privateMemory,
          `[BOOK MEMORY • "${starterBook.title}" by ${starterBook.author}] ${starterBook.summary} (Decision Heuristic: ${starterBook.decisionHeuristic})`,
        ];
      }
      initialized.interactionQueue = buildAutonomousLifeFlowQueue(
        initialized,
        DEFAULT_SMART_OBJECTS,
        3,
        false
      );
      placedChars.push(initialized);
    });
    placedChars.forEach((charItem) => {
      charItem.relationships = createInitialRelationshipsForCharacter(
        charItem,
        placedChars
      );
    });
    return ensurePersonalBedsForAllToons(placedChars, DEFAULT_SMART_OBJECTS);
  });

  const [smartObjects, setSmartObjects] = useState<SmartObject[]>(
    () => initialHousehold.updatedObjects
  );
  const [characters, setCharacters] = useState<Character[]>(
    () => initialHousehold.updatedCharacters
  );

  // Option 5: Household Legacy Milestones State
  const [householdMilestones, setHouseholdMilestones] = useState<
    HouseholdLegacyMilestone[]
  >(() => createInitialHouseholdLegacyMilestones());

  // Single Active Speaker Lock (Ensures only one toon speaks at a time)
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // The House Agent — Main Character Cross-World Memory & Zero-Prompt Autonomous Events
  const [houseMemory, setHouseMemory] = useState<HouseCrossWorldMemory>(() =>
    loadHouseMemoryFromStorage()
  );
  const [activeHouseEvent, setActiveHouseEvent] = useState<HouseInteractiveEvent | null>(null);
  const lastAutonomousEventGameSecRef = useRef<number>(8 * 3600);
  const eventToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoStartVoiceChat, setAutoStartVoiceChat] = useState<boolean>(false);

  // The House Agent's Omniscient Black-Box Wall Log
  const [wallLogs, setWallLogs] = useState<string[]>([
    '[08:00 AM | The House] Lot diorama initialized at 64x64 grid coordinates (1x Real-Life Pacing).',
  ]);

  // Viewport & 3-Mode Display State ('GAMEPLAY' | 'SCREENSAVER' | 'DESKTOP_BACKGROUND')
  const [cutawayMode, setCutawayMode] = useState<WallCutawayMode>('CUTAWAY');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPencilOutline, setShowPencilOutline] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [alwaysSpeakOutLoud, setAlwaysSpeakOutLoud] = useState<boolean>(false);
  const [appDisplayMode, setAppDisplayMode] = useState<AppDisplayMode>('GAMEPLAY');
  const screensaverActivatedAtRef = useRef<number>(0);
  const modeCapabilities = getDisplayModeCapabilities(appDisplayMode, isMuted);
  const isScreensaverMode = appDisplayMode === 'SCREENSAVER';
  const [isMobileSimMode, setIsMobileSimMode] = useState<boolean>(false);

  // Active Modals & Selection
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [showCASModal, setShowCASModal] = useState<boolean>(false);
  const [showChatbotModal, setShowChatbotModal] = useState<boolean>(false);
  const [showAssetStudioModal, setShowAssetStudioModal] = useState<boolean>(false);
  const [showScenarioModal, setShowScenarioModal] = useState<boolean>(false);

  // Sims-Style World Builder State (Empty Grid + Building Parts + AI Scenario Prompt)
  const [isWorldBuilderMode, setIsWorldBuilderMode] = useState<boolean>(false);
  const [worldBlueprint, setWorldBlueprint] = useState<WorldBlueprint>(() => ({
    isEmptyGridMode: false,
    lotTitle: 'Starter Bungalow Lot',
    architecturalStyle: 'Mid-Century Suburban Bungalow',
    placedParts: [],
  }));
  const [selectedBuildPart, setSelectedBuildPart] = useState<BuildingPartDefinition | null>(
    WORLD_BUILDER_CATALOG[0]
  );
  const [buildToolMode, setBuildToolMode] = useState<BuildToolMode>('PLACE');
  const [buildPartRotationY, setBuildPartRotationY] = useState<number>(0);
  const [targetRoomForPaint, setTargetRoomForPaint] = useState<string>('LivingRoom');
  const [isGeneratingWorld, setIsGeneratingWorld] = useState<boolean>(false);

  // Firebase Auth & Silent Background Cloud Auto-Save State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // Fetch Real-Time Weather on Mount & Every 5 Minutes
  useEffect(() => {
    const fetchLiveWeather = async () => {
      try {
        const res = await fetch('/api/weather');
        if (!res.ok) return;
        const data = await res.json();
        if (data.condition) {
          setWeather({
            condition: data.condition as WeatherCondition,
            tempF: data.tempF ?? 68,
            windMph: data.windMph ?? 6,
            description: data.description || 'Live Local Weather',
          });
        }
      } catch {
        // Fallback to clear weather if offline
      }
    };
    fetchLiveWeather();
    const timer = setInterval(fetchLiveWeather, 300000);
    return () => clearInterval(timer);
  }, []);

  // Listen for Firebase Auth state changes (Background Cloud Save)
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Silent Background Cloud Auto-Save Loop (Every 45 seconds)
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(async () => {
      try {
        const simHour = (gameSeconds % 86400) / 3600;
        const simDay = Math.floor(gameSeconds / 86400) + 1;
        await saveGameToCloud(
          currentUser.uid,
          'Background Auto-Save',
          'Autosaves',
          true,
          simHour,
          simDay,
          characters,
          smartObjects,
          { funds, expansionLevel, gameSeconds, timeScale, roomWallpapers, roomCarpets }
        );
      } catch {
        // Silent background cloud persistence
      }
    }, 45000);
    return () => clearInterval(timer);
  }, [currentUser, gameSeconds, characters, smartObjects, funds, expansionLevel, timeScale, roomWallpapers, roomCarpets]);

  // Offline History Sync on Mount
  useEffect(() => {
    const lastTimestampStr = localStorage.getItem('the_house_last_real_timestamp');
    const now = Date.now() / 1000;

    if (lastTimestampStr) {
      const lastTime = parseFloat(lastTimestampStr);
      const realSecondsPassed = Math.max(0, now - lastTime);

      if (realSecondsPassed > 20) {
        const offlineResult = simulateOfflineHistory(realSecondsPassed, characters, maturity);
        setCharacters(offlineResult.updatedCharacters);
        setGameSeconds((prev) => prev + calculateGameTime(realSecondsPassed, 1.0));
        setWallLogs((prev) => [...prev, ...offlineResult.logs]);
      }
    }

    const saveInterval = setInterval(() => {
      localStorage.setItem('the_house_last_real_timestamp', (Date.now() / 1000).toString());
    }, 15000);

    return () => clearInterval(saveInterval);
  }, []);

  // Subscribe to Active Speaker Lock so only one toon speaks at a time
  useEffect(() => {
    return sound.onActiveSpeakerChange((speakerId) => {
      setActiveSpeakerId(speakerId);
    });
  }, []);

  // Persist The House Agent's Cross-World Memory whenever it updates
  useEffect(() => {
    saveHouseMemoryToStorage(houseMemory);
  }, [houseMemory]);

  // Keyboard shortcuts ('V' Voice Chat with The House, 'M' mute, 'G' switch to Gameplay Mode, 'Escape' exit POV)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (appDisplayMode === 'SCREENSAVER') {
        if (Date.now() - screensaverActivatedAtRef.current > 200) {
          setAppDisplayMode((prev) => resolveDisplayModeTransition(prev, 'WAKE_PC'));
        }
        return;
      }

      if (appDisplayMode === 'DESKTOP_BACKGROUND') {
        if (e.key === 'g' || e.key === 'G' || e.key === 'Escape') {
          e.preventDefault();
          setAppDisplayMode((prev) => resolveDisplayModeTransition(prev, 'SWITCH_TO_GAMEPLAY'));
        }
        return;
      }

      if (e.key === 'Escape' && firstPersonCharId) {
        setFirstPersonCharId(null);
        return;
      }
      if (isInputFocused) return;

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        sound.playChime(true);
        setAutoStartVoiceChat(true);
        setShowChatbotModal(true);
      } else if (e.key === 'm' || e.key === 'M') {
        const next = !isMuted;
        setIsMuted(next);
        sound.setMuted(next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMuted, firstPersonCharId, appDisplayMode]);

  // PC Wake Detection for SCREENSAVER -> Automatically switches to DESKTOP_BACKGROUND Mode
  useEffect(() => {
    if (appDisplayMode !== 'SCREENSAVER') return;

    let initialPointer: { x: number; y: number } | null = null;
    const wakeFromScreensaver = () => {
      if (Date.now() - screensaverActivatedAtRef.current < 250) return;
      setAppDisplayMode((prev) => resolveDisplayModeTransition(prev, 'WAKE_PC'));
    };

    const onPointerMove = (e: PointerEvent | MouseEvent) => {
      if (Date.now() - screensaverActivatedAtRef.current < 250) return;
      if (!initialPointer) {
        initialPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      if (Math.hypot(e.clientX - initialPointer.x, e.clientY - initialPointer.y) > 4) {
        wakeFromScreensaver();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        wakeFromScreensaver();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('pointerdown', wakeFromScreensaver);
    window.addEventListener('focus', wakeFromScreensaver);
    window.addEventListener('pc-wake', wakeFromScreensaver);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('pointerdown', wakeFromScreensaver);
      window.removeEventListener('focus', wakeFromScreensaver);
      window.removeEventListener('pc-wake', wakeFromScreensaver);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [appDisplayMode]);

  // Synchronize Sound & Toon Voices across GAMEPLAY, SCREENSAVER, and DESKTOP_BACKGROUND Modes
  useEffect(() => {
    sound.stopScreensaverMusic();
    if (!modeCapabilities.enableSoundAndVoices) {
      sound.setMuted(true);
    } else {
      sound.setMuted(isMuted);
    }
  }, [modeCapabilities.enableSoundAndVoices, isMuted]);

  // Silent Background Knowledgebase Ingestion (Acquires Real-World Events, Stories & Real Book Summaries into Toon Memory)
  // Note: Receiving newspapers is strictly an internal toon knowledgebase system and never displays a popup overlay to the user.
  const triggerGroundedNewspaperForChar = async (char: Character, isMorningDelivery = false) => {
    const timeStr = formatGameTime(gameSeconds).timeStr;

    // 1. Immediately ingest a Real Book Summary & World Event into the toon's knowledgebase & memory
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== char.id && !isMorningDelivery) return c;
        const ingested = ingestNewspaperAndBookKnowledge(c, undefined, timeStr);
        return {
          ...ingested.updatedChar,
          selfTalk: isMorningDelivery ? c.selfTalk : ingested.updatedChar.selfTalk,
        };
      })
    );

    // 2. Also fetch live Google Search Grounded real-world event, story, and real book summary in the background
    try {
      const res = await fetch('/api/newspaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traits: char.traits,
          characterName: char.name,
          day: formatGameTime(gameSeconds).day,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const headline = data.headline || 'Neuroscientists & Architects Advance Cognitive Living Spaces';
      const summary = data.summary || 'Structured reading and deliberate routines sharpen autonomous decision-making.';
      const realStory = data.realStory || summary;
      const topics: string[] = Array.isArray(data.topics) ? data.topics : [headline];

      setNewspaperEdition({
        masthead: data.editionTitle || 'Toon Knowledgebase',
        headline,
        summary,
        sources: Array.isArray(data.sources) ? data.sources : [],
        readerName: char.name,
      });

      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== char.id) {
            const existingTopics = c.learnedTopics || [];
            return {
              ...c,
              learnedTopics: Array.from(new Set([...existingTopics, headline, ...topics])).slice(-14),
            };
          }
          const ingested = ingestNewspaperAndBookKnowledge(
            c,
            {
              headline,
              summary,
              realStory,
              topics,
              realBook: data.realBook,
            },
            timeStr
          );
          return {
            ...ingested.updatedChar,
            selfTalk: isMorningDelivery ? c.selfTalk : ingested.updatedChar.selfTalk,
          };
        })
      );
    } catch {
      // Already ingested local real book summary & world event into toon knowledgebase
    }
  };

  // Daily Background Knowledge Acquisition (Acquires world events, stories & real book summaries into toon memory)
  const currentDayNumber = formatGameTime(gameSeconds).day;
  useEffect(() => {
    if (lastDeliveredNewspaperDayRef.current < currentDayNumber && characters.length > 0) {
      lastDeliveredNewspaperDayRef.current = currentDayNumber;
      const timeStr = formatGameTime(gameSeconds).timeStr;
      setWallLogs((l) => [
        ...l,
        `[${timeStr} | Toon Knowledgebase] Day ${currentDayNumber} real-world events, stories, and book summaries ingested into household memory.`,
      ]);
      triggerGroundedNewspaperForChar(characters[0], true);
    }
  }, [currentDayNumber]);

  // Autonomous Multi-Agent Simulation Tick (Runs every 1 real second, scaled by timeScale)
  useEffect(() => {
    if (timeScale === 0) return;

    const interval = setInterval(() => {
      const deltaGameSec = timeScale * 1.0;
      setGameSeconds((prev) => prev + deltaGameSec);
      const formatted = formatGameTime(gameSeconds);
      const timeStr = formatted.timeStr;
      const simDay = formatted.day;
      const simHour = ((gameSeconds % 86400) / 3600);

      // Rare, Multi-Hour Cooldown Autonomous House Events (Performed automatically without prompting user to choose!)
      let autonomousEventResult: ReturnType<typeof executeAutonomousHouseEvent> | null = null;
      if (
        shouldSpawnAutonomousHouseEvent(
          gameSeconds,
          lastAutonomousEventGameSecRef.current
        )
      ) {
        lastAutonomousEventGameSecRef.current = gameSeconds;
        autonomousEventResult = executeAutonomousHouseEvent(
          houseMemory,
          characters,
          smartObjects,
          maturity,
          timeStr
        );
        setActiveHouseEvent(autonomousEventResult.event);
        setHouseMemory(autonomousEventResult.updatedMemory);
        if (autonomousEventResult.fundsDelta) {
          setFunds((f) => Math.max(0, f + autonomousEventResult!.fundsDelta));
        }
        setWallLogs((l) => [...l, autonomousEventResult!.logMessage]);
        sound.playChime(true);
        if (eventToastTimerRef.current) clearTimeout(eventToastTimerRef.current);
        eventToastTimerRef.current = setTimeout(() => setActiveHouseEvent(null), 9000);
      }

      // Multi-Agent Decision, 1-10 Surroundings Influence, Work Shifts, Conversations, Life/Death Cycle & Anti-Looping Task Variety
      setCharacters((prevChars) => {
        const baseChars = autonomousEventResult
          ? autonomousEventResult.updatedCharacters
          : prevChars;
        const nextChars = baseChars.map((char) => ({
          ...char,
          motives: { ...char.motives },
          privateMemory: [...char.privateMemory],
          recentObjectIds: [...(char.recentObjectIds || [])],
          learnedTopics: [...(char.learnedTopics || [])],
          interactionQueue: buildAutonomousLifeFlowQueue(
            char,
            smartObjects,
            3,
            isDarkMode
          ),
        }));

        // Track if a multi-toon conversation was already triggered on this tick so audio queues cleanly
        let conversationTriggeredThisTick = false;

        for (let idx = 0; idx < nextChars.length; idx++) {
          const updated = nextChars[idx];

          // Advance Daily Aspirations & active TemporaryMotiveBoost timers (and roll fresh goals when a new day starts)
          const aspTick = tickDailyAspirationsAndBoosts(
            updated,
            deltaGameSec,
            simDay,
            smartObjects,
            timeStr
          );
          updated.motives = aspTick.updatedChar.motives;
          updated.dailyAspirations = aspTick.updatedChar.dailyAspirations;
          if (aspTick.logMessage) {
            setWallLogs((l) => [...l, aspTick.logMessage!]);
          }

          const hasActiveMotiveBoost =
            (updated.dailyAspirations?.activeMotiveBoosts.length || 0) > 0;
          const decayMult = hasActiveMotiveBoost ? 0.55 : 1.0;

          // 1-10 Basic Needs Depletion (hungry, hygiene, sleep, bathroom slowly deplete over time and sync with motives)
          const depletedChar = depleteBasicNeeds1To10(
            updated,
            deltaGameSec,
            decayMult
          );
          updated.basicNeeds = depletedChar.basicNeeds;
          updated.motives = depletedChar.motives;
          updated.motives.social = Math.max(
            0,
            updated.motives.social - 0.0009 * timeScale * decayMult
          );

          // Option 4: Dynamic Moodlets & Emotional State Engine evaluation
          const moodStep = evaluateCharacterMoodletsAndEmotion(
            updated,
            smartObjects,
            weather.condition
          );
          updated.emotionalState = moodStep.emotionalState;
          updated.activeMoodlets = moodStep.activeMoodlets;

          // Evaluate 1-10 Surroundings & Weather Influence on Agent Behavior
          if (updated.onGrid && Math.random() < 0.05) {
            const envInfluence = evaluateSurroundingsInfluence(
              updated,
              smartObjects,
              weather.condition
            );
            updated.motives.sanity = Math.max(
              0,
              Math.min(100, updated.motives.sanity + envInfluence.sanityDelta * 0.05)
            );
            updated.motives.fun = Math.max(
              0,
              Math.min(100, updated.motives.fun + envInfluence.funDelta * 0.05)
            );
          }

          // Off-Grid / Work Shift Return Logic
          if (!updated.onGrid) {
            updated.actionTimer -= deltaGameSec;
            if (updated.actionTimer <= 0) {
              const wasAtWork = Boolean(updated.isAtWork);
              const career = getCharacterCareerInfo(updated);
              updated.onGrid = true;
              updated.isAtWork = false;
              const safeReturnPos = resolveFurnitureCollision(
                { x: 1.5 + idx * 1.45, y: 0, z: 10.5 },
                smartObjects,
                undefined,
                nextChars,
                updated.id,
                worldBlueprint.placedParts
              );
              updated.pos = { x: safeReturnPos.x, y: 0, z: safeReturnPos.z };
              updated.lookAtPos = { x: 0.5, y: 0, z: 4.0 };
              updated.room = 'Yard';

              if (wasAtWork) {
                const earned = updated.dailySalary || career.dailySalary;
                setFunds((f) => f + earned);
                updated.currentAction = `Home from ${career.careerTitle} Shift (+§${earned})`;
                updated.selfTalk = `Just got back from my shift as a ${career.careerTitle}. Earned §${earned} for our next home improvement!`;
                updated.motives.fun = Math.min(100, updated.motives.fun + 15);
                setWallLogs((l) => [
                  ...l,
                  `[${timeStr} | Career Income] ${updated.name} returned from work (${career.careerTitle}) and added §${earned} to household funds!`,
                ]);
                sound.playChime(true);
                sound.vocalizeThought(
                  updated.selfTalk,
                  updated.genderFrame === 'Feminine' ? 1.25 : 0.95,
                  isDarkMode && updated.motives.sanity < 40,
                  updated.id
                );
              } else {
                updated.currentAction = 'Returned from Town';
                updated.selfTalk = 'Back home on the lot. Needed that fresh air.';
                updated.motives.fun = Math.min(100, updated.motives.fun + 25);
                setWallLogs((l) => [...l, `[${timeStr}] ${updated.name} stepped back onto the grid sidewalk.`]);
                sound.playChime(true);
              }
              updated.actionTimer = 3600; // 1 hour decompressing at home after returning
            }
            continue;
          }

          // On-Grid Action Execution (Decrements by deltaGameSec so 1x = real-life seconds)
          updated.actionTimer -= deltaGameSec;
          if (updated.actionTimer <= 0) {
            // 1. Check if Toon should leave the house for their Daily Work Shift to earn money for home improvements
            const career = getCharacterCareerInfo(updated);
            const currentlyOnGridCount = nextChars.filter((c) => c.onGrid).length;
            const shouldGoToWork =
              simHour >= 8.5 &&
              simHour <= 17.5 &&
              (updated.lastWorkDay || 0) < simDay &&
              currentlyOnGridCount >= 2 &&
              Math.random() < 0.35;

            if (shouldGoToWork) {
              updated.onGrid = false;
              updated.isAtWork = true;
              updated.lastWorkDay = simDay;
              updated.careerTitle = career.careerTitle;
              updated.dailySalary = career.dailySalary;
              updated.pos = { x: 16, y: 0, z: 14 };
              updated.room = 'OffGrid';
              updated.currentAction = `At Work (${career.careerTitle})`;
              updated.actionTimer = 28800; // 8-hour real-life work shift
              updated.selfTalk = `Heading out to work as a ${career.careerTitle} to earn §${career.dailySalary} for home renovations.`;
              setWallLogs((l) => [
                ...l,
                `[${timeStr} | Work Shift] ${updated.name} left the house for an 8-hour shift as a ${career.careerTitle} (Pay: §${career.dailySalary}).`,
              ]);
              sound.vocalizeThought(
                updated.selfTalk,
                updated.genderFrame === 'Feminine' ? 1.25 : 0.95,
                false,
                updated.id
              );
              continue;
            }

            // 2. Autonomous Multi-Story Home Improvement (Upstairs / Basement) or Furniture Purchase
            const buildEval = evaluateBuilderAutonomousActions(
              updated,
              smartObjects,
              expansionLevel,
              timeStr,
              funds,
              hasBasement
            );

            if (
              buildEval.action.type === 'EXPAND_FLOOR' ||
              buildEval.action.type === 'BUILD_UPSTAIRS' ||
              buildEval.action.type === 'BUILD_BASEMENT'
            ) {
              const builtStory =
                buildEval.action.builtStory ||
                (buildEval.action.type === 'BUILD_BASEMENT' ? 'BASEMENT' : 'UPSTAIRS');
              if (builtStory === 'BASEMENT') {
                setHasBasement(true);
              } else {
                setExpansionLevel(2);
              }
              const spawnedList = buildEval.action.spawnedStoryObjects || [];
              if (spawnedList.length > 0) {
                setSmartObjects((prev) =>
                  declipAllSmartObjects(
                    [...prev, ...spawnedList],
                    worldBlueprint.placedParts,
                    !worldBlueprint.isEmptyGridMode
                  )
                );
              }
              setFunds(buildEval.newFunds);
              setWallLogs((l) => [...l, `[${timeStr} | Multi-Story Architecture] ${buildEval.action.description}`]);
              sound.playChime(true);
            } else if (buildEval.action.type === 'AUTO_BUY' && buildEval.action.purchasedObject) {
              const rawObj = buildEval.action.purchasedObject;
              const safePlacement = resolveNonToonObjectPlacement(
                rawObj.gridPos,
                {
                  id: rawObj.id,
                  name: rawObj.name,
                  room: rawObj.room,
                },
                smartObjects,
                worldBlueprint.placedParts,
                !worldBlueprint.isEmptyGridMode
              );
              const newObj: SmartObject = {
                ...rawObj,
                gridPos: safePlacement.safePos,
              };
              setSmartObjects((prev) => [...prev, newObj]);
              setFunds(buildEval.newFunds);
              setWallLogs((l) => [...l, `[${timeStr} | Catalog] ${buildEval.action.description}`]);
              sound.playChime(true);
            }

            // 3. Unhurried Toon-to-Toon Conversations (Uses learnedTopics from Newspaper, TV & Books!)
            const potentialPartners = nextChars.filter(
              (other) =>
                other.id !== updated.id &&
                other.onGrid &&
                !other.currentAction.toLowerCase().includes('sleep')
            );

            if (
              !conversationTriggeredThisTick &&
              potentialPartners.length > 0 &&
              (updated.motives.social < 65 || Math.random() < 0.30)
            ) {
              const partner =
                potentialPartners.find((p) => p.room === updated.room) ||
                potentialPartners[Math.floor(Math.random() * potentialPartners.length)];

              const conv = generateMultiToonConversation(
                updated,
                partner,
                isDarkMode
              );

              // Place both toons near each other in the partner's room facing one another without colliding
              const angle = (idx * 2.1) + 0.45;
              updated.room = partner.room;
              updated.activeObjectId = undefined;
              const safeConvPos = resolveFurnitureCollision(
                {
                  x: partner.pos.x + Math.cos(angle) * 1.55,
                  y: partner.pos.y,
                  z: partner.pos.z + Math.sin(angle) * 1.55,
                },
                smartObjects,
                undefined,
                nextChars,
                updated.id,
                worldBlueprint.placedParts
              );
              updated.pos = {
                x: safeConvPos.x,
                y: partner.pos.y,
                z: safeConvPos.z,
              };
              updated.lookAtPos = { ...partner.pos };
              partner.lookAtPos = { ...updated.pos };

              updated.currentAction = `Chatting with ${partner.name.split(' ')[0]}`;
              partner.currentAction = `Chatting with ${updated.name.split(' ')[0]}`;
              updated.actionTimer = 5400; // 1.5-hour real-life deep conversation
              partner.actionTimer = Math.max(partner.actionTimer, 5400);

              updated.motives.social = Math.min(100, updated.motives.social + 24);
              updated.motives.fun = Math.min(100, updated.motives.fun + 12);
              partner.motives.social = Math.min(100, partner.motives.social + 24);
              partner.motives.fun = Math.min(100, partner.motives.fun + 12);

              updated.selfTalk = conv.speakerLine;
              partner.selfTalk = conv.listenerReply;

              const convLog = `[${timeStr} | Conversation] ${updated.name.split(' ')[0]} & ${partner.name.split(' ')[0]} settled in for a long conversation in the ${partner.room}.`;
              setWallLogs((l) => [...l, convLog]);
              updated.privateMemory.push(convLog);
              partner.privateMemory.push(convLog);

              const expSpeaker = recordLifeExperienceActivity(updated, {
                domainOverride: 'SOCIAL',
                activityLabel: `Deep conversation with ${partner.name.split(' ')[0]}`,
                durationSeconds: 5400,
                timeStr,
              });
              updated.traits = expSpeaker.updatedChar.traits;
              updated.lifeExperience = expSpeaker.updatedChar.lifeExperience;
              updated.privateMemory = expSpeaker.updatedChar.privateMemory;

              const expPartner = recordLifeExperienceActivity(partner, {
                domainOverride: 'SOCIAL',
                activityLabel: `Deep conversation with ${updated.name.split(' ')[0]}`,
                durationSeconds: 5400,
                timeStr,
              });
              partner.traits = expPartner.updatedChar.traits;
              partner.lifeExperience = expPartner.updatedChar.lifeExperience;
              partner.privateMemory = expPartner.updatedChar.privateMemory;

              // Evaluate Social Daily Aspirations for both conversation partners
              const aspSpeaker = evaluateDailyAspirationProgress(updated, {
                isConversation: true,
                activityLabel: `Conversation with ${partner.name}`,
                timeStr,
                gameDay: simDay,
              });
              updated.motives = aspSpeaker.updatedChar.motives;
              updated.dailyAspirations = aspSpeaker.updatedChar.dailyAspirations;
              updated.privateMemory = aspSpeaker.updatedChar.privateMemory;
              if (aspSpeaker.logMessages.length > 0) {
                setWallLogs((l) => [...l, ...aspSpeaker.logMessages]);
              }

              const aspPartner = evaluateDailyAspirationProgress(partner, {
                isConversation: true,
                activityLabel: `Conversation with ${updated.name}`,
                timeStr,
                gameDay: simDay,
              });
              partner.motives = aspPartner.updatedChar.motives;
              partner.dailyAspirations = aspPartner.updatedChar.dailyAspirations;
              partner.privateMemory = aspPartner.updatedChar.privateMemory;
              if (aspPartner.logMessages.length > 0) {
                setWallLogs((l) => [...l, ...aspPartner.logMessages]);
              }

              // Option 2: Update Dynamic 1-10 Social Affinity Matrix between speaker & partner
              const relStep = updateRelationshipBetweenToons(
                updated,
                partner,
                timeStr,
                conv.speakerLine
              );
              updated.relationships = relStep.updatedSpeaker.relationships;
              partner.relationships = relStep.updatedListener.relationships;
              setWallLogs((l) => [...l, relStep.logMessage]);

              // Autonomous Baby Birth when an unrelated Male + Female pair reaches >= 8.5/10 affinity
              const babyCheck = canHaveBabyTogether(updated, partner, nextChars);
              if (
                babyCheck.eligible &&
                !(updated.childrenIds && updated.childrenIds.length > 0) &&
                !(partner.childrenIds && partner.childrenIds.length > 0)
              ) {
                const birthRes = haveBabyBetweenToons(
                  updated,
                  partner,
                  nextChars,
                  smartObjects,
                  timeStr
                );
                if (birthRes.success && birthRes.baby) {
                  nextChars.splice(0, nextChars.length, ...birthRes.updatedCharacters);
                  setWallLogs((l) => [...l, birthRes.logMessage]);
                  sound.playChime(true);
                }
              }

              // Queue both voices sequentially in the non-interrupting FIFO queue at equalized volume
              sound.vocalizeThought(
                conv.speakerLine,
                updated.genderFrame === 'Feminine' ? 1.25 : 0.95,
                isDarkMode && updated.motives.sanity < 40,
                updated.id
              );
              sound.vocalizeThought(
                conv.listenerReply,
                partner.genderFrame === 'Feminine' ? 1.25 : 0.95,
                isDarkMode && partner.motives.sanity < 40,
                partner.id
              );

              conversationTriggeredThisTick = true;
              continue;
            }

            // 4. Life Flow Queue & Hard-Coded Anti-Looping Task Variety Selection
            const availableObjects = smartObjects.filter(
              (o) => o.maturity === 'ALL' || (o.maturity === 'DARK_ONLY' && isDarkMode)
            );

            // Pop the #1 Up Next scheduled SmartObject interaction from the character's Life Flow queue
            const dequeued = dequeueNextScheduledInteraction(
              updated.interactionQueue || [],
              availableObjects
            );

            const chosenObject =
              dequeued.nextObject ||
              selectVariedAutonomousObject(
                updated,
                availableObjects,
                weather.condition
              );

            if (chosenObject) {
              // Record in recentObjectIds so the toon won't repeat the same task over and over
              updated.recentObjectIds = [
                ...(updated.recentObjectIds || []).filter((id) => id !== chosenObject.id).slice(-3),
                chosenObject.id,
              ];
              updated.activeObjectId = chosenObject.id;
              updated.room = chosenObject.room;

              // Place toon at a natural approach point in front of furniture & resolve collision with assets and other toons
              const approach = getInteractionApproachPoint(chosenObject, idx);
              const safeApproachPos = resolveFurnitureCollision(
                approach.pos,
                smartObjects,
                chosenObject.id,
                nextChars,
                updated.id,
                worldBlueprint.placedParts
              );
              updated.pos = { x: safeApproachPos.x, y: approach.pos.y, z: safeApproachPos.z };
              updated.lookAtPos = { ...approach.lookAtPos };
              updated.currentAction = chosenObject.actionLabel;
              updated.actionTimer = Math.max(
                3600,
                dequeued.nextItem?.durationSeconds || chosenObject.durationSeconds
              );

              // Replenish the character's upcoming Life Flow queue after popping the active interaction
              updated.interactionQueue = buildAutonomousLifeFlowQueue(
                { ...updated, interactionQueue: dequeued.remainingQueue },
                smartObjects,
                3,
                isDarkMode
              );

              const iqMult = getIntelligenceEfficiencyMultiplier(updated);
              Object.entries(chosenObject.effects).forEach(([stat, val]) => {
                const key = stat as keyof typeof updated.motives;
                if (typeof val === 'number') {
                  const scaledVal = val > 0 ? Math.round(val * iqMult) : val;
                  updated.motives[key] = Math.max(0, Math.min(100, updated.motives[key] + scaledVal));
                }
              });

              // Option 1: Fulfill 1-10 Basic Needs (hungry, hygiene, sleep, bathroom) via required SmartObject action
              const needFulfill = fulfillBasicNeedWithAction(updated, {
                object: chosenObject,
                timeStr,
              });
              updated.basicNeeds = needFulfill.updatedChar.basicNeeds;
              updated.motives = needFulfill.updatedChar.motives;
              updated.emotionalState = needFulfill.updatedChar.emotionalState;
              updated.activeMoodlets = needFulfill.updatedChar.activeMoodlets;

              // Option 3: Advance 1-10 Skill Mastery Tree & award Masterwork Royalties
              const skillStep = advanceCharacterSkillFromAction(
                updated,
                chosenObject,
                timeStr
              );
              updated.skillTree = skillStep.updatedChar.skillTree;
              updated.totalRoyaltiesEarned = skillStep.updatedChar.totalRoyaltiesEarned;
              if (skillStep.royaltyEarned > 0) {
                setFunds((f) => f + skillStep.royaltyEarned);
              }
              if (skillStep.logMessage) {
                setWallLogs((l) => [...l, skillStep.logMessage!]);
              }

              // Acquire real book summaries, world events & conversation topics into toon's Knowledgebase & Memory
              const mediaLearn = learnFromMediaObject(
                updated,
                chosenObject,
                newspaperEdition?.headline ? [newspaperEdition.headline] : []
              );
              updated.learnedTopics = mediaLearn.updatedTopics;
              if (mediaLearn.updatedKnowledgebase) {
                updated.knowledgebase = mediaLearn.updatedKnowledgebase;
              }
              if (mediaLearn.updatedIntelligenceScore !== undefined) {
                updated.intelligenceScore = mediaLearn.updatedIntelligenceScore;
              }
              if (mediaLearn.updatedPrivateMemory) {
                updated.privateMemory = mediaLearn.updatedPrivateMemory;
              }
              if (mediaLearn.updatedLifeExperience) {
                updated.lifeExperience = mediaLearn.updatedLifeExperience;
              }
              if (mediaLearn.updatedTraits) {
                updated.traits = mediaLearn.updatedTraits;
              }

              updated.selfTalk = getDiverseContextualSelfTalk(
                updated,
                chosenObject,
                isDarkMode,
                Date.now(),
                mediaLearn.mediaThought
              );

              // If the toon picked up the in-game newspaper, silently ingest world events & a real book summary
              if (chosenObject.id.includes('newspaper')) {
                triggerGroundedNewspaperForChar(updated, false);
              }

              // Record autonomous activity in the Life Experience Tracker & evaluate gradual personality trait shifts
              const expStep = recordLifeExperienceActivity(updated, {
                object: chosenObject,
                durationSeconds: updated.actionTimer,
                triggerSource: 'AUTONOMOUS_ACTIVITY',
                timeStr,
              });
              updated.traits = expStep.updatedChar.traits;
              updated.lifeExperience = expStep.updatedChar.lifeExperience;
              updated.privateMemory = expStep.updatedChar.privateMemory;
              if (expStep.shiftedTrait) {
                updated.selfTalk = expStep.updatedChar.selfTalk;
                setWallLogs((l) => [
                  ...l,
                  `[${timeStr} | Life Experience Shift] ${updated.name}: ${expStep.shiftedTrait!.reason}`,
                ]);
              }

              // Evaluate progress toward the toon's Daily Aspirations & grant Temporary Motive Boosts upon completion
              const aspStep = evaluateDailyAspirationProgress(updated, {
                object: chosenObject,
                activityLabel: chosenObject.actionLabel,
                timeStr,
                gameDay: simDay,
              });
              updated.motives = aspStep.updatedChar.motives;
              updated.dailyAspirations = aspStep.updatedChar.dailyAspirations;
              updated.privateMemory = aspStep.updatedChar.privateMemory;
              if (aspStep.newlyCompleted.length > 0) {
                updated.selfTalk = aspStep.updatedChar.selfTalk;
                setWallLogs((l) => [...l, ...aspStep.logMessages]);
              }

              const logEntry = `[${timeStr} | ${chosenObject.room}] ${updated.name} is ${chosenObject.actionLabel.toLowerCase()}.`;
              setWallLogs((l) => [...l, logEntry]);
              updated.privateMemory.push(logEntry);
              if (updated.privateMemory.length > 25) updated.privateMemory.shift();

              sound.vocalizeThought(
                updated.selfTalk,
                updated.genderFrame === 'Feminine' ? 1.25 : 0.95,
                isDarkMode && updated.motives.sanity < 40,
                updated.id
              );
            }
          }
        }

        // 5. Autonomous World Life, Aging & Mortality Cycle (Young Adult -> Adult -> Elder -> Passing & Successor Generation)
        const lifecycleStep = advanceWorldLifeAndMortalityCycle(
          nextChars,
          deltaGameSec,
          isDarkMode,
          smartObjects,
          timeStr
        );
        if (lifecycleStep.lifecycleLogs.length > 0) {
          setWallLogs((l) => [...l, ...lifecycleStep.lifecycleLogs]);
        }
        if (lifecycleStep.memorials.length > 0) {
          setHouseMemory((prevMem) => ({
            ...prevMem,
            deceasedMemorials: [
              ...(prevMem.deceasedMemorials || []),
              ...lifecycleStep.memorials,
            ].slice(-20),
            learnedInsights: [
              ...prevMem.learnedInsights.slice(-18),
              ...lifecycleStep.memorials.map((m) => `[MORTALITY] ${m.epitaph}`),
            ],
          }));
        }

        // Option 5: Evaluate Autonomous Household Legacy Milestones & award Estate Bonuses
        const milestoneEval = evaluateHouseholdLegacyMilestones({
          characters: lifecycleStep.updatedCharacters,
          smartObjects,
          funds,
          hasUpstairs,
          hasBasement,
          existingMilestones: householdMilestones,
          timeStr,
        });
        if (milestoneEval.newlyUnlocked.length > 0) {
          setHouseholdMilestones(milestoneEval.milestones);
          setFunds((f) => f + milestoneEval.totalBonusSimoleons);
          setWallLogs((l) => [...l, ...milestoneEval.logMessages]);
        }

        return lifecycleStep.updatedCharacters;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    timeScale,
    smartObjects,
    isDarkMode,
    maturity,
    gameSeconds,
    funds,
    expansionLevel,
    hasBasement,
    weather.condition,
    newspaperEdition?.headline,
    activeHouseEvent,
    houseMemory,
    worldBlueprint.placedParts,
    worldBlueprint.isEmptyGridMode,
  ]);

  // Handlers
  const handleToggleAlwaysSpeakOutLoud = () => {
    const next = sound.toggleAlwaysSpeakOutLoud();
    setAlwaysSpeakOutLoud(next);
    sound.playClick(680);
  };

  const handleSelectCharacter = (id: string) => {
    setSelectedCharId(id);
    sound.playClick(600);
    const target = characters.find((c) => c.id === id);
    if (target && target.selfTalk) {
      sound.vocalizeThought(
        target.selfTalk,
        target.genderFrame === 'Feminine' ? 1.25 : 0.95,
        isDarkMode && target.motives.sanity < 40,
        target.id
      );
    }
  };

  const handleToggleFirstPerson = (charId: string) => {
    setFirstPersonCharId((prev) => (prev === charId ? null : charId));
    sound.playChime(true);
  };

  const handleReadNewspaperCommand = (charId: string) => {
    const paperObj = smartObjects.find((o) => o.id.includes('newspaper'));
    if (paperObj) {
      handleCommandAction(charId, paperObj.id);
    }
    const char = characters.find((c) => c.id === charId);
    if (char) {
      triggerGroundedNewspaperForChar(char, false);
    }
  };

  const handleCommandAction = (charId: string, objectId: string) => {
    const targetObj = smartObjects.find((o) => o.id === objectId);
    if (!targetObj) return;

    setCharacters((prev) =>
      prev.map((c, idx) => {
        if (c.id !== charId) return c;
        const approach = getInteractionApproachPoint(targetObj, idx);
        const safePos = resolveFurnitureCollision(
          approach.pos,
          smartObjects,
          targetObj.id,
          prev,
          c.id,
          worldBlueprint.placedParts
        );
        const mediaLearn = learnFromMediaObject(
          c,
          targetObj,
          newspaperEdition?.headline ? [newspaperEdition.headline] : []
        );
        const remainingWithoutTarget = (c.interactionQueue || []).filter(
          (item) => item.objectId !== targetObj.id
        );
        const updated: Character = {
          ...c,
          room: targetObj.room,
          activeObjectId: targetObj.id,
          pos: { x: safePos.x, y: approach.pos.y, z: safePos.z },
          lookAtPos: { ...approach.lookAtPos },
          recentObjectIds: [...(c.recentObjectIds || []).slice(-3), targetObj.id],
          learnedTopics: mediaLearn.updatedTopics,
          knowledgebase: mediaLearn.updatedKnowledgebase || c.knowledgebase,
          intelligenceScore: mediaLearn.updatedIntelligenceScore ?? c.intelligenceScore,
          privateMemory: mediaLearn.updatedPrivateMemory || c.privateMemory,
          lifeExperience: mediaLearn.updatedLifeExperience || c.lifeExperience,
          traits: mediaLearn.updatedTraits || c.traits,
          currentAction: targetObj.actionLabel,
          actionTimer: Math.max(3600, targetObj.durationSeconds),
          selfTalk: getDiverseContextualSelfTalk(
            c,
            targetObj,
            isDarkMode,
            Date.now(),
            mediaLearn.mediaThought
          ),
        };
        const expStep = recordLifeExperienceActivity(updated, {
          object: targetObj,
          durationSeconds: updated.actionTimer,
          triggerSource: 'AUTONOMOUS_ACTIVITY',
          timeStr: formatGameTime(gameSeconds).timeStr,
        });
        const finalChar = expStep.updatedChar;
        const aspStep = evaluateDailyAspirationProgress(finalChar, {
          object: targetObj,
          activityLabel: targetObj.actionLabel,
          timeStr: formatGameTime(gameSeconds).timeStr,
          gameDay: formatGameTime(gameSeconds).day,
        });
        const needStep = fulfillBasicNeedWithAction(aspStep.updatedChar, {
          object: targetObj,
          timeStr: formatGameTime(gameSeconds).timeStr,
        });
        const skillStep = advanceCharacterSkillFromAction(
          needStep.updatedChar,
          targetObj,
          formatGameTime(gameSeconds).timeStr
        );
        if (skillStep.royaltyEarned > 0) {
          setFunds((f) => f + skillStep.royaltyEarned);
        }
        const postAspChar = skillStep.updatedChar;
        postAspChar.interactionQueue = buildAutonomousLifeFlowQueue(
          { ...postAspChar, interactionQueue: remainingWithoutTarget },
          smartObjects,
          3,
          isDarkMode
        );
        if (expStep.shiftedTrait) {
          setWallLogs((l) => [
            ...l,
            `[${formatGameTime(gameSeconds).timeStr} | Life Experience Shift] ${postAspChar.name}: ${expStep.shiftedTrait!.reason}`,
          ]);
        }
        if (aspStep.logMessages.length > 0) {
          setWallLogs((l) => [...l, ...aspStep.logMessages]);
        }
        if (needStep.logMessage) {
          setWallLogs((l) => [...l, needStep.logMessage!]);
        }
        sound.playChime(true);
        sound.vocalizeThought(
          postAspChar.selfTalk,
          c.genderFrame === 'Feminine' ? 1.25 : 0.95,
          isDarkMode && c.motives.sanity < 40,
          c.id
        );
        return postAspChar;
      })
    );
  };

  const handleFulfillBasicNeed = (charId: string, needKey: BasicNeedKey) => {
    const timeInfo = formatGameTime(gameSeconds);
    const targetObj = getRequiredObjectForBasicNeed(needKey, smartObjects);

    setCharacters((prev) =>
      prev.map((c, idx) => {
        if (c.id !== charId) return c;
        let moved = { ...c };
        if (targetObj) {
          const approach = getInteractionApproachPoint(targetObj, idx);
          const safePos = resolveFurnitureCollision(
            approach.pos,
            smartObjects,
            targetObj.id,
            prev,
            c.id,
            worldBlueprint.placedParts
          );
          moved = {
            ...moved,
            room: targetObj.room,
            activeObjectId: targetObj.id,
            pos: { x: safePos.x, y: approach.pos.y, z: safePos.z },
            lookAtPos: { ...approach.lookAtPos },
            currentAction: targetObj.actionLabel,
            actionTimer: Math.max(3600, targetObj.durationSeconds),
          };
        }
        const fulfilled = fulfillBasicNeedWithAction(moved, {
          needKey,
          object: targetObj || undefined,
          timeStr: timeInfo.timeStr,
        });
        if (fulfilled.logMessage) {
          setWallLogs((l) => [...l, fulfilled.logMessage!]);
        }
        sound.playChime(true);
        return fulfilled.updatedChar;
      })
    );
  };

  const handleBoostRelationship = (charAId: string, charBId: string) => {
    const timeInfo = formatGameTime(gameSeconds);
    setCharacters((prev) => {
      const charA = prev.find((c) => c.id === charAId);
      const charB = prev.find((c) => c.id === charBId);
      if (!charA || !charB) return prev;

      const relStep = updateRelationshipBetweenToons(
        charA,
        charB,
        timeInfo.timeStr,
        'Sharing a heartfelt bonding moment together!',
        1.25
      );
      setWallLogs((l) => [...l, relStep.logMessage]);
      sound.playChime(true);

      return prev.map((c) => {
        if (c.id === charA.id) return relStep.updatedSpeaker;
        if (c.id === charB.id) return relStep.updatedListener;
        return c;
      });
    });
  };

  const handleHaveBaby = (charAId: string, charBId: string) => {
    const timeInfo = formatGameTime(gameSeconds);
    setCharacters((prev) => {
      const charA = prev.find((c) => c.id === charAId);
      const charB = prev.find((c) => c.id === charBId);
      if (!charA || !charB) return prev;

      const birthRes = haveBabyBetweenToons(
        charA,
        charB,
        prev,
        smartObjects,
        timeInfo.timeStr
      );
      if (birthRes.logMessage) {
        setWallLogs((l) => [...l, birthRes.logMessage]);
      }
      if (birthRes.success && birthRes.baby) {
        sound.playChime(true);
        const ensured = ensurePersonalBedsForAllToons(birthRes.updatedCharacters, smartObjects);
        setSmartObjects(ensured.updatedObjects);
        setActiveEvent({
          title: `New Baby Born: ${birthRes.baby.name}!`,
          description: `${charA.name} and ${charB.name}'s strong bond welcomed baby ${birthRes.baby.name} into the household with their own bed!`,
          type: 'SOCIAL',
        });
        return ensured.updatedCharacters;
      }
      return birthRes.updatedCharacters;
    });
  };

  const handlePursueDailyAspiration = (charId: string, aspirationId: string) => {
    const timeInfo = formatGameTime(gameSeconds);
    setCharacters((prev) =>
      prev.map((c, idx) => {
        if (c.id !== charId) return c;
        const aspState =
          c.dailyAspirations ||
          createInitialDailyAspirationsState(c, timeInfo.day, smartObjects);
        const targetAsp = aspState.aspirations.find((a) => a.id === aspirationId);
        if (!targetAsp) return c;

        const matchingObj =
          smartObjects.find((o) => o.id === targetAsp.preferredObjectId) ||
          smartObjects.find((o) =>
            doesActivityMatchDailyAspiration(targetAsp, { object: o })
          ) ||
          smartObjects[0];

        let movedChar = { ...c, dailyAspirations: aspState };
        if (matchingObj) {
          const approach = getInteractionApproachPoint(matchingObj, idx);
          const safePos = resolveFurnitureCollision(
            approach.pos,
            smartObjects,
            matchingObj.id,
            prev,
            c.id,
            worldBlueprint.placedParts
          );
          movedChar = {
            ...movedChar,
            room: matchingObj.room,
            activeObjectId: matchingObj.id,
            pos: { x: safePos.x, y: approach.pos.y, z: safePos.z },
            lookAtPos: { ...approach.lookAtPos },
            currentAction: matchingObj.actionLabel,
            actionTimer: Math.max(3600, matchingObj.durationSeconds),
          };
        }

        const aspEval = evaluateDailyAspirationProgress(movedChar, {
          object: matchingObj,
          aspirationIdToForceComplete: aspirationId,
          timeStr: timeInfo.timeStr,
          gameDay: timeInfo.day,
        });

        if (aspEval.logMessages.length > 0) {
          setWallLogs((l) => [...l, ...aspEval.logMessages]);
        }
        sound.playChime(true);
        return aspEval.updatedChar;
      })
    );
  };

  const handleRerollDailyAspirations = (charId: string) => {
    const timeInfo = formatGameTime(gameSeconds);
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const currentBoosts = c.dailyAspirations?.activeMotiveBoosts || [];
        const totalDone = c.dailyAspirations?.totalCompletedAllTime || 0;
        const freshAspirations = generateDailyAspirationsForCharacter(
          c,
          timeInfo.day,
          smartObjects,
          3
        );
        return {
          ...c,
          dailyAspirations: {
            currentDay: timeInfo.day,
            aspirations: freshAspirations,
            activeMotiveBoosts: currentBoosts,
            totalCompletedAllTime: totalDone,
          },
        };
      })
    );
    sound.playClick(640);
  };

  const handleQueueAction = (charId: string, objectId: string) => {
    const targetObj = smartObjects.find((o) => o.id === objectId);
    if (!targetObj) return;

    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const currentQueue =
          c.interactionQueue && c.interactionQueue.length > 0
            ? c.interactionQueue
            : buildAutonomousLifeFlowQueue(c, smartObjects, 3, isDarkMode);
        const nextQueue = enqueueSmartObjectInteraction(
          currentQueue,
          targetObj,
          'PLAYER_QUEUED'
        );
        return {
          ...c,
          interactionQueue: nextQueue,
        };
      })
    );
    sound.playClick(720);
  };

  const handleRemoveQueuedAction = (charId: string, queueItemId: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const currentQueue =
          c.interactionQueue && c.interactionQueue.length > 0
            ? c.interactionQueue
            : buildAutonomousLifeFlowQueue(c, smartObjects, 3, isDarkMode);
        const filtered = removeScheduledInteraction(currentQueue, queueItemId);
        const replenished = buildAutonomousLifeFlowQueue(
          { ...c, interactionQueue: filtered },
          smartObjects,
          Math.max(2, filtered.length),
          isDarkMode
        );
        return {
          ...c,
          interactionQueue: replenished,
        };
      })
    );
    sound.playClick(480);
  };

  const handlePromoteQueuedAction = (charId: string, queueItemId: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const currentQueue =
          c.interactionQueue && c.interactionQueue.length > 0
            ? c.interactionQueue
            : buildAutonomousLifeFlowQueue(c, smartObjects, 3, isDarkMode);
        return {
          ...c,
          interactionQueue: promoteScheduledInteraction(currentQueue, queueItemId),
        };
      })
    );
    sound.playClick(660);
  };

  const handleSkipToNextQueuedAction = (charId: string) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    const currentQueue =
      char.interactionQueue && char.interactionQueue.length > 0
        ? char.interactionQueue
        : buildAutonomousLifeFlowQueue(char, smartObjects, 3, isDarkMode);
    const { nextObject, remainingQueue } = dequeueNextScheduledInteraction(
      currentQueue,
      smartObjects
    );
    if (!nextObject) return;

    setCharacters((prev) =>
      prev.map((c, idx) => {
        if (c.id !== charId) return c;
        const approach = getInteractionApproachPoint(nextObject, idx);
        const safePos = resolveFurnitureCollision(
          approach.pos,
          smartObjects,
          nextObject.id,
          prev,
          c.id,
          worldBlueprint.placedParts
        );
        const mediaLearn = learnFromMediaObject(
          c,
          nextObject,
          newspaperEdition?.headline ? [newspaperEdition.headline] : []
        );
        const updated: Character = {
          ...c,
          room: nextObject.room,
          activeObjectId: nextObject.id,
          pos: { x: safePos.x, y: approach.pos.y, z: safePos.z },
          lookAtPos: { ...approach.lookAtPos },
          recentObjectIds: [...(c.recentObjectIds || []).slice(-3), nextObject.id],
          learnedTopics: mediaLearn.updatedTopics,
          knowledgebase: mediaLearn.updatedKnowledgebase || c.knowledgebase,
          intelligenceScore: mediaLearn.updatedIntelligenceScore ?? c.intelligenceScore,
          privateMemory: mediaLearn.updatedPrivateMemory || c.privateMemory,
          lifeExperience: mediaLearn.updatedLifeExperience || c.lifeExperience,
          traits: mediaLearn.updatedTraits || c.traits,
          currentAction: nextObject.actionLabel,
          actionTimer: Math.max(3600, nextObject.durationSeconds),
          selfTalk: getDiverseContextualSelfTalk(
            c,
            nextObject,
            isDarkMode,
            Date.now(),
            mediaLearn.mediaThought
          ),
        };
        const expStep = recordLifeExperienceActivity(updated, {
          object: nextObject,
          durationSeconds: updated.actionTimer,
          triggerSource: 'AUTONOMOUS_ACTIVITY',
          timeStr: formatGameTime(gameSeconds).timeStr,
        });
        const finalChar = expStep.updatedChar;
        finalChar.interactionQueue = buildAutonomousLifeFlowQueue(
          { ...finalChar, interactionQueue: remainingQueue },
          smartObjects,
          3,
          isDarkMode
        );
        if (expStep.shiftedTrait) {
          setWallLogs((l) => [
            ...l,
            `[${formatGameTime(gameSeconds).timeStr} | Life Experience Shift] ${finalChar.name}: ${expStep.shiftedTrait!.reason}`,
          ]);
        }
        sound.playChime(true);
        return finalChar;
      })
    );
  };

  const handleSendOffGrid = (charId: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        const willBeOnGrid = !c.onGrid;
        const career = getCharacterCareerInfo(c);
        if (!willBeOnGrid) {
          return {
            ...c,
            onGrid: false,
            isAtWork: true,
            careerTitle: career.careerTitle,
            dailySalary: career.dailySalary,
            actionTimer: 28800,
            pos: { x: 17.5, y: 0, z: 16 },
            currentAction: `At Work (${career.careerTitle})`,
            selfTalk: `Heading off to my 8-hour shift as a ${career.careerTitle} to earn §${career.dailySalary} for the house!`,
          };
        }
        return {
          ...c,
          onGrid: true,
          isAtWork: false,
          actionTimer: 3600,
          pos: { x: 1.5, y: 0, z: 10.5 },
          currentAction: 'Returned to Lot',
          selfTalk: 'Returned home from town!',
        };
      })
    );
    sound.playClick(500);
  };

  const handleAddSmartObject = (newObj: SmartObject) => {
    setSmartObjects((prev) => {
      const safePlacement = resolveNonToonObjectPlacement(
        newObj.gridPos,
        {
          id: newObj.id,
          name: newObj.name,
          room: newObj.room,
        },
        prev,
        worldBlueprint.placedParts,
        !worldBlueprint.isEmptyGridMode
      );
      return [...prev, { ...newObj, gridPos: safePlacement.safePos }];
    });
    setWallLogs((prev) => [
      ...prev,
      `[${formatGameTime(gameSeconds).timeStr}] New Smart Object '${newObj.name}' materialized collision-free in the ${newObj.room}.`,
    ]);
    sound.playChime(true);
  };

  const handleSaveCustomCharacter = (newChar: Character) => {
    const combined = [...characters, newChar];
    const ensured = ensurePersonalBedsForAllToons(combined, smartObjects);
    setCharacters(ensured.updatedCharacters);
    setSmartObjects(ensured.updatedObjects);
    setWallLogs((prev) => [
      ...prev,
      `[${formatGameTime(gameSeconds).timeStr}] ${newChar.name} moved into The House diorama lot with their own personal bed!`,
    ]);
    sound.playChime(true);
  };

  const handleStartScenario = (scenario: Scenario, chosenMaturity: MaturityRating) => {
    setMaturity(chosenMaturity);
    setGameSeconds(8 * 3600);
    const placedChars: Character[] = [];
    const newChars: Character[] = scenario.characters.map((c, idx) => {
      const safePos = resolveFurnitureCollision(c.pos, smartObjects, undefined, placedChars, c.id);
      const initialized: Character = {
        ...c,
        pos: { x: safePos.x, y: c.pos.y, z: safePos.z },
        actionTimer: 7200 + idx * 3600,
        currentAction: 'Settling into lot',
        selfTalk: idx === 0 ? `Ready for ${scenario.title}.` : '',
        privateMemory: [...c.privateMemory, ...(scenario.initialSecrets[c.id] || [])],
      };
      placedChars.push(initialized);
      return initialized;
    });
    const ensured = ensurePersonalBedsForAllToons(newChars, smartObjects);
    setCharacters(ensured.updatedCharacters);
    setSmartObjects(ensured.updatedObjects);
    setSelectedCharId(ensured.updatedCharacters[0]?.id || null);
    setFirstPersonCharId(null);

    // Record this Normal or Gore world in The House Agent's Cross-World Memory
    setHouseMemory((prev) =>
      recordWorldInHouseMemory(prev, {
        worldId: scenario.id,
        title: scenario.title,
        maturity: chosenMaturity,
        residentNames: newChars.map((c) => c.name),
        timeStr: '08:00 AM',
      })
    );

    setWallLogs([
      `[08:00 AM | The House] Initialized scenario '${scenario.title}' (Mode: ${chosenMaturity}). Cross-world memory updated.`,
    ]);
    sound.playChime(true);
  };

  const handleStartRandomGame = (chosenMaturity: MaturityRating) => {
    setMaturity(chosenMaturity);
    setGameSeconds(8 * 3600);
    const randomTraits = ['Ambitious', 'Creative', 'Neat', 'Lazy', 'Foodie', 'Bookworm', 'Snob'];
    if (chosenMaturity === 'DARK_MODE') randomTraits.push('Paranoid', 'Secretive', 'Guilt-Ridden');

    const names = ['Evelyn Cross', 'Dante Vance', 'Liam Harper'];
    const colors = ['#4f46e5', '#059669', '#d97706'];
    const placedChars: Character[] = [];

    const newChars: Character[] = names.map((name, i) => {
      const chosenT = [
        randomTraits[i % randomTraits.length],
        randomTraits[(i + 2) % randomTraits.length],
      ];
      const charId = `char_rand_${i}`;
      const safePos = resolveFurnitureCollision(
        { x: (i - 1) * 4.5, y: 0, z: (i - 1) * 2.5 + 1.5 },
        smartObjects,
        undefined,
        placedChars,
        charId
      );
      const initialized: Character = {
        id: charId,
        name,
        ageStage: 'Adult',
        traits: chosenT,
        lifeGoal: 'Make a lasting mark on the world',
        room: i === 0 ? 'LivingRoom' : i === 1 ? 'Kitchen' : 'Bedroom',
        pos: { x: safePos.x, y: 0, z: safePos.z },
        onGrid: true,
        currentAction: 'Arrived on Lot',
        actionTimer: 7200 + i * 3600,
        selfTalk: i === 0 ? 'Curious what this house has in store for me.' : '',
        motives: { hunger: 80, energy: 85, bladder: 80, hygiene: 85, social: 70, fun: 70, sanity: 90 },
        privateMemory: [`Moved in with ${chosenT.join(' and ')} tendencies.`],
        color: colors[i],
        genderFrame: i % 2 === 0 ? 'Feminine' : 'Masculine',
        hairStyle: 'Cropped Bob',
        facialHair: 'None',
        clothingTop: 'Everyday Tee',
        clothingBottom: 'Denim Jeans',
      };
      placedChars.push(initialized);
      return initialized;
    });

    const ensured = ensurePersonalBedsForAllToons(newChars, smartObjects);
    setCharacters(ensured.updatedCharacters);
    setSmartObjects(ensured.updatedObjects);
    setSelectedCharId(ensured.updatedCharacters[0].id);
    setFirstPersonCharId(null);

    setHouseMemory((prev) =>
      recordWorldInHouseMemory(prev, {
        worldId: `rand_${Date.now()}`,
        title: chosenMaturity === 'DARK_MODE' ? 'Procedural Gore Timeline' : 'Procedural Normal Timeline',
        maturity: chosenMaturity,
        residentNames: newChars.map((c) => c.name),
        timeStr: '08:00 AM',
      })
    );

    setWallLogs([
      `[08:00 AM | The House] Procedural Random Start generated with 3 unique occupants.`,
    ]);
    sound.playChime(true);
  };

  // Toggle between Normal (FAMILY_FRIENDLY) and Gore (DARK_MODE) with the same House Agent
  const handleToggleGameMaturity = () => {
    const nextMaturity: MaturityRating =
      maturity === 'FAMILY_FRIENDLY' ? 'DARK_MODE' : 'FAMILY_FRIENDLY';
    setMaturity(nextMaturity);
    const timeStr = formatGameTime(gameSeconds).timeStr;
    setHouseMemory((prev) =>
      recordWorldInHouseMemory(prev, {
        worldId: `mode_shift_${Date.now()}`,
        title: nextMaturity === 'DARK_MODE' ? 'Gore Mode Shift' : 'Normal Mode Shift',
        maturity: nextMaturity,
        residentNames: characters.map((c) => c.name),
        timeStr,
      })
    );
    setWallLogs((prev) => [
      ...prev,
      `[${timeStr} | The House] Shifted reality to ${
        nextMaturity === 'DARK_MODE' ? 'GORE / DARK MODE' : 'NORMAL FAMILY MODE'
      } while retaining full cross-world memory.`,
    ]);
    sound.playChime(true);
  };

  // Execute an Autonomous House Event (Random/Data-Driven, Known Event by ID, or Custom User Prompt)
  // Performs immediately without prompting the user to choose, assigns the toon a task (e.g. eat a specific food),
  // and imprints the resulting Good or Bad personality trait onto the toon!
  const runHouseEventImmediately = (options?: {
    knownEventId?: string;
    customPrompt?: string;
    targetCharId?: string;
  }) => {
    const timeStr = formatGameTime(gameSeconds).timeStr;
    lastAutonomousEventGameSecRef.current = gameSeconds;
    const res = executeAutonomousHouseEvent(
      houseMemory,
      characters,
      smartObjects,
      maturity,
      timeStr,
      options
    );
    setCharacters(res.updatedCharacters);
    setHouseMemory(res.updatedMemory);
    setActiveHouseEvent(res.event);
    if (res.fundsDelta) {
      setFunds((f) => Math.max(0, f + res.fundsDelta));
    }
    setWallLogs((prev) => [...prev, res.logMessage]);
    sound.playChime(true);
    sound.speakAsTheHouse(
      `${res.event.title}. ${res.chosenOutcome.outcomeNarrative}`,
      isDarkMode
    );
    if (eventToastTimerRef.current) clearTimeout(eventToastTimerRef.current);
    eventToastTimerRef.current = setTimeout(() => setActiveHouseEvent(null), 9000);
  };

  const handleTriggerHouseEvent = () => {
    runHouseEventImmediately({
      targetCharId: selectedCharId || undefined,
    });
  };

  const handleSpawnKnownEvent = (knownEventId: string, targetCharId?: string) => {
    runHouseEventImmediately({ knownEventId, targetCharId });
  };

  const handleSpawnCustomPromptEvent = (customPrompt: string, targetCharId?: string) => {
    runHouseEventImmediately({ customPrompt, targetCharId });
  };

  const handleWhisperToCharacter = (charId: string, whisperText: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== charId) return c;
        return {
          ...c,
          selfTalk: `(Inner Voice): ${whisperText}`,
          privateMemory: [...c.privateMemory, `[INNER WHISPER] ${whisperText}`],
        };
      })
    );
  };

  const handleToonBuildStory = (
    charId: string | undefined,
    story: 'UPSTAIRS' | 'BASEMENT'
  ) => {
    if (story === 'UPSTAIRS' && hasUpstairs) return;
    if (story === 'BASEMENT' && hasBasement) return;

    const builderChar =
      characters.find((c) => c.id === charId) ||
      characters.find((c) => c.traits.includes('Builder')) ||
      characters[0];

    const timeStr = formatGameTime(gameSeconds).timeStr;
    const res = executeToonBuildStory(builderChar, story, smartObjects, funds);

    if (story === 'UPSTAIRS') {
      setExpansionLevel(2);
    } else {
      setHasBasement(true);
    }

    const updatedSmartObjects = declipAllSmartObjects(
      [...smartObjects, ...res.spawnedObjects],
      worldBlueprint.placedParts,
      !worldBlueprint.isEmptyGridMode
    );
    setSmartObjects(updatedSmartObjects);
    setFunds(res.newFunds);

    // Move the builder toon to the newly constructed story to inspect & use the new furnishings
    const firstNewObj = updatedSmartObjects.find((o) =>
      res.spawnedObjects.some((so) => so.id === o.id)
    );
    if (builderChar && firstNewObj) {
      setCharacters((prev) =>
        prev.map((c, idx) => {
          if (c.id !== builderChar.id) return c;
          const approach = getInteractionApproachPoint(firstNewObj, idx);
          const safePos = resolveFurnitureCollision(
            approach.pos,
            updatedSmartObjects,
            firstNewObj.id,
            prev,
            c.id,
            worldBlueprint.placedParts
          );
          const updatedChar: Character = {
            ...c,
            onGrid: true,
            isAtWork: false,
            room: firstNewObj.room,
            activeObjectId: firstNewObj.id,
            pos: { x: safePos.x, y: approach.pos.y, z: safePos.z },
            lookAtPos: { ...approach.lookAtPos },
            currentAction:
              story === 'UPSTAIRS'
                ? `Inspecting New Upstairs Loft (${firstNewObj.name})`
                : `Inspecting New Basement Level (${firstNewObj.name})`,
            actionTimer: Math.max(7200, firstNewObj.durationSeconds),
            selfTalk:
              story === 'UPSTAIRS'
                ? 'Just finished framing the Upstairs Second-Floor Loft and staircase! Testing out the new loft.'
                : 'Finished excavating the Subterranean Basement and descending stairs! Setting up our underground rec room.',
            privateMemory: [
              ...c.privateMemory.slice(-20),
              `[${timeStr} | Multi-Story Build] ${res.logMessage}`,
            ],
          };
          updatedChar.interactionQueue = buildAutonomousLifeFlowQueue(
            updatedChar,
            updatedSmartObjects,
            3,
            isDarkMode
          );
          return updatedChar;
        })
      );
    }

    setWallLogs((l) => [...l, `[${timeStr} | Multi-Story Architecture] ${res.logMessage}`]);
    sound.playChime(true);
  };

  const handleManualExpandFloor = () => {
    handleToonBuildStory(selectedCharId || undefined, 'UPSTAIRS');
  };

  const handleCycleWeather = () => {
    const order: WeatherCondition[] = ['CLEAR', 'RAIN', 'SNOW', 'STORM', 'CLOUDY'];
    const next = order[(order.indexOf(weather.condition) + 1) % order.length];
    const descMap: Record<WeatherCondition, string> = {
      CLEAR: 'Clear Suburban Skies',
      RAIN: 'Steady Rainfall',
      SNOW: 'Winter Snowfall',
      STORM: 'Thunderstorm Squall',
      CLOUDY: 'Overcast Clouds',
    };
    setWeather((prev) => ({
      ...prev,
      condition: next,
      description: descMap[next],
    }));
    sound.playClick(520);
  };

  const handleApplyLayoutPreset = (preset: HomeLayoutPreset) => {
    setRoomWallpapers({ ...preset.roomWallpapers });
    setRoomCarpets({ ...preset.roomCarpets });
    setOpenConceptKitchen(preset.openConceptKitchen);
    setOpenConceptLiving(preset.openConceptLiving);
    sound.playChime(true);
  };

  // --- SIMS-STYLE WORLD BUILDER HANDLERS ---
  const handleStartEmptyGrid = () => {
    const emptyBp = createEmptyGridBlueprint();
    setWorldBlueprint(emptyBp);
    setSmartObjects([]);
    setShowGrid(true);
    sound.playChime(true);
    const timeStr = formatGameTime(gameSeconds).timeStr;
    setWallLogs((prev) => [
      `[${timeStr} | World Builder] Cleared lot to an Empty 36x36 Grid. Ready for custom architectural building parts or AI prompt scenario generation.`,
      ...prev.slice(0, 45),
    ]);
  };

  const handleRestoreStarterHouse = () => {
    setWorldBlueprint({
      isEmptyGridMode: false,
      lotTitle: 'Restored Starter House',
      architecturalStyle: 'Mid-Century Suburban Bungalow',
      placedParts: [],
    });
    setSmartObjects(DEFAULT_SMART_OBJECTS);
    sound.playChime(true);
  };

  const handlePlacePartAtPosition = (
    part: BuildingPartDefinition,
    pos: { x: number; y?: number; z: number }
  ) => {
    // Handle Surface Paint (Wallpapers & Carpets)
    if (part.partType === 'WALLPAPER' && part.styleId) {
      setRoomWallpapers((prev) => ({ ...prev, [targetRoomForPaint]: part.styleId! }));
      setFunds((f) => Math.max(0, f - part.cost));
      sound.playChime(true);
      return;
    }
    if (part.partType === 'FLOOR_PATTERN' && part.styleId) {
      setRoomCarpets((prev) => ({ ...prev, [targetRoomForPaint]: part.styleId! }));
      setFunds((f) => Math.max(0, f - part.cost));
      sound.playChime(true);
      return;
    }

    const res = placeBuildingPartOnGrid(
      worldBlueprint,
      part,
      pos,
      buildPartRotationY,
      smartObjects
    );
    setWorldBlueprint(res.updatedBlueprint);
    setFunds((f) => Math.max(0, f - res.cost));

    if (res.spawnedSmartObject) {
      setSmartObjects((prev) => [...prev, res.spawnedSmartObject!]);
    }
    sound.playChime(true);
  };

  const handleGridInteractAt = (pos: { x: number; y: number; z: number }) => {
    if (!isWorldBuilderMode) return;
    if (buildToolMode === 'SLEDGEHAMMER') {
      const res = removeBuildingPartAtPosition(worldBlueprint, smartObjects, pos, 2.6);
      if (res.removedName) {
        setWorldBlueprint(res.updatedBlueprint);
        setSmartObjects(res.updatedSmartObjects);
        setFunds((f) => f + res.refund);
        sound.playClick(300);
      }
      return;
    }
    if (selectedBuildPart) {
      handlePlacePartAtPosition(selectedBuildPart, pos);
    }
  };

  const handleQuickPlacePart = (part: BuildingPartDefinition) => {
    const idx = worldBlueprint.placedParts.length;
    const ring = Math.floor(idx / 4);
    const slot = idx % 4;
    const offsets = [
      { x: -5 + ring * 4, y: 0, z: -2 },
      { x: 5 - ring * 4, y: 0, z: -2 },
      { x: -5, y: 0, z: 5 - ring * 3 },
      { x: 5, y: 0, z: 5 - ring * 3 },
    ];
    handlePlacePartAtPosition(part, offsets[slot]);
  };

  const handleGenerateWorldFromPrompt = async (prompt: string) => {
    setIsGeneratingWorld(true);
    sound.playClick(580);
    try {
      const existingParts = worldBlueprint.placedParts;
      const result = generateProceduralBlueprintFromPrompt(prompt, maturity);
      const mergedBlueprint: WorldBlueprint = {
        ...result.blueprint,
        placedParts: [...existingParts, ...result.blueprint.placedParts],
      };

      // Immediately materialize the 3D architectural layout, furnishings, and characters on the grid
      setWorldBlueprint(mergedBlueprint);
      setSmartObjects(result.smartObjects);
      const placedChars: Character[] = [];
      const initialGenChars = result.characters.map((c, idx) => {
        const career = getCharacterCareerInfo(c);
        const safePos = resolveFurnitureCollision(
          c.pos,
          result.smartObjects,
          undefined,
          placedChars,
          c.id,
          mergedBlueprint.placedParts
        );
        const initialized: Character = {
          ...c,
          pos: { x: safePos.x, y: c.pos.y, z: safePos.z },
          selfTalk: idx === 0 ? c.selfTalk : '',
          actionTimer: 7200 + idx * 3600,
          careerTitle: c.careerTitle || career.careerTitle,
          dailySalary: c.dailySalary || career.dailySalary,
          lastWorkDay: 0,
          isAtWork: false,
        };
        placedChars.push(initialized);
        return initialized;
      });
      setCharacters(initialGenChars);
      setRoomWallpapers(result.roomWallpapers);
      setRoomCarpets(result.roomCarpets);
      sound.playChime(true);

      let finalScenarioTitle = mergedBlueprint.lotTitle;
      let finalResidentNames = initialGenChars.map((c) => c.name);

      // Enhance scenario & characters via Gemini /api/world-builder/generate
      try {
        const res = await fetch('/api/world-builder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, maturity }),
        });
        if (res.ok) {
          const aiData = await res.json();
          if (aiData.scenarioTitle || aiData.architecturalStyle) {
            finalScenarioTitle = aiData.scenarioTitle || finalScenarioTitle;
            setWorldBlueprint((prev) => ({
              ...prev,
              lotTitle: aiData.scenarioTitle || prev.lotTitle,
              architecturalStyle: aiData.architecturalStyle || prev.architecturalStyle,
            }));
          }
          if (aiData.roomWallpapers) {
            setRoomWallpapers((prev) => ({ ...prev, ...aiData.roomWallpapers }));
          }
          if (aiData.roomCarpets) {
            setRoomCarpets((prev) => ({ ...prev, ...aiData.roomCarpets }));
          }
          if (Array.isArray(aiData.characters) && aiData.characters.length > 0) {
            const aiPlacedChars: Character[] = [];
            const enhancedChars = aiData.characters.map((ac: any, idx: number) => {
              const baseTemplate = result.characters[idx % result.characters.length];
              const career = getCharacterCareerInfo(baseTemplate);
              const charId = `char_wb_${Date.now()}_${idx}`;
              const safePos = resolveFurnitureCollision(
                baseTemplate.pos,
                result.smartObjects,
                undefined,
                aiPlacedChars,
                charId,
                mergedBlueprint.placedParts
              );
              const initialized: Character = {
                ...baseTemplate,
                id: charId,
                name: ac.name || baseTemplate.name,
                pos: { x: safePos.x, y: baseTemplate.pos.y, z: safePos.z },
                ageStage: ac.ageStage || baseTemplate.ageStage,
                traits:
                  Array.isArray(ac.traits) && ac.traits.length >= 2
                    ? ac.traits
                    : baseTemplate.traits,
                lifeGoal: ac.lifeGoal || baseTemplate.lifeGoal,
                selfTalk: idx === 0 ? ac.selfTalk || baseTemplate.selfTalk : '',
                genderFrame: ac.genderFrame || baseTemplate.genderFrame,
                hairStyle: ac.hairStyle || baseTemplate.hairStyle,
                facialHair: ac.facialHair || baseTemplate.facialHair,
                clothingTop: ac.clothingTop || baseTemplate.clothingTop,
                clothingBottom: ac.clothingBottom || baseTemplate.clothingBottom,
                skinTone: ac.skinTone || baseTemplate.skinTone,
                color: ac.color || baseTemplate.color,
                actionTimer: 7200 + idx * 3600,
                careerTitle: career.careerTitle,
                dailySalary: career.dailySalary,
                lastWorkDay: 0,
                isAtWork: false,
                onGrid: true,
              };
              aiPlacedChars.push(initialized);
              return initialized;
            });
            finalResidentNames = enhancedChars.map((c: Character) => c.name);
            setCharacters(enhancedChars);
          }
        }
      } catch {
        // Already rendered deterministic procedural blueprint
      }

      // Record AI-generated world in The House Agent's cross-world memory
      const timeStr = formatGameTime(gameSeconds).timeStr;
      setHouseMemory((prev) =>
        recordWorldInHouseMemory(prev, {
          worldId: `wb_${Date.now()}`,
          title: finalScenarioTitle,
          maturity,
          residentNames: finalResidentNames,
          timeStr,
        })
      );

      setWallLogs((prev) => [
        `[${timeStr} | AI Scenario Builder] Built "${finalScenarioTitle}" (${mergedBlueprint.placedParts.length} modular parts & ${result.smartObjects.length} furnishings) from prompt: "${prompt}"`,
        ...prev.slice(0, 45),
      ]);
    } finally {
      setIsGeneratingWorld(false);
    }
  };

  const handlePersuadeEntity = (userMessage: string): EntityPersuasionResult => {
    const timeStr = formatGameTime(gameSeconds).timeStr;
    const outcome = evaluateEntityPersuasionRequest(
      userMessage,
      houseMemory,
      smartObjects,
      characters,
      maturity,
      timeStr
    );
    if (outcome.convinced) {
      setSmartObjects(outcome.updatedSmartObjects);
      setHouseMemory(outcome.updatedMemory);
      saveHouseMemoryToStorage(outcome.updatedMemory);
      sound.playChime(true);
    } else {
      sound.playClick(340);
    }
    if (outcome.logMessage) {
      setWallLogs((prev) => [...prev, outcome.logMessage]);
    }
    return outcome;
  };

  const formattedTime = formatGameTime(gameSeconds);
  const selectedCharacter = characters.find((c) => c.id === selectedCharId);
  const firstPersonCharacter = characters.find((c) => c.id === firstPersonCharId);

  return (
    <div
      data-testid="the-house-app-root"
      data-display-mode={appDisplayMode}
      data-ui-visible={modeCapabilities.showUI ? 'true' : 'false'}
      data-sound-enabled={modeCapabilities.enableSoundAndVoices ? 'true' : 'false'}
      onDoubleClick={() => {
        if (appDisplayMode === 'DESKTOP_BACKGROUND') {
          setAppDisplayMode((prev) => resolveDisplayModeTransition(prev, 'SWITCH_TO_GAMEPLAY'));
        }
      }}
      className="relative w-screen h-screen overflow-hidden bg-gray-950 font-sans select-none"
    >
      {/* 1. Main 3D Viewport: Floating Diorama Lot Grid */}
      <Viewport3D
        characters={characters}
        smartObjects={smartObjects}
        isDarkMode={isDarkMode}
        cutawayMode={cutawayMode}
        showGrid={showGrid}
        selectedCharacterId={selectedCharId}
        onSelectCharacter={handleSelectCharacter}
        isScreensaverMode={modeCapabilities.cameraFollowsToons}
        showPencilOutline={showPencilOutline}
        expansionLevel={expansionLevel}
        hasUpstairs={hasUpstairs}
        hasBasement={hasBasement}
        activeFloor={activeFloor}
        firstPersonCharId={firstPersonCharId}
        weatherCondition={weather.condition}
        roomWallpapers={roomWallpapers}
        roomCarpets={roomCarpets}
        openConceptKitchen={openConceptKitchen}
        openConceptLiving={openConceptLiving}
        worldBlueprint={worldBlueprint}
        isWorldBuilderMode={isWorldBuilderMode && modeCapabilities.showUI}
        selectedBuildPart={selectedBuildPart}
        buildToolMode={buildToolMode}
        buildPartRotationY={buildPartRotationY}
        onGridInteractAt={handleGridInteractAt}
        activeSpeakerId={activeSpeakerId}
      />

      {/* Desktop Background Mode: Invisible corner hover-reveal trigger to switch to Gameplay Mode */}
      {appDisplayMode === 'DESKTOP_BACKGROUND' && (
        <button
          onClick={() =>
            setAppDisplayMode((prev) => resolveDisplayModeTransition(prev, 'SWITCH_TO_GAMEPLAY'))
          }
          data-testid="switch-to-gameplay-btn"
          title="Switch to Gameplay Mode (Restore UI, World Controls, and Audio) [Hotkey: G]"
          className="fixed bottom-3 right-3 z-40 px-3 py-1.5 rounded-xl bg-gray-900/85 text-gray-200 border border-gray-700 text-xs font-semibold opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
        >
          Gameplay Mode [G]
        </button>
      )}

      {/* 2.2 First-Person Viewpoint ("Along for the Ride") HUD Banner */}
      {modeCapabilities.showUI && firstPersonCharacter && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto px-5 py-2.5 rounded-2xl bg-amber-950/95 text-amber-100 border border-amber-500/80 shadow-2xl flex items-center gap-3">
          <Eye className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-xs font-extrabold text-amber-300">
              First-Person Ride-Along: {firstPersonCharacter.name}
            </div>
            <div className="text-[10px] text-amber-200/80">
              "{firstPersonCharacter.selfTalk}" — Camera locked to {firstPersonCharacter.name.split(' ')[0]}'s eyes (You are along for the ride)
            </div>
          </div>
          <button
            onClick={() => setFirstPersonCharId(null)}
            className="ml-2 px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer"
          >
            Exit POV (ESC)
          </button>
        </div>
      )}

      {/* 2.4 Non-Blocking Autonomous House Event Toast (Auto-Performed without prompting user to choose!) */}
      {modeCapabilities.showUI && activeHouseEvent && !firstPersonCharacter && (
        <div
          data-testid="house-interactive-event-banner"
          className={`absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[92vw] max-w-xl p-4 rounded-2xl border shadow-2xl ${
            isDarkMode
              ? 'bg-gray-950/95 text-purple-100 border-rose-600/80'
              : 'bg-gray-900/95 text-white border-indigo-500/80'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Autonomous House Event Performed · Tier {activeHouseEvent.omniscienceTier}
                </span>
                {activeHouseEvent.autoSelectedChoice?.personalityImprint && (
                  <span
                    data-testid="house-event-imprinted-trait"
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeHouseEvent.autoSelectedChoice.personalityImprint.polarity === 'GOOD'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                        : 'bg-rose-950 text-rose-300 border border-rose-600'
                    }`}
                  >
                    {activeHouseEvent.autoSelectedChoice.personalityImprint.polarity === 'GOOD'
                      ? '✦ Good Trait Imprinted: '
                      : '⚠ Bad Trait Imprinted: '}
                    {activeHouseEvent.autoSelectedChoice.personalityImprint.traitName}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-amber-300 mt-1">{activeHouseEvent.title}</h3>
              {activeHouseEvent.autoSelectedChoice?.assignedTask && (
                <div
                  data-testid="house-event-assigned-task"
                  className="text-xs font-semibold text-indigo-300 mt-0.5"
                >
                  Assigned Task ({activeHouseEvent.targetCharName || 'Resident'}):{' '}
                  {activeHouseEvent.autoSelectedChoice.assignedTask.actionLabel}
                </div>
              )}
              <p className="text-xs text-gray-300 italic mt-1">
                "{activeHouseEvent.autoSelectedChoice?.outcomeNarrative || activeHouseEvent.houseMonologue}"
              </p>
            </div>
            <button
              onClick={() => setActiveHouseEvent(null)}
              className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-gray-800 transition cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2.5 Spontaneous Random Domestic Event Banner */}
      {modeCapabilities.showUI && activeEvent && !activeHouseEvent && !firstPersonCharacter && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-lg px-4 py-2.5 rounded-2xl bg-indigo-950/95 text-indigo-100 border border-indigo-500/80 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>{activeEvent.title}</span>
                <span className="text-[9px] text-indigo-300 uppercase tracking-wider font-mono">
                  · {activeEvent.type}
                </span>
              </div>
              <p className="text-[11px] text-gray-300 leading-snug mt-0.5">{activeEvent.description}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveEvent(null)}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-indigo-900/60 transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Character Inspector Panel */}
      {modeCapabilities.showUI && selectedCharacter && (
        <CharacterInspector
          character={selectedCharacter}
          allCharacters={characters}
          householdMilestones={householdMilestones}
          onClose={() => setSelectedCharId(null)}
          smartObjects={smartObjects}
          onCommandAction={handleCommandAction}
          onFulfillBasicNeed={handleFulfillBasicNeed}
          onQueueAction={handleQueueAction}
          onRemoveQueuedAction={handleRemoveQueuedAction}
          onPromoteQueuedAction={handlePromoteQueuedAction}
          onSkipToNextQueuedAction={handleSkipToNextQueuedAction}
          onToonBuildStory={handleToonBuildStory}
          hasUpstairs={hasUpstairs}
          hasBasement={hasBasement}
          funds={funds}
          onSendOffGrid={handleSendOffGrid}
          onToggleFirstPerson={handleToggleFirstPerson}
          isFirstPersonActive={firstPersonCharId === selectedCharacter.id}
          onReadNewspaper={handleReadNewspaperCommand}
          onPursueDailyAspiration={handlePursueDailyAspiration}
          onRerollDailyAspirations={handleRerollDailyAspirations}
          onBoostRelationship={handleBoostRelationship}
          onHaveBaby={handleHaveBaby}
          isDarkMode={isDarkMode}
        />
      )}

      {/* 3.8 Sims 4 Build/Buy Mode World Builder HUD */}
      {modeCapabilities.showUI && isWorldBuilderMode && (
        <SimsWorldBuilderHUD
          blueprint={worldBlueprint}
          selectedPart={selectedBuildPart}
          onSelectPart={setSelectedBuildPart}
          toolMode={buildToolMode}
          onSetToolMode={setBuildToolMode}
          partRotationY={buildPartRotationY}
          onRotatePart={() => setBuildPartRotationY((r) => (r + Math.PI / 2) % (Math.PI * 2))}
          onStartEmptyGrid={handleStartEmptyGrid}
          onRestoreStarterHouse={handleRestoreStarterHouse}
          onQuickPlacePart={handleQuickPlacePart}
          onGenerateWorldFromPrompt={handleGenerateWorldFromPrompt}
          isGeneratingWorld={isGeneratingWorld}
          funds={funds}
          cutawayMode={cutawayMode}
          onSetCutawayMode={setCutawayMode}
          targetRoomForPaint={targetRoomForPaint}
          onSetTargetRoomForPaint={setTargetRoomForPaint}
          onApplyWallpaper={(room, styleId, cost) => {
            setRoomWallpapers((prev) => ({ ...prev, [room]: styleId }));
            setFunds((f) => Math.max(0, f - cost));
            sound.playChime(true);
          }}
          onApplyFloorPattern={(room, styleId, cost) => {
            setRoomCarpets((prev) => ({ ...prev, [room]: styleId }));
            setFunds((f) => Math.max(0, f - cost));
            sound.playChime(true);
          }}
          onExitBuildMode={() => setIsWorldBuilderMode(false)}
        />
      )}

      {/* 4. Collapsible Bottom Control Dock (Controls Window: Cash, Toon Names, Sims Floor Switcher, Voice [V]) */}
      {modeCapabilities.showUI && !isWorldBuilderMode && (
        <BottomDock
          timeStr={formattedTime.timeStr}
          day={formattedTime.day}
          timeScale={timeScale}
          onSetTimeScale={setTimeScale}
          cutawayMode={cutawayMode}
          onSetCutawayMode={setCutawayMode}
          activeFloor={activeFloor}
          onSelectFloor={setActiveFloor}
          funds={funds}
          characters={characters}
          selectedCharId={selectedCharId}
          onSelectCharacter={handleSelectCharacter}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showPencilOutline={showPencilOutline}
          onTogglePencilOutline={() => setShowPencilOutline(!showPencilOutline)}
          isMuted={isMuted}
          onToggleMute={() => {
            const next = !isMuted;
            setIsMuted(next);
            sound.setMuted(next);
          }}
          alwaysSpeakOutLoud={alwaysSpeakOutLoud}
          onToggleAlwaysSpeakOutLoud={handleToggleAlwaysSpeakOutLoud}
          isScreensaverMode={isScreensaverMode}
          onToggleScreensaver={() => {
            screensaverActivatedAtRef.current = Date.now();
            setAppDisplayMode((prev) =>
              resolveDisplayModeTransition(prev, 'ACTIVATE_SCREENSAVER')
            );
          }}
          onActivateDesktopBackground={() => {
            setAppDisplayMode((prev) =>
              resolveDisplayModeTransition(prev, 'ACTIVATE_DESKTOP_BACKGROUND')
            );
          }}
          isMobileSimMode={isMobileSimMode}
          onToggleMobileSim={() => setIsMobileSimMode(!isMobileSimMode)}
          onOpenEntityVoiceChat={() => {
            sound.playChime(true);
            setAutoStartVoiceChat(true);
            setShowChatbotModal(true);
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* 5. Modals (Only rendered in GAMEPLAY Mode) */}
      {modeCapabilities.showUI && showCASModal && (
        <CharacterCreatorModal
          onClose={() => setShowCASModal(false)}
          onSaveCharacter={handleSaveCustomCharacter}
          isDarkMode={isDarkMode}
        />
      )}

      {modeCapabilities.showUI && showChatbotModal && (
        <HouseChatbotModal
          onClose={() => {
            setShowChatbotModal(false);
            setAutoStartVoiceChat(false);
          }}
          characters={characters}
          smartObjects={smartObjects}
          wallLogs={wallLogs}
          isDarkMode={isDarkMode}
          onPersuadeEntity={handlePersuadeEntity}
          houseMemory={houseMemory}
          autoStartVoiceChat={autoStartVoiceChat}
          onRecordVoiceExchange={(userUtterance, houseReply) => {
            const timeStr = formatGameTime(gameSeconds).timeStr;
            setWallLogs((prev) => [
              ...prev,
              `[${timeStr} | Entity Voice Chat] You: "${userUtterance}" -> Entity: "${houseReply}"`,
            ]);
          }}
        />
      )}

      {modeCapabilities.showUI && showAssetStudioModal && (
        <AssetStudioModal
          onClose={() => setShowAssetStudioModal(false)}
          onAddSmartObject={handleAddSmartObject}
          roomWallpapers={roomWallpapers}
          onSelectWallpaper={(room, wpId) =>
            setRoomWallpapers((prev) => ({ ...prev, [room]: wpId }))
          }
          roomCarpets={roomCarpets}
          onSelectCarpet={(room, cpId) =>
            setRoomCarpets((prev) => ({ ...prev, [room]: cpId }))
          }
          openConceptKitchen={openConceptKitchen}
          openConceptLiving={openConceptLiving}
          onToggleOpenConcept={(target) => {
            if (target === 'kitchen') setOpenConceptKitchen((v) => !v);
            else setOpenConceptLiving((v) => !v);
          }}
          onApplyLayoutPreset={handleApplyLayoutPreset}
          funds={funds}
          onSpendFunds={(amount) => setFunds((f) => Math.max(0, f - amount))}
          isDarkMode={isDarkMode}
        />
      )}

      {modeCapabilities.showUI && showScenarioModal && (
        <ScenarioModal
          onClose={() => setShowScenarioModal(false)}
          onStartScenario={handleStartScenario}
          onStartRandomGame={handleStartRandomGame}
          currentMaturity={maturity}
        />
      )}

      {modeCapabilities.showUI && isMobileSimMode && (
        <MobileSimulatorView
          onClose={() => setIsMobileSimMode(false)}
          characters={characters}
          smartObjects={smartObjects}
          timeStr={formattedTime.timeStr}
          day={formattedTime.day}
          onSelectCharacter={handleSelectCharacter}
          onOpenChatbot={() => {
            setAutoStartVoiceChat(false);
            setShowChatbotModal(true);
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
