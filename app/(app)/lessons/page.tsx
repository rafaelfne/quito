"use client";

import { useCallback, useEffect, useState } from "react";
import { LessonsView } from "@/app/(app)/lessons/lessons-view";
import { applyLessonsLoad, beginMark, dateKeyOf, finishMark, initialLessons, loadLessonsMonth, nextStatus, persistLessonMark, startLessonsMonth, startReloadingLessons, type LessonStatus, type MakeupLesson, type MonthLesson } from "@/lib/lessons";
import { beginMakeup, changeMakeupDraft, finishMakeup, makeupDateDraft, makeupDateError, persistMakeup, rejectMakeup, type LessonCredit, type MakeupTarget } from "@/lib/makeups";
import { calendarMonthOf, type CalendarMonth } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";

export default function LessonsPage() {
  const [state, setState] = useState(initialLessons(calendarMonthOf(new Date())));
  const { month } = state;
  const today = dateKeyOf(new Date());

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

  function makeUp(credit: LessonCredit) {
    const date = makeupDateDraft(state, credit, today);
    const problem = makeupDateError(credit, date);
    if (problem) {
      setState((current) => rejectMakeup(current, credit, problem));
      return;
    }
    setState((current) => beginMakeup(current, credit, date));
    void persistMakeup(supabase, credit, date).then((saved) => setState((current) => finishMakeup(current, credit, null, saved)));
  }

  function undoMakeup(makeup: MakeupLesson) {
    setState((current) => beginMakeup(current, makeup, null));
    void persistMakeup(supabase, makeup, null).then((saved) => setState((current) => finishMakeup(current, makeup, makeup.date, saved)));
  }

  return (
    <LessonsView
      state={state}
      today={today}
      onMark={mark}
      onChangeMonth={(delta: number) => setState((current) => startLessonsMonth(current, delta))}
      onRetry={retry}
      onChangeMakeupDate={(target: MakeupTarget, date: string) => setState((current) => changeMakeupDraft(current, target, date))}
      onMakeUp={makeUp}
      onUndoMakeup={undoMakeup}
    />
  );
}
