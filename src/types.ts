export type LocationType = "home" | "facility";

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

export type PatientFormValues = Omit<Patient, "id" | "createdAt" | "updatedAt">;
