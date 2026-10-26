/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Character,
  BABY_AFFINITY_THRESHOLD,
  buildSocialWebGraph,
  canHaveBabyTogether,
} from '../game/simulation';
import { Heart, Sparkles, UserPlus, Baby } from 'lucide-react';

interface SocialWebGraphProps {
  selectedCharacter: Character;
  allCharacters: Character[];
  onBoostRelationship?: (charAId: string, charBId: string) => void;
  onHaveBaby?: (charAId: string, charBId: string) => void;
  isDarkMode: boolean;
}

export const SocialWebGraph: React.FC<SocialWebGraphProps> = ({
  selectedCharacter,
  allCharacters,
  onBoostRelationship,
  onHaveBaby,
  isDarkMode,
}) => {
  const width = 286;
  const height = 216;
  const { nodes, edges } = buildSocialWebGraph(
    selectedCharacter,
    allCharacters,
    width,
    height
  );

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Edges connected directly to the selected character for quick-action controls
  const otherCharacters = allCharacters.filter(
    (c) => c.id !== selectedCharacter.id
  );

  return (
    <div
      data-testid="social-web-graph"
      className={`rounded-xl border p-2.5 transition-all ${
        isDarkMode
          ? 'bg-gray-950/90 border-pink-900/60 text-gray-100'
          : 'bg-white/95 border-pink-200/90 text-gray-900'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-pink-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-300">
            Interactive Social Web (1–10 Affinity)
          </span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/80 text-pink-800 dark:text-pink-200 font-semibold">
          {nodes.length} Toons · {edges.length} Links
        </span>
      </div>

      <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-2 leading-snug">
        Lines scale with 1–10 affinity. Unrelated male &amp; female pairs with{' '}
        <strong className="text-pink-600 dark:text-pink-400">
          {BABY_AFFINITY_THRESHOLD.toFixed(1)}+/10 Soulmate
        </strong>{' '}
        affinity can welcome a baby!
      </p>

      {/* SVG Social Web Network */}
      <div className="relative flex justify-center items-center rounded-lg bg-slate-50/90 dark:bg-gray-900/90 border border-slate-200/80 dark:border-gray-800 overflow-hidden">
        <svg
          data-testid="social-web-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-w-[286px] select-none"
        >
          <defs>
            <radialGradient id="socialWebBgGlow" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isDarkMode ? '#ec4899' : '#f472b6'}
                stopOpacity={isDarkMode ? '0.14' : '0.10'}
              />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle
            cx={width / 2}
            cy={height / 2}
            r={Math.min(width, height) * 0.44}
            fill="url(#socialWebBgGlow)"
          />

          {/* 1. Relationship Edges (Lines drawn between toons based on affinity scores) */}
          {edges.map((edge) => {
            const fromNode = nodeById.get(edge.fromId);
            const toNode = nodeById.get(edge.toId);
            if (!fromNode || !toNode) return null;

            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;

            return (
              <g key={edge.id} data-testid={`social-web-edge-group-${edge.fromId}-${edge.toId}`}>
                {/* Subtle outer glow for high-affinity or soulmate bonds */}
                {edge.affinity1To10 >= 7.5 && (
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={edge.strokeColor}
                    strokeWidth={edge.strokeWidth + 3}
                    strokeOpacity={0.22}
                    strokeLinecap="round"
                  />
                )}

                {/* Main Affinity Line */}
                <line
                  data-testid="social-web-edge-line"
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={edge.strokeColor}
                  strokeWidth={edge.strokeWidth}
                  strokeDasharray={edge.isDashed ? '4 3' : undefined}
                  strokeOpacity={edge.involvesSelected ? 0.95 : 0.6}
                  strokeLinecap="round"
                />

                {/* Edge Midpoint Status & Affinity Badge */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x={-36}
                    y={-10}
                    width={72}
                    height={20}
                    rx={6}
                    fill={isDarkMode ? '#0f172a' : '#ffffff'}
                    stroke={edge.strokeColor}
                    strokeWidth={1.2}
                    opacity={0.94}
                  />
                  <text
                    textAnchor="middle"
                    y={-1}
                    fill={edge.strokeColor}
                    fontSize="7.5"
                    fontWeight="bold"
                  >
                    {edge.status}
                  </text>
                  <text
                    textAnchor="middle"
                    y={7}
                    fill={isDarkMode ? '#e2e8f0' : '#334155'}
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {edge.affinity1To10.toFixed(1)}/10 {edge.canHaveBaby ? '♥' : ''}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 2. Toon Nodes */}
          {nodes.map((node) => {
            const genderSymbol =
              node.genderFrame === 'Masculine'
                ? '♂'
                : node.genderFrame === 'Feminine'
                ? '♀'
                : '⚧';

            return (
              <g
                key={node.id}
                data-testid={`social-web-node-${node.id}`}
                transform={`translate(${node.x}, ${node.y})`}
              >
                {node.isSelected && (
                  <circle
                    r={22}
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth={2}
                    strokeDasharray="3 2"
                  />
                )}
                <circle
                  r={17}
                  fill={node.color}
                  stroke={node.isSelected ? '#ffffff' : isDarkMode ? '#1e293b' : '#ffffff'}
                  strokeWidth={node.isSelected ? 2.5 : 2}
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {node.firstName.charAt(0)}
                </text>

                {/* Gender / Baby indicator badge */}
                <circle
                  cx={13}
                  cy={-12}
                  r={6.5}
                  fill={
                    node.genderFrame === 'Masculine'
                      ? '#2563eb'
                      : node.genderFrame === 'Feminine'
                      ? '#db2777'
                      : '#64748b'
                  }
                  stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                  strokeWidth={1}
                />
                <text
                  x={13}
                  y={-9.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="7.5"
                  fontWeight="bold"
                >
                  {node.isBabyOrChild ? '★' : genderSymbol}
                </text>

                {/* Toon First Name Label below node */}
                <rect
                  x={-28}
                  y={19}
                  width={56}
                  height={13}
                  rx={4}
                  fill={isDarkMode ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.92)'}
                />
                <text
                  y={28}
                  textAnchor="middle"
                  fill={isDarkMode ? '#f8fafc' : '#0f172a'}
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  {node.firstName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2 px-1 text-[9px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Rival
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Acquaintance
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Friend
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" /> Soulmate (8.5+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Family
        </span>
      </div>

      {/* Autonomous Relationship & Baby Eligibility Read-Only Summary */}
      <div className="mt-2.5 space-y-1.5">
        {otherCharacters.map((other) => {
          const babyCheck = canHaveBabyTogether(
            selectedCharacter,
            other,
            allCharacters
          );
          const edge = edges.find(
            (e) =>
              (e.fromId === selectedCharacter.id && e.toId === other.id) ||
              (e.fromId === other.id && e.toId === selectedCharacter.id)
          );
          const affinity = edge?.affinity1To10 ?? babyCheck.affinity1To10;
          const status = edge?.status ?? 'Acquaintance';

          return (
            <div
              key={other.id}
              data-testid={`social-web-card-${other.id}`}
              className="p-2 rounded-lg bg-slate-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-[10px]"
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: other.color }}
                  />
                  <span className="font-bold text-gray-800 dark:text-gray-100 truncate">
                    {other.name}
                  </span>
                  <span className="text-[9px] text-gray-400">
                    ({other.genderFrame === 'Masculine' ? 'Male' : other.genderFrame === 'Feminine' ? 'Female' : 'Unisex'}
                    {babyCheck.isRelated ? ' · Family' : ' · Unrelated'})
                  </span>
                </div>
                <span className="font-mono font-bold text-pink-600 dark:text-pink-400 shrink-0">
                  {affinity.toFixed(1)}/10 · {status}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1.5 mt-1 text-[9px] text-gray-500 dark:text-gray-400">
                <span>Autonomous AI Bond</span>
                {babyCheck.isOppositeSex && !babyCheck.isRelated && (
                  <span
                    data-testid={`social-web-baby-status-${other.id}`}
                    className={`px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 ${
                      babyCheck.eligible
                        ? 'bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300'
                        : 'bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Baby className="w-2.5 h-2.5" />
                    <span>
                      {babyCheck.eligible
                        ? 'Soulmate Bond (Autonomous Baby Eligible)'
                        : `Baby Threshold: ${affinity.toFixed(1)}/${BABY_AFFINITY_THRESHOLD}`}
                    </span>
                  </span>
                )}
                {babyCheck.isRelated && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-semibold flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    Family Relation
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
