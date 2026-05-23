import Dexie, { type Table } from "dexie";
import { addDays, format, subDays } from "date-fns";
import type {
  Checklist,
  MedicalInstitution,
  MedicationCalendar,
  MedicationCalendarAudit,
  MedicationCalendarDay,
  MedicationPackageItem,
  MedicationPackagePattern,
  Patient,
  Task,
  Visit
} from "./types";
import initialMedicalInstitutions from "./data/medicalInstitutions.json";
import { calcNextRefillDate, createId, nowString, todayString } from "./utils";

class HomecareDatabase extends Dexie {
  patients!: Table<Patient, string>;
  visits!: Table<Visit, string>;
  tasks!: Table<Task, string>;
  checklists!: Table<Checklist, string>;
  medicationCalendars!: Table<MedicationCalendar, string>;
  medicationCalendarDays!: Table<MedicationCalendarDay, string>;
  medicationCalendarAudits!: Table<MedicationCalendarAudit, string>;
  medicationPackagePatterns!: Table<MedicationPackagePattern, string>;
  medicationPackageItems!: Table<MedicationPackageItem, string>;
  medicalInstitutions!: Table<MedicalInstitution, string>;

  constructor() {
    super("homecare-pwa-db");
    this.version(1).stores({
      patients: "id, name, kana, facilityName, updatedAt",
      visits: "id, patientId, visitDate, deliveryDate, nextRefillDate, completed",
      tasks: "id, patientId, type, dueDate, completed",
      checklists: "id, patientId, date, completed"
    });
    this.version(2).stores({
      patients: "id, name, kana, facilityName, updatedAt",
      visits: "id, patientId, visitDate, deliveryDate, nextRefillDate, completed",
      tasks: "id, patientId, type, dueDate, completed",
      checklists: "id, patientId, date, completed",
      medicationCalendars: "id, patientId, startDate, endDate, status, updatedAt",
      medicationCalendarDays: "id, calendarId, date, checked, hasIssue",
      medicationCalendarAudits: "id, calendarDayId, timing, auditedAt"
    });
    this.version(3)
      .stores({
        patients: "id, order, name, kana, facilityName, updatedAt",
        visits: "id, patientId, visitDate, deliveryDate, nextRefillDate, completed",
        tasks: "id, patientId, type, dueDate, completed",
        checklists: "id, patientId, date, completed",
        medicationCalendars: "id, patientId, startDate, endDate, status, updatedAt",
        medicationCalendarDays: "id, calendarId, date, checked, hasIssue",
        medicationCalendarAudits: "id, calendarDayId, timing, auditedAt",
        medicationPackagePatterns: "id, patientId, timing, updatedAt",
        medicationPackageItems: "id, patternId, order, dosageForm, clinicName, updatedAt"
      })
      .upgrade(async (tx) => {
        let order = 0;
        await tx.table("patients").toCollection().modify((patient) => {
          if (patient.order === undefined) {
            patient.order = order;
            order += 1;
          }
        });
      });
    this.version(4)
      .stores({
        patients: "id, order, name, kana, facilityName, mainMedicalInstitutionId, updatedAt",
        visits: "id, patientId, visitDate, deliveryDate, nextRefillDate, completed",
        tasks: "id, patientId, type, dueDate, completed",
        checklists: "id, patientId, date, completed",
        medicationCalendars: "id, patientId, startDate, endDate, status, updatedAt",
        medicationCalendarDays: "id, calendarId, date, checked, hasIssue",
        medicationCalendarAudits: "id, calendarDayId, timing, auditedAt",
        medicationPackagePatterns: "id, patientId, timing, updatedAt",
        medicationPackageItems: "id, patternId, order, dosageForm, clinicName, updatedAt",
        medicalInstitutions: "id, name, kana, type, isMainHomeCareClinic, updatedAt"
      })
      .upgrade(async (tx) => {
        await tx.table("patients").toCollection().modify((patient) => {
          if (patient.mainMedicalInstitutionId === undefined) {
            patient.mainMedicalInstitutionId = "";
          }
          if (!Array.isArray(patient.additionalMedicalInstitutionIds)) {
            patient.additionalMedicalInstitutionIds = [];
          }
        });
      });
  }
}

export const db = new HomecareDatabase();

export async function seedSampleData() {
  await seedMedicalInstitutions();

  const patientCount = await db.patients.count();
  if (patientCount > 0) return;

  const now = nowString();
  const today = todayString();
  const prescriptionDate = format(subDays(new Date(), 11), "yyyy-MM-dd");
  const patientId = createId();

  const calendarId = createId();
  const firstDayId = createId();

  await db.transaction(
    "rw",
    [
      db.patients,
      db.visits,
      db.tasks,
      db.checklists,
      db.medicationCalendars,
      db.medicationCalendarDays,
      db.medicationCalendarAudits,
      db.medicationPackagePatterns,
      db.medicationPackageItems
    ],
    async () => {
    await db.patients.add({
      id: patientId,
      order: 0,
      mainMedicalInstitutionId: "sato-clinic",
      additionalMedicalInstitutionIds: ["midori-hospital"],
      name: "山田太郎",
      kana: "ヤマダタロウ",
      birthday: "1944-04-12",
      locationType: "facility",
      facilityName: "さくらホーム",
      address: "東京都千代田区1-1-1",
      phone: "03-0000-0000",
      doctorName: "佐藤医師",
      nurseContact: "訪問看護ステーションみどり",
      familyContact: "山田花子 090-0000-0000",
      hasOneDosePackage: true,
      hasCrushing: false,
      hasNarcotics: false,
      hasColdStorageMedicine: false,
      memo: "血圧変動あり。残薬確認を優先。",
      createdAt: now,
      updatedAt: now
    });

    await db.visits.add({
      id: createId(),
      patientId,
      visitDate: today,
      deliveryDate: format(addDays(new Date(), 2), "yyyy-MM-dd"),
      homeVisitDate: "",
      dischargeDate: "",
      prescriptionDate,
      prescriptionDays: 14,
      remainingDays: 3,
      nextRefillDate: calcNextRefillDate(prescriptionDate, 14),
      memo: "次回訪問時に残薬と副作用を確認。",
      completed: false,
      createdAt: now,
      updatedAt: now
    });

    await db.tasks.add({
      id: createId(),
      patientId,
      title: "眠気について医師確認",
      type: "doctor",
      dueDate: today,
      completed: false,
      memo: "前回訪問時に日中の眠気あり。",
      createdAt: now,
      updatedAt: now
    });

    await db.checklists.add({
      id: createId(),
      patientId,
      date: today,
      prescriptionChecked: false,
      remainingMedicineChecked: false,
      oneDosePackageChecked: false,
      adherenceChecked: false,
      sideEffectChecked: false,
      interactionChecked: false,
      conditionChecked: false,
      doctorNote: "",
      familyNote: "",
      completed: false,
      createdAt: now,
      updatedAt: now
    });

    await db.medicationCalendars.add({
      id: calendarId,
      patientId,
      startDate: today,
      endDate: format(addDays(new Date(), 6), "yyyy-MM-dd"),
      status: "inProgress",
      memo: "退院後初回セット。残薬調整あり。",
      createdAt: now,
      updatedAt: now
    });

    await db.medicationCalendarDays.add({
      id: firstDayId,
      calendarId,
      date: today,
      morning: "朝食後 一包化 1包",
      noon: "昼食後 一包化 1包",
      evening: "夕食後 一包化 1包",
      bedtime: "",
      wakeup: "",
      asNeeded: "疼痛時 頓服",
      external: "",
      other: "",
      memo: "残薬調整を確認",
      checked: false,
      hasIssue: true,
      issueMemo: "残薬調整の反映確認が必要",
      createdAt: now,
      updatedAt: now
    });

    await db.medicationCalendarAudits.add({
      id: createId(),
      calendarDayId: firstDayId,
      timing: "morning",
      dateChecked: false,
      usageChecked: false,
      countChecked: false,
      duplicateChecked: false,
      missingChecked: false,
      temporaryMedicineChecked: false,
      stoppedMedicineChecked: false,
      remainingAdjustmentChecked: false,
      auditorMemo: "",
      auditedAt: "",
      createdAt: now,
      updatedAt: now
    });

    const patternEntries: MedicationPackagePattern[] = [
      { id: createId(), patientId, timing: "morning", updatedAt: now },
      { id: createId(), patientId, timing: "noon", updatedAt: now },
      { id: createId(), patientId, timing: "evening", updatedAt: now },
      { id: createId(), patientId, timing: "bedtime", updatedAt: now }
    ];
    await db.medicationPackagePatterns.bulkAdd(patternEntries);
    const morningPattern = patternEntries.find((pattern) => pattern.timing === "morning")!;
    const eveningPattern = patternEntries.find((pattern) => pattern.timing === "evening")!;
    const bedtimePattern = patternEntries.find((pattern) => pattern.timing === "bedtime")!;
    await db.medicationPackageItems.bulkAdd([
      {
        id: createId(),
        patternId: morningPattern.id,
        order: 0,
        dosageForm: "tablet",
        quantity: "3",
        medicineName: "",
        clinicName: "佐藤クリニック",
        isTemporary: false,
        isStopped: false,
        isSelfAdjustment: false,
        memo: "",
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        patternId: morningPattern.id,
        order: 1,
        dosageForm: "powder",
        quantity: "1",
        medicineName: "",
        clinicName: "佐藤クリニック",
        isTemporary: false,
        isStopped: false,
        isSelfAdjustment: false,
        memo: "",
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        patternId: morningPattern.id,
        order: 2,
        dosageForm: "magnesium",
        quantity: "",
        medicineName: "",
        clinicName: "佐藤クリニック",
        isTemporary: false,
        isStopped: false,
        isSelfAdjustment: true,
        memo: "自己調節",
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        patternId: eveningPattern.id,
        order: 0,
        dosageForm: "tablet",
        quantity: "3",
        medicineName: "",
        clinicName: "佐藤クリニック",
        isTemporary: false,
        isStopped: false,
        isSelfAdjustment: false,
        memo: "",
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        patternId: bedtimePattern.id,
        order: 0,
        dosageForm: "tablet",
        quantity: "1",
        medicineName: "",
        clinicName: "佐藤クリニック",
        isTemporary: false,
        isStopped: false,
        isSelfAdjustment: false,
        memo: "",
        createdAt: now,
        updatedAt: now
      }
    ]);
    }
  );
}

async function seedMedicalInstitutions() {
  const institutionCount = await db.medicalInstitutions.count();
  if (institutionCount > 0) return;

  await db.medicalInstitutions.bulkPut(initialMedicalInstitutions as MedicalInstitution[]);
}
