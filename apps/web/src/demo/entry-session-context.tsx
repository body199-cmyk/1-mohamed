"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { createEntryState, reduceEntry, type EntryAction, type TripDraft } from "@ledger/trip-entry";

function useEntrySessionState() {
  const [state, setState] = useState(() => createEntryState("2026-11-04"));
  const [baseline, setBaseline] = useState<TripDraft>(state.tripDraft);
  const [submitted, setSubmitted] = useState(false);
  const submissionLock = useRef(false);
  const currentState = useRef(state);

  const dispatch = (action: EntryAction) => {
    if (submissionLock.current && (action.type.startsWith("EDIT_TRIP") || action.type === "SET_TRIP_SAME_RATE")) return;
    const result = reduceEntry(currentState.current, action);
    if (!result.ok) return;
    currentState.current = result.state;
    setState(result.state);
    if (action.type === "START_NEW_TRIP") {
      setBaseline(result.state.tripDraft);
      setSubmitted(false);
      submissionLock.current = false;
    }
  };
  const dirty = !submitted && (Object.keys(baseline) as (keyof TripDraft)[])
    .some(key => state.tripDraft[key] !== baseline[key]);
  const claimSubmission = () => {
    if (submissionLock.current) return false;
    submissionLock.current = true;
    setSubmitted(true);
    return true;
  };
  return { state, dispatch, dirty, submitted, claimSubmission };
}

const EntrySessionContext = createContext<ReturnType<typeof useEntrySessionState> | null>(null);
export function EntrySessionProvider({ children }: { children: ReactNode }) {
  const value = useEntrySessionState();
  return <EntrySessionContext.Provider value={value}>{children}</EntrySessionContext.Provider>;
}
export function useEntrySession() {
  const context = useContext(EntrySessionContext);
  if (!context) throw new Error("EntrySessionProvider is required");
  return context;
}
