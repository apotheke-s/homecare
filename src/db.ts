import Dexie, { type Table } from "dexie";
import { addDays, format, subDays } from "date-fns";
import type { Checklist, Patient, Task, Visit } from "./types";
import { calcNextRefillDate, createId, nowString, todayString } from "./utils";

class HomecareDatabase extends Dexie {
  patients!: Table<Patient, string>;
  visits!: Table<Visit, string>;
  tasks!: Table<Task, string>;
  checklists!: Table<Checklist, string>;

  constructor() {
    super("homecare-pwa-db");
    this.version(1).stores({
      patients: "id, name, kana, facilityName, updatedAt",
      visits: "id, patientId, visitDate, deliveryDate, nextRefillDate, completed",
      tasks: "id, patientId, type, dueDate, completed",
      checklists: "id, patientId, date, completed"
    });
  }
}

export const db = new HomecareDatabase();

export async function seedSampleData() {
  const patientCount = await db.patients.count();
  if (patientCount > 0) return;

  const now = nowString();
  const today = todayString();
  const prescriptionDate = format(subDays(new Date(), 11), "yyyy-MM-dd");
  const patientId = createId();

  await db.transaction("rw", db.patients, db.visits, db.tasks, db.checklists, async () => {
    await db.patients.add({
      id: patientId,
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
  });
}
