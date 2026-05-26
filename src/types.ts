export type LocationType = "home" | "facility";

export type BillingMethod = "cash" | "directDebit" | "bankTransfer" | "other" | "";

export type MedicalInstitutionType = "clinic" | "hospital" | "dental" | "other";

export type HomeVisitWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TaskType =
  | "delivery"
  | "visit"
  | "doctor"
  | "nurse"
  | "family"
  | "oneDose"
  | "medicine"
  | "other";

export interface Patient {
  id: string;
  order?: number;
  facilityCalendarSlot?: number;
  mainMedicalInstitutionId?: string;
  additionalMedicalInstitutionIds?: string[];
  lastVisitDate?: string;
  prescriptionDays?: number;
  nextVisitDate?: string;
  isNextVisitDateManual?: boolean;
  name: string;
  kana: string;
  birthday: string;
  locationType: LocationType;
  facilityName: string;
  address: string;
  phone: string;
  doctorName: string;
  nurseContact: string;
  familyContact: string;
  hasOneDosePackage: boolean;
  hasCrushing: boolean;
  hasNarcotics: boolean;
  hasColdStorageMedicine: boolean;
  memo: string;
  billingMethod?: BillingMethod;
  billingName?: string;
  billingMemo?: string;
  billingChecked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalInstitution {
  id: string;
  name: string;
  kana: string;
  type: MedicalInstitutionType;
  phone: string;
  fax: string;
  address: string;
  homeVisitWeekday: HomeVisitWeekday | "";
  memo: string;
  isMainHomeCareClinic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  patientId: string;
  visitDate: string;
  deliveryDate: string;
  homeVisitDate: string;
  dischargeDate: string;
  prescriptionDate: string;
  prescriptionDays: number;
  remainingDays: number;
  nextRefillDate: string;
  memo: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  patientId: string;
  title: string;
  type: TaskType;
  dueDate: string;
  completed: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  patientId: string;
  date: string;
  prescriptionChecked: boolean;
  remainingMedicineChecked: boolean;
  oneDosePackageChecked: boolean;
  adherenceChecked: boolean;
  sideEffectChecked: boolean;
  interactionChecked: boolean;
  conditionChecked: boolean;
  doctorNote: string;
  familyNote: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MedicationCalendarStatus = "notStarted" | "inProgress" | "needsReview" | "completed";

export type MedicationTiming =
  | "morning"
  | "noon"
  | "evening"
  | "bedtime"
  | "wakeup"
  | "asNeeded"
  | "external"
  | "other";

export type DosageForm = "tablet" | "powder" | "magnesium" | "aspark" | "patch" | "kampo" | "other";
export type MedicationPackageChangeType = "none" | "added" | "increased" | "decreased" | "temporary";

export interface MedicationCalendar {
  id: string;
  patientId: string;
  startDate: string;
  endDate: string;
  status: MedicationCalendarStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationCalendarDay {
  id: string;
  calendarId: string;
  date: string;
  morning: string;
  noon: string;
  evening: string;
  bedtime: string;
  wakeup: string;
  asNeeded: string;
  external: string;
  other: string;
  memo: string;
  checked: boolean;
  hasIssue: boolean;
  issueMemo: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationCalendarAudit {
  id: string;
  calendarDayId: string;
  timing: MedicationTiming;
  dateChecked: boolean;
  usageChecked: boolean;
  countChecked: boolean;
  duplicateChecked: boolean;
  missingChecked: boolean;
  temporaryMedicineChecked: boolean;
  stoppedMedicineChecked: boolean;
  remainingAdjustmentChecked: boolean;
  auditorMemo: string;
  auditedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationPackagePattern {
  id: string;
  patientId: string;
  timing: MedicationTiming;
  updatedAt: string;
}

export interface MedicationPackageItem {
  id: string;
  patternId: string;
  order: number;
  dosageForm: DosageForm;
  quantity: string;
  medicineName: string;
  clinicName: string;
  packageChangeType?: MedicationPackageChangeType;
  isAdded?: boolean;
  isChanged?: boolean;
  isTemporary: boolean;
  isStopped: boolean;
  isSelfAdjustment: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationPackagePhoto {
  id: string;
  patientId: string;
  imageDataUrl: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationClinicCutoff {
  id: string;
  patientId: string;
  medicalInstitutionId: string;
  previousCutoffDate: string;
  prescriptionDays: number;
  nextCutoffDate: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export type PatientFormValues = Omit<Patient, "id" | "order" | "createdAt" | "updatedAt">;
