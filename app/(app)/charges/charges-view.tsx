import Link from "next/link";
import type { ReactNode } from "react";
import { accountPath } from "@/lib/account";
import { formatCurrency } from "@/lib/billing";
import { canSendCharge, chargeMessages, describeMarkLessons, describeOpenFor, describeReadyFor, groupCharges, isChargePaid, isChargeSent, isDueToSend, isReminderDue, isTrainingCharges, needsFirstPreview, describeWaitingStudent, monthChargesTotal, reminderMessageOf, reminderProgressOf, remindersSentOf, waitsForBilling, waitsForMarks, type Charge, type ChargesState, type ChargeStudent, type WaitingGuardian } from "@/lib/charges";
import { closingMessages, closingPath, describeSignedAmount } from "@/lib/closing";
import { describeMonth, lessonsPath, lessonsPathFor } from "@/lib/lessons";
import { whatsAppLinkFor } from "@/lib/charge-sending";
import { paymentSettingsPath } from "@/lib/payment-settings";
import { describeReminderDay, describeReminderName, type ReminderProgress } from "@/lib/reminders";
import type { CalendarMonth } from "@/lib/schedule";
import { formatPhone, studentsPath } from "@/lib/students";
import { teacherRulesPath } from "@/lib/teacher-rules";
import { describeTrainingCharges } from "@/lib/training";

const secondaryButtonClass = "min-h-11 rounded-sm border px-3 py-2 disabled:opacity-50";

const shortcutClass = "inline-flex min-h-11 items-center rounded-sm border px-3 py-2 text-sm";

type ChargesViewProps = {
  state: ChargesState;
  onRetry: () => void;
  onConfirmPreview: () => void;
  onSend: (chargeId: string) => void;
  onUndoSend: (chargeId: string) => void;
  onMarkPaid: (chargeId: string) => void;
  onUndoPaid: (chargeId: string) => void;
  onSendReminder: (chargeId: string) => void;
  onUndoReminder: (chargeId: string) => void;
};

type Sending = {
  readyFor: string | null;
  link: string | null;
  saving: boolean;
  canUndo: boolean;
  onSend: () => void;
  onUndo: () => void;
};

type Reminding = {
  progress: ReminderProgress | null;
  due: boolean;
  message: string | undefined;
  link: string | null;
  saving: boolean;
  onSend: () => void;
  onUndo: () => void;
};

type Payment = {
  saving: boolean;
  onMarkPaid: () => void;
  onUndo: () => void;
};

type FirstPreview = {
  confirming: boolean;
  onConfirm: () => void;
};

function StudentAccount({ student }: { student: ChargeStudent }) {
  return (
    <li className="flex flex-col gap-2 border-t pt-3">
      <h3 className="font-medium break-words">{student.studentName}</h3>
      <dl className="flex flex-col gap-1 text-sm">
        {student.lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 break-words">{line.label}</dt>
            <dd className="shrink-0 tabular-nums">{describeSignedAmount(line.cents)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm">{student.attendance}</p>
      {student.packageBalance ? <p className="text-sm">{student.packageBalance}</p> : null}
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

function ConfirmPreview({ confirming, onConfirm }: FirstPreview) {
  return (
    <button className={secondaryButtonClass} type="button" disabled={confirming} onClick={onConfirm}>
      {confirming ? chargeMessages.confirmingPreview : chargeMessages.confirmPreview}
    </button>
  );
}

const primaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-3 py-2 font-medium text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50";

function SendCharge({ charge, sending }: { charge: Charge; sending: Sending }) {
  if (isChargePaid(charge)) return null;
  if (isChargeSent(charge)) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm">
        <p className="font-medium">{chargeMessages.sent}</p>
        {sending.canUndo ? (
          <>
            <p>{chargeMessages.undoHint}</p>
            <button className={secondaryButtonClass} type="button" disabled={sending.saving} onClick={sending.onUndo}>
              {sending.saving ? chargeMessages.savingSend : chargeMessages.undoSend}
            </button>
          </>
        ) : null}
      </div>
    );
  }
  if (sending.readyFor) return <p className="text-sm">{chargeMessages.sendOnDueDay}</p>;
  if (!sending.link) return null;
  return (
    <a className={primaryButtonClass} href={sending.link} target="_blank" rel="noopener noreferrer" aria-disabled={sending.saving} onClick={sending.onSend}>
      {sending.saving ? chargeMessages.savingSend : chargeMessages.sendOnWhatsApp}
    </a>
  );
}

function NextReminder({ progress, reminding }: { progress: ReminderProgress; reminding: Reminding }) {
  if (progress.next === null) return progress.sent > 0 ? <p>{chargeMessages.allRemindersSent}</p> : null;
  const name = describeReminderName(progress.next.index, progress.total);
  if (!reminding.due || reminding.message === undefined || reminding.link === null) return <p>{`${name} no dia ${describeReminderDay(progress.next.due)}.`}</p>;
  return (
    <>
      <h3 className="font-medium">{`${name} ${chargeMessages.reminderToday}`}</h3>
      <p className="w-full rounded-sm border p-3 break-words whitespace-pre-wrap">{reminding.message}</p>
      <a className={primaryButtonClass} href={reminding.link} target="_blank" rel="noopener noreferrer" aria-disabled={reminding.saving} onClick={reminding.onSend}>
        {reminding.saving ? chargeMessages.savingReminder : chargeMessages.sendReminder}
      </a>
    </>
  );
}

function ChargeReminders({ reminding }: { reminding: Reminding }) {
  const { progress } = reminding;
  if (progress === null || (progress.total === 0 && progress.sent === 0)) return null;
  return (
    <div className="flex flex-col items-start gap-2 border-t pt-3 text-sm">
      <NextReminder progress={progress} reminding={reminding} />
      {progress.lastSentIndex !== null ? (
        <>
          <p>{`Lembrete ${progress.lastSentIndex + 1} enviado.`}</p>
          <button className={secondaryButtonClass} type="button" disabled={reminding.saving} onClick={reminding.onUndo}>
            {reminding.saving ? chargeMessages.savingReminder : chargeMessages.undoReminder}
          </button>
        </>
      ) : null}
    </div>
  );
}

function ChargePayment({ charge, payment }: { charge: Charge; payment: Payment }) {
  if (isChargePaid(charge)) {
    return (
      <div className="flex flex-col items-start gap-2 border-t pt-3 text-sm">
        <p className="font-medium">{chargeMessages.paid}</p>
        <p>{chargeMessages.paidHint}</p>
        <button className={secondaryButtonClass} type="button" disabled={payment.saving} onClick={payment.onUndo}>
          {payment.saving ? chargeMessages.savingPayment : chargeMessages.undoPaid}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2 border-t pt-3">
      <button className={secondaryButtonClass} type="button" disabled={payment.saving} onClick={payment.onMarkPaid}>
        {payment.saving ? chargeMessages.savingPayment : chargeMessages.markPaid}
      </button>
    </div>
  );
}

function ChargeMessage({ charge, message, firstPreview, sending }: { charge: Charge; message: string | undefined; firstPreview: FirstPreview | null; sending: Sending }) {
  if (message === undefined) {
    return (
      <div className="flex flex-col items-start gap-2 border-t pt-3 text-sm">
        <p>{chargeMessages.messageNeedsPayment}</p>
        <Link className={shortcutClass} href={paymentSettingsPath}>
          {chargeMessages.fillPayment}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <h3 className="font-medium">{chargeMessages.messageTitle}</h3>
      <p className="rounded-sm border p-3 text-sm break-words whitespace-pre-wrap">{message}</p>
      {firstPreview ? <ConfirmPreview {...firstPreview} /> : null}
      <SendCharge charge={charge} sending={sending} />
    </div>
  );
}

type ChargeCardProps = { charge: Charge; message: string | undefined; openFor: string | null; firstPreview: FirstPreview | null; sending: Sending; reminding: Reminding; payment: Payment };

function ChargeCard({ charge, message, openFor, firstPreview, sending, reminding, payment }: ChargeCardProps) {
  const badge = sending.readyFor ?? openFor;
  return (
    <section className="flex flex-col gap-3 rounded-sm border p-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold break-words">{charge.guardian_name}</h2>
          {badge ? <p className="rounded-sm border px-2 py-1 text-sm font-medium">{badge}</p> : null}
        </div>
        <p className="text-sm">{formatPhone(charge.guardian_phone)}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {charge.account.map((student) => (
          <StudentAccount key={student.studentId} student={student} />
        ))}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t pt-3 font-semibold">
        <span>{chargeMessages.guardianTotal}</span>
        <span className="tabular-nums">{formatCurrency(charge.total_cents)}</span>
      </p>
      {charge.total_cents === 0 ? (
        <p className="text-sm">{chargeMessages.coveredByAdjustment}</p>
      ) : (
        <>
          <ChargeMessage charge={charge} message={message} firstPreview={firstPreview} sending={sending} />
          <ChargeReminders reminding={reminding} />
          <ChargePayment charge={charge} payment={payment} />
        </>
      )}
    </section>
  );
}

function GuardianNames({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <h2 className="font-medium">{title}</h2>
      <ul className="list-disc pl-5">
        {names.map((name) => (
          <li key={name} className="break-words">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WaitingCharges({ waiting, month }: { waiting: WaitingGuardian[]; month: CalendarMonth }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{chargeMessages.waitingTitle}</h2>
      <ul className="flex flex-col gap-3 text-sm">
        {waiting.map((guardian) => (
          <li key={guardian.phone} className="flex flex-col gap-1">
            <h3 className="font-medium break-words">{guardian.guardianName}</h3>
            <ul className="list-disc pl-5">
              {guardian.students.map((student) => (
                <li key={student.studentId} className="break-words">
                  {student.studentName}: {describeWaitingStudent(student)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {waitsForMarks(waiting) ? (
          <Link className={shortcutClass} href={lessonsPathFor(month)}>
            {describeMarkLessons(month)}
          </Link>
        ) : null}
        {waitsForBilling(waiting) ? (
          <Link className={shortcutClass} href={studentsPath}>
            {chargeMessages.defineBilling}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

type ChargesContentProps = Omit<ChargesViewProps, "onRetry">;

type SendTargets = { readyFor: string | null; link: string | null };

function sendTargetsFor(state: ChargesState, charge: Charge): SendTargets {
  const due = state.dueDates[charge.id];
  const message = state.messages[charge.id];
  if (isChargePaid(charge) || isChargeSent(charge) || due === undefined || message === undefined) return { readyFor: null, link: null };
  if (!isDueToSend(state, charge.id)) return { readyFor: describeReadyFor(due), link: null };
  return { readyFor: null, link: canSendCharge(state, charge.id) ? whatsAppLinkFor(charge.guardian_phone, message) : null };
}

function remindingFor(state: ChargesState, charge: Charge): Omit<Reminding, "onSend" | "onUndo"> {
  const progress = reminderProgressOf(state, charge);
  const due = progress !== null && isReminderDue(state, progress);
  const message = progress?.next ? reminderMessageOf(state, charge.id, progress.next.index) : undefined;
  return { progress, due, message, link: due && message !== undefined ? whatsAppLinkFor(charge.guardian_phone, message) : null, saving: state.savingReminders.includes(charge.id) };
}

function ChargeGroup({ title, total, children }: { title: string; total: number | null; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between gap-3 text-lg font-semibold">
        <span>{title}</span>
        {total === null ? null : <span className="tabular-nums">{formatCurrency(total)}</span>}
      </h2>
      {children}
    </section>
  );
}

function ChargesContent({ state, onConfirmPreview, onSend, onUndoSend, onMarkPaid, onUndoPaid, onSendReminder, onUndoReminder }: ChargesContentProps) {
  const { month, charges, waiting, nothingToCharge, messages } = state;
  const firstPreview = needsFirstPreview(state) ? { confirming: state.confirmingPreview, onConfirm: onConfirmPreview } : null;
  if (isTrainingCharges(state) && state.trainingMonth) return <p className="text-sm">{describeTrainingCharges(state.trainingMonth)}</p>;
  if (charges.length === 0 && waiting.length === 0 && nothingToCharge.length === 0) return <p className="text-sm">{chargeMessages.empty}</p>;
  const groups = groupCharges(state);
  const card = (charge: Charge) => (
    <ChargeCard
      key={charge.id}
      charge={charge}
      message={messages[charge.id]}
      openFor={describeOpenFor(state, charge)}
      firstPreview={firstPreview}
      sending={{ ...sendTargetsFor(state, charge), saving: state.savingSends.includes(charge.id), canUndo: remindersSentOf(charge).length === 0, onSend: () => onSend(charge.id), onUndo: () => onUndoSend(charge.id) }}
      reminding={{ ...remindingFor(state, charge), onSend: () => onSendReminder(charge.id), onUndo: () => onUndoReminder(charge.id) }}
      payment={{ saving: state.savingPayments.includes(charge.id), onMarkPaid: () => onMarkPaid(charge.id), onUndo: () => onUndoPaid(charge.id) }}
    />
  );
  return (
    <>
      {[state.previewMessage, state.sendMessage, state.paymentMessage, state.reminderNotice].map((alert) =>
        alert ? (
          <p key={alert} className="text-sm" role="alert">
            {alert}
          </p>
        ) : null,
      )}
      {charges.length > 0 ? (
        <ChargeGroup title={chargeMessages.todayTitle} total={null}>
          {firstPreview && groups.today.length > 0 ? <p className="rounded-sm border p-3 text-sm">{chargeMessages.previewFirst}</p> : null}
          {groups.today.length > 0 ? groups.today.map(card) : <p className="text-sm">{chargeMessages.nothingToday}</p>}
        </ChargeGroup>
      ) : null}
      {waiting.length > 0 ? <WaitingCharges waiting={waiting} month={month} /> : null}
      {charges.length > 0 ? (
        <>
          <p className="flex items-baseline justify-between gap-3 text-lg font-semibold">
            <span>{chargeMessages.monthTotal}</span>
            <span className="tabular-nums">{formatCurrency(monthChargesTotal(charges))}</span>
          </p>
          <p className="text-sm">{chargeMessages.frozen}</p>
          {firstPreview && groups.today.length === 0 ? <p className="rounded-sm border p-3 text-sm">{chargeMessages.previewFirst}</p> : null}
        </>
      ) : null}
      {groups.open.length > 0 ? (
        <ChargeGroup title={chargeMessages.openTitle} total={monthChargesTotal(groups.open)}>
          {groups.open.map(card)}
        </ChargeGroup>
      ) : null}
      {groups.paid.length > 0 ? (
        <ChargeGroup title={chargeMessages.paidTitle} total={monthChargesTotal(groups.paid)}>
          {groups.paid.map(card)}
        </ChargeGroup>
      ) : null}
      {groups.covered.length > 0 ? (
        <ChargeGroup title={chargeMessages.coveredTitle} total={null}>
          {groups.covered.map(card)}
        </ChargeGroup>
      ) : null}
      {nothingToCharge.length > 0 ? <GuardianNames title={chargeMessages.nothingToChargeTitle} names={nothingToCharge} /> : null}
    </>
  );
}

export function ChargesView({ state, onRetry, ...actions }: ChargesViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Cobranças</h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="text-sm underline" href={studentsPath}>
            Alunos
          </Link>
          <Link className="text-sm underline" href={lessonsPath}>
            Aulas
          </Link>
          <Link className="text-sm underline" href={closingPath}>
            Fechamento
          </Link>
          <Link className="text-sm underline" href={teacherRulesPath}>
            Regras
          </Link>
          <Link className="text-sm underline" href={paymentSettingsPath}>
            Recebimento
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      <p className="font-medium">{describeMonth(state.month)}</p>
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="alert">
            {chargeMessages.loadFailed}
          </p>
          <button className={secondaryButtonClass} type="button" onClick={onRetry}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? <ChargesContent state={state} {...actions} /> : null}
    </main>
  );
}
