"use client";

import { useCallback, useEffect, useState } from "react";
import { LessonsView } from "@/app/(app)/lessons/lessons-view";
import { applyLessonsLoad, beginMark, dateKeyOf, finishMark, initialLessons, loadLessonsMonth, nextStatus, persistLessonMark, startLessonsMonth, startReloadingLessons, type LessonStatus, type MonthLesson } from "@/lib/lessons";
import { calendarMonthOf, type CalendarMonth } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";

export default function LessonsPage() {
  const [state, setState] = useState(initialLessons(calendarMonthOf(new Date())));
  const { month } = state;

  const load = useCallback((target: CalendarMonth) => {
    void loadLessonsMonth(supabase, target).then((result) => setState((current) => applyLessonsLoad(current, result)));
  }, []);

  useEffect(() => load(month), [load, month]);

  function retry() {
    setState(startReloadingLessons);
    load(month);
  }

  function mark(lesson: MonthLesson, tapped: LessonStatus) {
    const status = nextStatus(lesson, tapped);
    setState((current) => beginMark(current, lesson, status));
    void persistLessonMark(supabase, lesson, status).then((saved) => setState((current) => finishMark(current, lesson, saved)));
  }

  return (
    <LessonsView
      state={state}
      today={dateKeyOf(new Date())}
      onMark={mark}
      onChangeMonth={(delta: number) => setState((current) => startLessonsMonth(current, delta))}
      onRetry={retry}
    />
  );
}
