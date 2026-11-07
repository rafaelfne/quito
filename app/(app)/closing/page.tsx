"use client";

import { useCallback, useEffect, useState } from "react";
import { ClosingView } from "@/app/(app)/closing/closing-view";
import { applyClosingLoad, initialClosing, loadClosingMonth, startClosingMonth, startReloadingClosing } from "@/lib/closing";
import { dateKeyOf } from "@/lib/lessons";
import { calendarMonthOf, type CalendarMonth } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { loadTrainingMonth } from "@/lib/training";

export default function ClosingPage() {
  const [state, setState] = useState(initialClosing(calendarMonthOf(new Date())));
  const [trainingMonth, setTrainingMonth] = useState<CalendarMonth | null>(null);
  const { month } = state;

  const load = useCallback((target: CalendarMonth) => {
    void loadClosingMonth(supabase, target).then((result) => setState((current) => applyClosingLoad(current, result)));
  }, []);

  useEffect(() => load(month), [load, month]);

  useEffect(() => {
    void loadTrainingMonth(supabase).then((result) => setTrainingMonth(result.ok ? result.trainingMonth : null));
  }, []);

  function retry() {
    setState(startReloadingClosing);
    load(month);
  }

  return <ClosingView state={state} today={dateKeyOf(new Date())} onChangeMonth={(delta: number) => setState((current) => startClosingMonth(current, delta))} onRetry={retry} trainingMonth={trainingMonth} />;
}
