/**
 * connectionStore.js — Zustand store for database connection state
 *
 * Tracks: connection status, MySQL version, and the feature compatibility map.
 * Mirrors the data returned by POST /api/connect and GET /api/version.
 */

import { create } from 'zustand';
import api from '../services/api';

export const useConnectionStore = create((set, get) => ({
  // State
  isConnected:   false,
  isConnecting:  false,
  database:      null,
  versionString: null,
  version:       null,
  compat:        null,
  error:         null,

  // Manual override for compatibility mode (user can force a tier in the UI)
  // null means "use auto-detected"
  overrideTier: null,

  /**
   * Connect to a MySQL database using the provided credentials.
   * @param {{ host, port, user, password, database }} credentials
   */
  connect: async (credentials) => {
    set({ isConnecting: true, error: null });
    try {
      const { data } = await api.post('/connect', credentials);
      set({
        isConnected:   true,
        isConnecting:  false,
        database:      data.database,
        versionString: data.versionString,
        version:       data.version,
        compat:        data.compat,
        error:         null,
      });
    } catch (err) {
      set({
        isConnecting:  false,
        error: err.response?.data?.error || 'Connection failed',
      });
      throw err;
    }
  },

  /**
   * Connect using a saved connection ID
   */
  connectSaved: async (connectionId) => {
    set({ isConnecting: true, error: null });
    try {
      const { data } = await api.post('/connect/saved', { connectionId });
      set({
        isConnected:   true,
        isConnecting:  false,
        database:      data.database,
        versionString: data.versionString,
        version:       data.version,
        compat:        data.compat,
        error:         null,
      });
    } catch (err) {
      set({
        isConnecting:  false,
        error: err.response?.data?.error || 'Failed to connect using saved credentials',
      });
      throw err;
    }
  },

  /**
   * Rehydrate connection state from backend if session is still active
   */
  rehydrateConnection: async (databaseName) => {
    try {
      const { data } = await api.get('/version');
      set({
        isConnected:   true,
        database:      databaseName,
        versionString: data.versionString,
        version:       data.version,
        compat:        data.compat,
        error:         null,
      });
    } catch (err) {
      // Ignore if not connected
    }
  },

  /**
   * Disconnect from the current database session.
   */
  disconnect: async () => {
    try {
      await api.delete('/disconnect');
    } finally {
      set({
        isConnected:   false,
        database:      null,
        versionString: null,
        version:       null,
        compat:        null,
        error:         null,
        overrideTier:  null,
      });
    }
  },

  /**
   * Override the compatibility tier shown in the UI.
   * @param {'Auto'|'5.6'|'5.7'|'8.0+'|null} tier
   */
  setOverrideTier: (tier) => set({ overrideTier: tier }),

  /**
   * Get the effective compatibility map — either the override or auto-detected.
   * Returns null if not connected.
   */
  getEffectiveCompat: () => {
    const { compat, overrideTier } = get();
    if (!compat) return null;
    if (!overrideTier || overrideTier === 'Auto') return compat;

    // Build a synthetic compat map for the selected tier
    const tierMaps = {
      '5.6': {
        ctes: false, windowFunctions: false, jsonFunctions: false,
        jsonFunctionsPartial: false, onlyFullGroupBy: false,
        groupByMode: 'permissive', tier: '5.6',
      },
      '5.7': {
        ctes: false, windowFunctions: false, jsonFunctions: true,
        jsonFunctionsPartial: true, onlyFullGroupBy: true,
        groupByMode: 'strict', tier: '5.7',
      },
      '8.0+': {
        ctes: true, windowFunctions: true, jsonFunctions: true,
        jsonFunctionsPartial: false, onlyFullGroupBy: true,
        groupByMode: 'strict', tier: '8.0+',
      },
    };
    return tierMaps[overrideTier] ?? compat;
  },
}));
