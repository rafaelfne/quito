import Link from "next/link";
import { Button } from "@/components/ui/button";
import { accountPath } from "@/lib/account";
import { formatCurrency } from "@/lib/billing";
import { chargesPath } from "@/lib/charges";
import {
  buildMonthClosing,
  closingMessages,
  describeMissingBillingWarning,
  describeSignedAmount,
  describeUnmarked,
  describeValueWarning,
  type ClosingData,
  type ClosingState,
  type GuardianClosing,
  type StudentClosing,
} from "@/lib/closing";
import { describeMonth, lessonsPath } from "@/lib/lessons";
import { paymentSettingsPath } from "@/lib/payment-settings";
import type { CalendarMonth } from "@/lib/schedule";
import { formatPhone, studentsPath } from "@/lib/students";
import { teacherRulesPath } from "@/lib/teacher-rules";
import { describeTrainingClosing, isTrainingMonth, trainingMessages } from "@/lib/training";

type ClosingViewProps = {
  state: ClosingState;
  today: string;
  onChangeMonth: (delta: number) => void;
  onRetry: () => void;
  trainingMonth?: CalendarMonth | null;
};

type ClosingLabels = { monthTotal: string; guardianTotal: string; badge: string | null };

const billedLabels: ClosingLabels = { monthTotal: closingMessages.monthTotal, guardianTotal: closingMessages.guardianTotal, badge: null };

const trainingLabels: ClosingLabels = { monthTotal: trainingMessages.monthTotal, guardianTotal: trainingMessages.guardianTotal, badge: trainingMessages.badge };

function StudentAccount({ student }: { student: StudentClosing }) {
  return (
    <li className="flex flex-col gap-2 border-t pt-3">
      <h3 className="font-medium break-words">{student.studentName}</h3>
      {student.missingBilling ? (
        <p className="text-sm">
          {closingMessages.missingBilling}{" "}
          <Link className="underline" href={studentsPath}>
            Definir em Alunos
          </Link>
        </p>
      ) : (
        <dl className="flex flex-col gap-1 text-sm">
          {student.lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 break-words">{line.label}</dt>
              <dd className="shrink-0 tabular-nums">{describeSignedAmount(line.cents)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-sm">{student.attendance}</p>
      {student.packageBalance ? <p className="text-sm">{student.packageBalance}</p> : null}
      {student.unmarked > 0 ? <p className="text-sm">{describeUnmarked(student.unmarked)}</p> : null}
      {student.credits.length > 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          <p>{closingMessages.creditsTitle}:</p>
          <ul className="list-disc pl-5">
            {student.credits.map((credit) => (
              <li key={credit}>{credit}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function GuardianCard({ guardian, labels }: { guardian: GuardianClosing; labels: ClosingLabels }) {
  return (
    <section className="flex flex-col gap-3 rounded-sm border p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 font-semibold break-words">{guardian.guardianName}</h2>
          {labels.badge ? <span className="shrink-0 rounded-sm border px-2 text-xs font-medium">{labels.badge}</span> : null}
        </div>
        <p className="text-sm">{formatPhone(guardian.phone)}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {guardian.students.map((student) => (
          <StudentAccount key={student.studentId} student={student} />
        ))}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t pt-3 font-semibold">
        <span>{labels.guardianTotal}</span>
        <span className="tabular-nums">{formatCurrency(guardian.totalCents)}</span>
      </p>
    </section>
  );
}

function ClosingContent({ data, month, today, trainingMonth }: { data: ClosingData; month: CalendarMonth; today: string; trainingMonth: CalendarMonth | null }) {
  const closing = buildMonthClosing(data, month, today);
  const training = trainingMonth !== null && isTrainingMonth(month, trainingMonth);
  const labels = training ? trainingLabels : billedLabels;
  if (closing.guardians.length === 0) {
    return (
      <p className="text-sm">
        {closingMessages.noStudents}{" "}
        <Link className="underline" href={studentsPath}>
          Abrir Alunos
        </Link>
      </p>
    );
  }
  return (
    <>
      {training ? (
        <p className="rounded-sm border p-3 text-sm" role="note">
          {describeTrainingClosing(trainingMonth)}
        </p>
      ) : null}
      <p className="flex items-baseline justify-between gap-3 text-lg font-semibold">
        <span>{labels.monthTotal}</span>
        <span className="tabular-nums">{formatCurrency(closing.totalCents)}</span>
      </p>
      {closing.unmarkedAffectingValue > 0 ? (
        <p className="text-sm">
          {describeValueWarning(closing.unmarkedAffectingValue)}{" "}
          <Link className="underline" href={lessonsPath}>
            Marcar em Aulas
          </Link>
        </p>
      ) : null}
      {closing.missingBilling > 0 ? <p className="text-sm">{describeMissingBillingWarning(closing.missingBilling)}</p> : null}
      {closing.guardians.map((guardian) => (
        <GuardianCard key={guardian.phone} guardian={guardian} labels={labels} />
      ))}
    </>
  );
}

export function ClosingView({ state, today, onChangeMonth, onRetry, trainingMonth = null }: ClosingViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Fechamento</h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="text-sm underline" href={studentsPath}>
            Alunos
          </Link>
          <Link className="text-sm underline" href={lessonsPath}>
            Aulas
          </Link>
          <Link className="text-sm underline" href={teacherRulesPath}>
            Regras
          </Link>
          <Link className="text-sm underline" href={paymentSettingsPath}>
            Recebimento
          </Link>
          <Link className="text-sm underline" href={chargesPath}>
            Cobranças
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" type="button" aria-label="Mês anterior" onClick={() => onChangeMonth(-1)}>
          ←
        </Button>
        <p className="font-medium" aria-live="polite">
          {describeMonth(state.month)}
        </p>
        <Button variant="outline" size="icon" type="button" aria-label="Mês seguinte" onClick={() => onChangeMonth(1)}>
          →
        </Button>
      </div>
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="alert">
            {closingMessages.loadFailed}
          </p>
          <Button variant="outline" type="button" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      {state.status === "ready" && state.data ? <ClosingContent data={state.data} month={state.month} today={today} trainingMonth={trainingMonth} /> : null}
    </main>
  );
}
