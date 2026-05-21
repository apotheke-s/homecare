import { addDays, differenceInCalendarDays, format, isToday, parseISO } from "date-fns";
import type { Patient, Task, TaskType, Visit } from "./types";

export const taskTypeLabels: Record<TaskType, string> = {
  delivery: "配達",
  visit: "訪問",
  doctor: "医師確認",
  nurse: "看護師確認",
  family: "家族連絡",
  oneDose: "一包化準備",
  medicine: "薬剤確認",
  other: "その他"
};

export function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

export function nowString() {
  return new Date().toISOString();
}

export function formatDateLabel(value: string) {
  if (!value) return "未設定";
  return format(parseISO(value), "M月d日");
}

export function calcNextRefillDate(prescriptionDate: string, prescriptionDays: number) {
  if (!prescriptionDate || !prescriptionDays) return "";
  return format(addDays(parseISO(prescriptionDate), prescriptionDays), "yyyy-MM-dd");
}

export function daysUntil(date: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  return differenceInCalendarDays(parseISO(date), new Date());
}

export function isDueToday(date: string) {
  return Boolean(date) && isToday(parseISO(date));
}

export function isPatientHighRisk(patient: Patient, visits: Visit[], tasks: Task[]) {
  const activeVisit = visits.find((visit) => visit.patientId === patient.id && !visit.completed);
  const activeTasks = tasks.filter((task) => task.patientId === patient.id && !task.completed);
  return (
    patient.hasNarcotics ||
    patient.hasColdStorageMedicine ||
    Boolean(activeTasks.find((task) => task.type === "doctor")) ||
    Boolean(activeVisit && activeVisit.remainingDays <= 3)
  );
}

export function requiresActionToday(visit?: Visit, tasks: Task[] = []) {
  return Boolean(
    visit &&
      !visit.completed &&
      (isDueToday(visit.visitDate) || isDueToday(visit.deliveryDate) || visit.remainingDays <= 3)
  ) || tasks.some((task) => !task.completed && isDueToday(task.dueDate));
}
