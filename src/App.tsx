import { useEffect, useId, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  GripVertical,
  Home,
  Menu,
  MessageSquareText,
  Package,
  Pill,
  Plus,
  Save,
  Search,
  Settings,
  Stethoscope,
  UserRound,
  UsersRound
} from "lucide-react";
import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import { db, seedSampleData } from "./db";
import initialMedicalInstitutions from "./data/medicalInstitutions.json";
import type {
  Checklist,
  BillingMethod,
  HomeVisitWeekday,
  MedicalInstitution,
  MedicalInstitutionType,
  MedicationCalendar,
  MedicationCalendarAudit,
  MedicationCalendarDay,
  MedicationCalendarStatus,
  MedicationClinicCutoff,
  MedicationTiming,
  DosageForm,
  MedicationPackageItem,
  MedicationPackagePhoto,
  MedicationPackagePattern,
  Patient,
  PatientFormValues,
  Task,
  TaskType,
  Visit
} from "./types";
import {
  calcNextRefillDate,
  createId,
  daysUntil,
  formatDateLabel,
  isDueToday,
  isPatientHighRisk,
  nowString,
  requiresActionToday,
  taskTypeLabels,
  todayString
} from "./utils";

type AppData = {
  patients: Patient[];
  visits: Visit[];
  tasks: Task[];
  checklists: Checklist[];
  medicationCalendars: MedicationCalendar[];
  medicationCalendarDays: MedicationCalendarDay[];
  medicationCalendarAudits: MedicationCalendarAudit[];
  medicationPackagePatterns: MedicationPackagePattern[];
  medicationPackageItems: MedicationPackageItem[];
  medicationPackagePhotos: MedicationPackagePhoto[];
  medicationClinicCutoffs: MedicationClinicCutoff[];
  medicalInstitutions: MedicalInstitution[];
};

type PatientDetailTab = "basic" | "schedule" | "tasks" | "checklist" | "medication" | "billing" | "other";

const medicationTimingLabels: Record<MedicationTiming, string> = {
  morning: "朝",
  noon: "昼",
  evening: "夕",
  bedtime: "寝る前",
  wakeup: "起床時",
  asNeeded: "頓服",
  external: "外用",
  other: "その他"
};

const medicationCoreTimings: MedicationTiming[] = ["morning", "noon", "evening", "bedtime"];
const medicationLineLabelColors: Partial<Record<MedicationTiming, string>> = {
  morning: "text-rose-700",
  noon: "text-yellow-600",
  evening: "text-blue-700",
  bedtime: "text-purple-700"
};
const medicationTimingTabClasses: Partial<Record<MedicationTiming, { active: string; inactive: string }>> = {
  morning: {
    active: "border-rose-700 bg-rose-700 text-white",
    inactive: "border-rose-200 bg-rose-50 text-rose-700"
  },
  noon: {
    active: "border-yellow-500 bg-yellow-400 text-slate-950",
    inactive: "border-yellow-200 bg-yellow-50 text-yellow-700"
  },
  evening: {
    active: "border-blue-700 bg-blue-700 text-white",
    inactive: "border-blue-200 bg-blue-50 text-blue-700"
  },
  bedtime: {
    active: "border-purple-700 bg-purple-700 text-white",
    inactive: "border-purple-200 bg-purple-50 text-purple-700"
  }
};
const medicationEditableTimings: MedicationTiming[] = [
  "morning",
  "noon",
  "evening",
  "bedtime",
  "wakeup",
  "asNeeded",
  "external",
  "other"
];

const dosageFormLabels: Record<DosageForm, string> = {
  tablet: "錠",
  powder: "粉",
  magnesium: "カマグ",
  aspark: "アスK",
  patch: "貼付",
  kampo: "漢方",
  other: "その他"
};

const packageFlagLabels = {
  isAdded: "追加",
  isChanged: "変更",
  isTemporary: "臨時"
} as const;

type PackageFlagKey = keyof typeof packageFlagLabels;

const medicationAuditChecks: Array<[keyof MedicationCalendarAudit, string]> = [
  ["dateChecked", "日付が正しい"],
  ["usageChecked", "用法が正しい"],
  ["countChecked", "薬包数が正しい"],
  ["duplicateChecked", "重複がない"],
  ["missingChecked", "抜けがない"],
  ["temporaryMedicineChecked", "臨時薬が反映されている"],
  ["stoppedMedicineChecked", "中止薬が除外されている"],
  ["remainingAdjustmentChecked", "残薬調整が反映されている"]
];

const medicationStatusLabels: Record<MedicationCalendarStatus, string> = {
  notStarted: "未着手",
  inProgress: "鑑査中",
  needsReview: "要確認",
  completed: "完了"
};

const medicalInstitutionTypeLabels: Record<MedicalInstitutionType, string> = {
  clinic: "クリニック",
  hospital: "病院",
  dental: "歯科",
  other: "その他"
};

const homeVisitWeekdayLabels: Record<HomeVisitWeekday, string> = {
  monday: "月曜日",
  tuesday: "火曜日",
  wednesday: "水曜日",
  thursday: "木曜日",
  friday: "金曜日",
  saturday: "土曜日",
  sunday: "日曜日"
};

const billingMethodLabels: Record<Exclude<BillingMethod, "">, string> = {
  cash: "現金",
  directDebit: "口座引落",
  bankTransfer: "振込",
  other: "その他"
};

const facilityCalendarNameAliases: Record<string, string[]> = {
  レオ: ["レオ", "老人ホームR"],
  キレイ: ["キレイ", "老人ホームK"]
};

const emptyPatientForm: PatientFormValues = {
  name: "",
  kana: "",
  birthday: "",
  locationType: "home",
  facilityName: "個人宅",
  address: "",
  phone: "",
  doctorName: "",
  mainMedicalInstitutionId: "",
  additionalMedicalInstitutionIds: [],
  lastVisitDate: "",
  prescriptionDays: 0,
  nextVisitDate: "",
  isNextVisitDateManual: false,
  nurseContact: "",
  familyContact: "",
  hasOneDosePackage: false,
  hasCrushing: false,
  hasNarcotics: false,
  hasColdStorageMedicine: false,
  memo: "",
  billingMethod: "",
  billingName: "",
  billingMemo: "",
  billingChecked: false
};

const emptyMedicalInstitutionForm: Omit<MedicalInstitution, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  kana: "",
  type: "clinic",
  phone: "",
  fax: "",
  address: "",
  homeVisitWeekday: "",
  memo: "",
  isMainHomeCareClinic: false
};

const emptyVisit = (patientId: string): Visit => {
  const today = todayString();
  return {
    id: createId(),
    patientId,
    visitDate: "",
    deliveryDate: "",
    homeVisitDate: "",
    dischargeDate: "",
    prescriptionDate: today,
    prescriptionDays: 14,
    remainingDays: 0,
    nextRefillDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    memo: "",
    completed: false,
    createdAt: nowString(),
    updatedAt: nowString()
  };
};

const emptyChecklist = (patientId: string): Checklist => ({
  id: createId(),
  patientId,
  date: todayString(),
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
  createdAt: nowString(),
  updatedAt: nowString()
});

const emptyMedicationCalendar = (patientId: string): MedicationCalendar => {
  const today = todayString();
  return {
    id: createId(),
    patientId,
    startDate: today,
    endDate: format(addDays(new Date(), 6), "yyyy-MM-dd"),
    status: "notStarted",
    memo: "",
    createdAt: nowString(),
    updatedAt: nowString()
  };
};

const emptyMedicationCalendarDay = (calendarId: string, date: string): MedicationCalendarDay => ({
  id: createId(),
  calendarId,
  date,
  morning: "",
  noon: "",
  evening: "",
  bedtime: "",
  wakeup: "",
  asNeeded: "",
  external: "",
  other: "",
  memo: "",
  checked: false,
  hasIssue: false,
  issueMemo: "",
  createdAt: nowString(),
  updatedAt: nowString()
});

const emptyMedicationAudit = (
  calendarDayId: string,
  timing: MedicationTiming
): MedicationCalendarAudit => ({
  id: createId(),
  calendarDayId,
  timing,
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
  createdAt: nowString(),
  updatedAt: nowString()
});

function App() {
  const [data, setData] = useState<AppData>({
    patients: [],
    visits: [],
    tasks: [],
    checklists: [],
    medicationCalendars: [],
    medicationCalendarDays: [],
    medicationCalendarAudits: [],
    medicationPackagePatterns: [],
    medicationPackageItems: [],
    medicationPackagePhotos: [],
    medicationClinicCutoffs: [],
    medicalInstitutions: []
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);

  const reload = async () => {
    const [
      patients,
      visits,
      tasks,
      checklists,
      medicationCalendars,
      medicationCalendarDays,
      medicationCalendarAudits,
      medicationPackagePatterns,
      medicationPackageItems,
      medicationPackagePhotos,
      medicationClinicCutoffs,
      medicalInstitutions
    ] = await Promise.all([
      db.patients.toArray(),
      db.visits.toArray(),
      db.tasks.orderBy("dueDate").toArray(),
      db.checklists.toArray(),
      db.medicationCalendars.toArray(),
      db.medicationCalendarDays.toArray(),
      db.medicationCalendarAudits.toArray(),
      db.medicationPackagePatterns.toArray(),
      db.medicationPackageItems.toArray(),
      db.medicationPackagePhotos.toArray(),
      db.medicationClinicCutoffs.toArray(),
      db.medicalInstitutions.orderBy("name").toArray()
    ]);
    setData({
      patients: sortPatientsByOrder(patients),
      visits,
      tasks,
      checklists,
      medicationCalendars,
      medicationCalendarDays,
      medicationCalendarAudits,
      medicationPackagePatterns,
      medicationPackageItems,
      medicationPackagePhotos,
      medicationClinicCutoffs,
      medicalInstitutions
    });
  };

  useEffect(() => {
    void seedSampleData()
      .then(reload)
      .finally(() => setLoading(false));

    const showUpdate = () => setUpdateAvailable(true);
    const showOffline = () => setNotice("オフライン起動の準備が完了しました");
    window.addEventListener("pwa-update-available", showUpdate);
    window.addEventListener("pwa-offline-ready", showOffline);
    return () => {
      window.removeEventListener("pwa-update-available", showUpdate);
      window.removeEventListener("pwa-offline-ready", showOffline);
    };
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;

        if (currentScrollY < 80 || delta < -6) {
          setHeaderHidden(false);
        } else if (delta > 8 && currentScrollY > 120) {
          setHeaderHidden(true);
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      setHeaderHidden(false);
    }
  }, [menuOpen]);

  const dismissNotice = () => setNotice("");
  const applyUpdate = async () => {
    if (window.updateHomecareServiceWorker) {
      await window.updateHomecareServiceWorker();
      return;
    }
    window.location.reload();
  };

  return (
    <BrowserRouter basename={routerBaseName}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header
          className={[
            "sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur transition-transform duration-200 ease-out",
            headerHidden && !menuOpen ? "-translate-y-full" : "translate-y-0"
          ].join(" ")}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-5">
            <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-care-700 text-white">
                <Home size={21} aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">在宅サポートノート</p>
                <p className="text-xs text-slate-600">オフライン在宅PWA</p>
              </div>
            </Link>
            <button
              type="button"
              className="touch-target inline-flex items-center justify-center rounded-md border border-slate-300 px-3 md:hidden"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="メニュー"
            >
              <Menu size={24} />
            </button>
            <nav className="hidden flex-1 flex-wrap justify-end gap-1 md:flex" aria-label="主要メニュー">
              <NavItems />
            </nav>
          </div>
          {menuOpen ? (
            <nav className="grid gap-2 border-t border-slate-200 bg-white p-3 md:hidden">
              <NavItems onNavigate={() => setMenuOpen(false)} />
            </nav>
          ) : null}
        </header>

        {updateAvailable ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">新しいバージョンがあります</span>
              <button
                type="button"
                className="touch-target rounded-md bg-amber-600 px-4 py-2 font-semibold text-white"
                onClick={() => void applyUpdate()}
              >
                更新する
              </button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <button
            type="button"
            className="w-full border-b border-care-100 bg-care-50 px-4 py-3 text-left font-semibold text-care-900"
            onClick={dismissNotice}
          >
            {notice}
          </button>
        ) : null}

        <main className="mx-auto max-w-7xl px-4 py-5 md:px-6">
          {loading ? (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-lg">読み込み中...</div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard data={data} />} />
              <Route
                path="/patients"
                element={<PatientsPage data={data} reload={reload} />}
              />
              <Route
                path="/patients/:id"
                element={<PatientsPage data={data} reload={reload} />}
              />
              <Route
                path="/patients/:id/package-audit"
                element={<PackageAuditEditor data={data} reload={reload} />}
              />
              <Route path="/tasks" element={<TasksPage data={data} reload={reload} />} />
              <Route
                path="/medical-institutions"
                element={<MedicalInstitutionsPage data={data} reload={reload} />}
              />
              <Route path="/billing" element={<BillingPage data={data} reload={reload} />} />
              <Route
                path="/medication-audit"
                element={<MedicationAuditPage data={data} reload={reload} />}
              />
              <Route
                path="/facility-r-calendar"
                element={<FacilityCalendarPage data={data} reload={reload} facilityName="レオ" />}
              />
              <Route
                path="/facility-k-calendar"
                element={<FacilityCalendarPage data={data} reload={reload} facilityName="キレイ" />}
              />
              <Route path="/settings" element={<SettingsPage data={data} reload={reload} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}

const routerBaseName = (() => {
  const pathname = new URL(import.meta.env.BASE_URL, window.location.href).pathname;
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
})();

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const items = [
    { to: "/", label: "ダッシュボード", icon: CalendarDays },
    { to: "/tasks", label: "タスク", icon: ClipboardCheck },
    { to: "/patients", label: "患者一覧", icon: UsersRound },
    { to: "/medical-institutions", label: "医療機関一覧", icon: Stethoscope },
    { to: "/billing", label: "請求", icon: CreditCard },
    { to: "/facility-r-calendar", label: "レオ", icon: Package },
    { to: "/facility-k-calendar", label: "キレイ", icon: Package },
    { to: "/settings", label: "設定", icon: Settings }
  ];

  return items.map(({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "touch-target inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-semibold lg:px-3",
          isActive ? "bg-care-700 text-white" : "text-slate-700 hover:bg-slate-100"
        ].join(" ")
      }
      end={to === "/"}
    >
      <Icon size={17} />
      {label}
    </NavLink>
  ));
}

function Dashboard({ data }: { data: AppData }) {
  const todayVisits = data.visits.filter((visit) => !visit.completed && isDueToday(visit.visitDate));
  const todayDeliveries = data.visits.filter((visit) => !visit.completed && isDueToday(visit.deliveryDate));
  const lowMedicine = data.visits.filter((visit) => !visit.completed && visit.remainingDays <= 3);
  const doctorTasks = data.tasks.filter((task) => !task.completed && task.type === "doctor");
  const openTasks = data.tasks.filter((task) => !task.completed);
  const openMedicationAudits = data.medicationCalendars.filter((calendar) => calendar.status !== "completed");
  const medicationNeedsReview = data.medicationCalendars.filter((calendar) => calendar.status === "needsReview");
  const todayMedicationSet = data.medicationCalendars.filter((calendar) => isDueToday(calendar.startDate));
  const medicationDueSoon = data.medicationCalendars.filter(
    (calendar) => calendar.status !== "completed" && daysUntil(calendar.endDate) <= 3
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={CalendarDays} label="今日の訪問" value={todayVisits.length} tone="care" />
        <MetricCard icon={Package} label="今日の配達" value={todayDeliveries.length} tone="blue" />
        <MetricCard icon={AlertTriangle} label="残薬注意" value={lowMedicine.length} tone="rose" />
        <MetricCard icon={Stethoscope} label="医師確認" value={doctorTasks.length} tone="amber" />
        <MetricCard icon={ClipboardCheck} label="未完了タスク" value={openTasks.length} tone="slate" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Pill} label="服薬鑑査 未完了" value={openMedicationAudits.length} tone="amber" />
        <MetricCard icon={AlertTriangle} label="服薬 要確認" value={medicationNeedsReview.length} tone="rose" />
        <MetricCard icon={Package} label="今日セット予定" value={todayMedicationSet.length} tone="care" />
        <MetricCard icon={CalendarDays} label="服薬期限近い" value={medicationDueSoon.length} tone="blue" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DashboardList title="今日の対応" items={[...todayVisits, ...todayDeliveries]} data={data} />
        <TaskListPanel title="未完了タスク" tasks={openTasks.slice(0, 8)} patients={data.patients} />
      </div>

      <MedicationDashboardPanel
        calendars={openMedicationAudits.concat(medicationDueSoon, medicationNeedsReview)}
        data={data}
      />

      <section className="rounded-md border border-rose-200 bg-white">
        <div className="border-b border-rose-100 px-4 py-3">
          <h2 className="text-xl font-bold text-rose-950">残薬切れが近い患者</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {lowMedicine.length ? (
            lowMedicine.map((visit) => {
              const patient = data.patients.find((item) => item.id === visit.patientId);
              if (!patient) return null;
              return (
                <Link
                  key={visit.id}
                  to={`/patients/${patient.id}`}
                  className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 hover:bg-rose-50"
                >
                  <span>
                    <span className="block text-lg font-bold">{patient.name}</span>
                    <span className="text-slate-600">{formatLocationLabel(patient.facilityName, "自宅")}</span>
                  </span>
                  <span className="rounded-md bg-rose-100 px-3 py-2 font-bold text-rose-800">
                    残薬 {visit.remainingDays}日
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="px-4 py-5 text-slate-600">残薬警告はありません</p>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
  tone: "care" | "blue" | "rose" | "amber" | "slate";
}) {
  const toneClass = {
    care: "bg-care-50 text-care-900 border-care-100",
    blue: "bg-blue-50 text-blue-950 border-blue-100",
    rose: "bg-rose-50 text-rose-950 border-rose-100",
    amber: "bg-amber-50 text-amber-950 border-amber-100",
    slate: "bg-slate-100 text-slate-900 border-slate-200"
  }[tone];

  return (
    <section className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{label}</p>
        <Icon size={24} />
      </div>
      <p className="mt-3 text-4xl font-bold">{value}</p>
    </section>
  );
}

function DashboardList({ title, items, data }: { title: string; items: Visit[]; data: AppData }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length ? (
          items.map((visit) => {
            const patient = data.patients.find((item) => item.id === visit.patientId);
            if (!patient) return null;
            return (
              <Link
                key={`${visit.id}-${visit.visitDate}-${visit.deliveryDate}`}
                to={`/patients/${patient.id}`}
                className="block px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-lg font-bold">{patient.name}</span>
                  <span className="rounded-md bg-care-100 px-3 py-1 font-semibold text-care-900">
                    {isDueToday(visit.visitDate) ? "訪問" : "配達"}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{formatLocationLabel(patient.facilityName || patient.address, "自宅")}</p>
              </Link>
            );
          })
        ) : (
          <p className="px-4 py-5 text-slate-600">今日の予定はありません</p>
        )}
      </div>
    </section>
  );
}

function TaskListPanel({ title, tasks, patients }: { title: string; tasks: Task[]; patients: Patient[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.length ? (
          tasks.map((task) => {
            const patient = patients.find((item) => item.id === task.patientId);
            return (
              <Link
                key={task.id}
                to={`/patients/${task.patientId}`}
                className="block px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <span>
                    <span className="block text-lg font-bold">{task.title}</span>
                    <span className="text-slate-600">{patient?.name || "患者未設定"}</span>
                  </span>
                  <span className="rounded-md bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    {taskTypeLabels[task.type]}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">期限 {formatDateLabel(task.dueDate)}</p>
              </Link>
            );
          })
        ) : (
          <p className="px-4 py-5 text-slate-600">未完了タスクはありません</p>
        )}
      </div>
    </section>
  );
}

function MedicationDashboardPanel({ calendars, data }: { calendars: MedicationCalendar[]; data: AppData }) {
  const uniqueCalendars = [...new Map(calendars.map((calendar) => [calendar.id, calendar])).values()];

  return (
    <section className="rounded-md border border-amber-200 bg-white">
      <div className="border-b border-amber-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-amber-950">
          <Pill size={22} />
          服薬カレンダー鑑査
        </h2>
      </div>
      <div className="divide-y divide-slate-100">
        {uniqueCalendars.length ? (
          uniqueCalendars.map((calendar) => {
            const patient = data.patients.find((item) => item.id === calendar.patientId);
            const days = data.medicationCalendarDays.filter((day) => day.calendarId === calendar.id);
            return (
              <Link
                key={calendar.id}
                to={`/patients/${calendar.patientId}`}
                className="grid gap-2 px-4 py-3 hover:bg-amber-50 md:grid-cols-[1fr_auto_auto]"
              >
                <span>
                  <span className="block text-lg font-bold">{patient?.name || "患者未設定"}</span>
                  <span className="text-slate-600">
                    {formatDateLabel(calendar.startDate)} - {formatDateLabel(calendar.endDate)}
                  </span>
                </span>
                <span className="self-center rounded-md bg-amber-100 px-3 py-2 font-bold text-amber-900">
                  {medicationStatusLabels[calendar.status]}
                </span>
                <span className="self-center text-slate-700">完了率 {getMedicationCompletionRate(days)}%</span>
              </Link>
            );
          })
        ) : (
          <p className="px-4 py-5 text-slate-600">服薬カレンダーの要対応はありません</p>
        )}
      </div>
    </section>
  );
}

function MedicationAuditPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const [reorderMode, setReorderMode] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");
  const [orderedIds, setOrderedIds] = useState(data.patients.map((patient) => patient.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  useEffect(() => {
    setOrderedIds(data.patients.map((patient) => patient.id));
  }, [data.patients]);

  const orderedPatients = orderedIds
    .map((id) => data.patients.find((patient) => patient.id === id))
    .filter((patient): patient is Patient => Boolean(patient));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextIds = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(nextIds);
    await db.transaction("rw", db.patients, async () => {
      await Promise.all(
        nextIds.map((id, order) => db.patients.update(id, { order, updatedAt: nowString() }))
      );
    });
    await reload();
  };

  const seedMockPatients = async (facilityName = "確認施設") => {
    const existingMockCount = data.patients.filter((patient) => /^模擬患者\d+/.test(patient.name)).length;
    const targetTotal = 20;
    const isFacilityCalendar = isFacilityCalendarFacility(facilityName);
    const currentTargetCount = isFacilityCalendar
      ? data.patients.filter((patient) => patientMatchesFacilityCalendar(patient, facilityName)).length
      : data.patients.length;
    const countToAdd = Math.max(0, targetTotal - currentTargetCount);
    if (countToAdd === 0) {
      setSeedMessage("すでに20件以上あります");
      return;
    }

    const now = nowString();
    const startDate = todayString();
    const endDate = format(addDays(new Date(), 6), "yyyy-MM-dd");
    const dosageForms: DosageForm[] = ["tablet", "powder", "magnesium", "kampo"];

    await db.transaction(
      "rw",
      [
        db.patients,
        db.medicationCalendars,
        db.medicationCalendarDays,
        db.medicationPackagePatterns,
        db.medicationPackageItems
      ],
      async () => {
        for (let index = 0; index < countToAdd; index += 1) {
          const number = existingMockCount + index + 1;
          const suffix = String(number).padStart(2, "0");
          const patientId = createId();
          const calendarId = createId();

          await db.patients.add({
            id: patientId,
            order: data.patients.length + index,
            name: `模擬患者${suffix}`,
            kana: `モギカンジャ${suffix}`,
            birthday: "1940-01-01",
            locationType: "facility",
            facilityName: isFacilityCalendar ? facilityName : `確認施設${((number - 1) % 5) + 1}`,
            address: "東京都テスト区1-1-1",
            phone: "03-0000-0000",
            doctorName: "テスト医師",
            nurseContact: "テスト訪問看護",
            familyContact: "家族 090-0000-0000",
            hasOneDosePackage: true,
            hasCrushing: number % 4 === 0,
            hasNarcotics: false,
            hasColdStorageMedicine: number % 6 === 0,
            memo: "グリッド表示確認用",
            createdAt: now,
            updatedAt: now
          });

          await db.medicationCalendars.add({
            id: calendarId,
            patientId,
            startDate,
            endDate,
            status: number % 7 === 0 ? "needsReview" : number % 3 === 0 ? "completed" : "inProgress",
            memo: "グリッド表示確認用",
            createdAt: now,
            updatedAt: now
          });

          for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
            const dayDate = format(addDays(new Date(), dayOffset), "yyyy-MM-dd");
            await db.medicationCalendarDays.add({
              id: createId(),
              calendarId,
              date: dayDate,
              morning: "朝 一包化",
              noon: number % 2 === 0 ? "" : "昼 一包化",
              evening: "夕 一包化",
              bedtime: number % 3 === 0 ? "寝る前 一包化" : "",
              wakeup: "",
              asNeeded: "",
              external: "",
              other: "",
              memo: number % 7 === 0 ? "変更あり" : "",
              checked: number % 3 === 0,
              hasIssue: number % 7 === 0,
              issueMemo: number % 7 === 0 ? "変更確認" : "",
              createdAt: now,
              updatedAt: now
            });
          }

          for (const timing of medicationCoreTimings) {
            const patternId = createId();
            await db.medicationPackagePatterns.add({ id: patternId, patientId, timing, updatedAt: now });
            const itemCount =
              timing === "noon" && number % 2 === 0
                ? 0
                : timing === "bedtime" && number % 3 !== 0
                  ? 0
                  : 1 + (timing === "morning" ? number % 3 : 0);

            for (let order = 0; order < itemCount; order += 1) {
              const dosageForm = dosageForms[(number + order) % dosageForms.length];
              await db.medicationPackageItems.add({
                id: createId(),
                patternId,
                order,
                dosageForm,
                quantity: dosageForm === "magnesium" ? "" : String(order + 1),
                medicineName: dosageForm === "kampo" ? `ツムラ${60 + number}` : "",
                clinicName: order === 0 ? "メインクリニック" : "追加クリニック",
                isTemporary: number % 8 === 0 && order === 0,
                isStopped: number % 9 === 0 && order === 0,
                isSelfAdjustment: dosageForm === "magnesium",
                memo: "",
                createdAt: now,
                updatedAt: now
              });
            }
          }
        }
      }
    );

    await reload();
    setSeedMessage(`模擬患者を${countToAdd}件追加しました`);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Pill size={26} />
              服薬カレンダー鑑査
            </h1>
            <p className="mt-1 text-slate-600">患者カードを4×5グリッドで確認し、一包化内容と鑑査状況を管理します。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {import.meta.env.DEV ? (
              <>
              <button
                type="button"
                onClick={() => void seedMockPatients()}
                className="touch-target rounded-md bg-slate-900 px-4 py-2 font-semibold text-white"
              >
                模擬患者を追加
              </button>
              <button
                type="button"
                onClick={() => void seedMockPatients("レオ")}
                className="touch-target rounded-md bg-care-700 px-4 py-2 font-semibold text-white"
              >
                レオ患者を追加
              </button>
              </>
            ) : null}
            <Toggle label="並び替えモードON" checked={reorderMode} onChange={setReorderMode} />
          </div>
        </div>
        {seedMessage ? <p className="mt-3 font-semibold text-care-900">{seedMessage}</p> : null}
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {orderedPatients.slice(0, 20).map((patient) => (
              <SortableMedicationPatientCard
                key={patient.id}
                patient={patient}
                data={data}
                reorderMode={reorderMode}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableMedicationPatientCard({
  patient,
  data,
  reorderMode,
  slotNumber
}: {
  patient: Patient;
  data: AppData;
  reorderMode: boolean;
  slotNumber?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: patient.id,
    disabled: !reorderMode
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "z-10 opacity-80" : ""}>
      <MedicationPatientCard
        patient={patient}
        data={data}
        reorderMode={reorderMode}
        slotNumber={slotNumber}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function FacilityCalendarPage({
  data,
  reload,
  facilityName
}: {
  data: AppData;
  reload: () => Promise<void>;
  facilityName: string;
}) {
  const navigate = useNavigate();
  const facilityPatients = useMemo(
    () => sortPatientsByOrder(data.patients.filter((patient) => patientMatchesFacilityCalendar(patient, facilityName))),
    [data.patients, facilityName]
  );
  const unplacedFacilityPatients = useMemo(
    () => facilityPatients.filter((patient) => !isValidFacilityCalendarSlot(patient.facilityCalendarSlot)),
    [facilityPatients]
  );
  const [reorderMode, setReorderMode] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  const slots = getFacilityCalendarSlots(facilityPatients);

  const assignUnplacedPatients = async () => {
    const occupiedSlots = new Set(
      facilityPatients.map((patient) => patient.facilityCalendarSlot).filter(isValidFacilityCalendarSlot)
    );
    let assignedCount = 0;

    await db.transaction("rw", db.patients, async () => {
      for (const patient of unplacedFacilityPatients) {
        const targetSlot = Array.from({ length: 20 }, (_, index) => index + 1).find((slot) => !occupiedSlots.has(slot));
        if (!targetSlot) break;
        occupiedSlots.add(targetSlot);
        assignedCount += 1;
        await db.patients.update(patient.id, {
          facilityCalendarSlot: targetSlot,
          order: targetSlot - 1,
          updatedAt: nowString()
        });
      }
    });

    await reload();
    setSeedMessage(assignedCount ? `未配置の患者 ${assignedCount}名を空きマスへ配置しました` : "配置できる空きマスがありません");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activePatient = facilityPatients.find((patient) => patient.id === String(active.id));
    const targetSlot = Number(String(over.id).replace("slot-", ""));
    if (!activePatient || !targetSlot || targetSlot < 1 || targetSlot > 20) return;

    const sourceSlot = activePatient.facilityCalendarSlot;
    const targetPatient = facilityPatients.find((patient) => patient.facilityCalendarSlot === targetSlot);
    await db.transaction("rw", db.patients, async () => {
      await db.patients.update(activePatient.id, {
        facilityCalendarSlot: targetSlot,
        order: targetSlot - 1,
        updatedAt: nowString()
      });
      if (targetPatient && sourceSlot) {
        await db.patients.update(targetPatient.id, {
          facilityCalendarSlot: sourceSlot,
          order: sourceSlot - 1,
          updatedAt: nowString()
        });
      }
    });
    await reload();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Package size={26} />
              {facilityName}
            </h1>
            <p className="mt-1 text-slate-600">
              施設名が{facilityName}の患者だけを、20マスへ固定表示します。
            </p>
            {isFacilityCalendarFacility(facilityName) ? (
              <p className="mt-1 font-semibold text-care-900">
                {getFacilityInstallationPeriodLabel(facilityName)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/patients/new?facility=${encodeURIComponent(facilityName)}`)}
              className="touch-target rounded-md bg-care-700 px-4 py-2 font-semibold text-white"
            >
              患者を追加
            </button>
            {import.meta.env.DEV ? (
              <button
                type="button"
                onClick={() =>
                  void seedMedicationMockPatients({
                    data,
                    reload,
                    setSeedMessage,
                    facilityName
                  })
                }
                className="touch-target rounded-md border border-slate-300 px-4 py-2 font-semibold"
              >
                模擬患者を追加
              </button>
            ) : null}
            <Badge tone="slate">対象 {facilityPatients.length} / 20</Badge>
            <Toggle label="並び替えモードON" checked={reorderMode} onChange={setReorderMode} />
          </div>
        </div>
        {seedMessage ? <p className="mt-3 font-semibold text-care-900">{seedMessage}</p> : null}
        {unplacedFacilityPatients.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="font-semibold text-amber-900">
              未配置の{facilityName}患者が {unplacedFacilityPatients.length} 名います。
            </p>
            <button
              type="button"
              onClick={() => void assignUnplacedPatients()}
              className="touch-target rounded-md bg-amber-600 px-4 py-2 font-semibold text-white"
            >
              空きマスに配置
            </button>
          </div>
        ) : null}
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {slots.map(({ slotNumber, patient }) => (
            <FacilityRCalendarSlot
              key={slotNumber}
              slotNumber={slotNumber}
              patient={patient}
              data={data}
              reorderMode={reorderMode}
            />
          ))}
        </section>
      </DndContext>
    </div>
  );
}

type MedicalInstitutionCutoffSummary = {
  key: string;
  label: string;
  weekdayLabel: string;
  institution?: MedicalInstitution;
  patientCount: number;
  shortestCutoffDate: string;
  earliestNextVisitDate: string;
  rows: Array<{
    patient: Patient;
    institution: MedicalInstitution;
    previousCutoffDate: string;
    prescriptionDays: number;
    cutoffDate: string;
    nextVisitDate: string;
    relation: "居宅" | "外来" | "一包化" | "未設定";
  }>;
};

function MedicalInstitutionCutoffSummaryCard({
  summary,
  onSaveCutoff,
  onApplyCutoffToPatients
}: {
  summary: MedicalInstitutionCutoffSummary;
  onSaveCutoff: (
    patient: Patient,
    institution: MedicalInstitution,
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string }
  ) => Promise<void>;
  onApplyCutoffToPatients: (
    institution: MedicalInstitution,
    patients: Patient[],
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string }
  ) => Promise<number>;
}) {
  const [bulkPreviousCutoffDate, setBulkPreviousCutoffDate] = useState("");
  const [bulkPrescriptionDays, setBulkPrescriptionDays] = useState("");
  const [bulkNextCutoffDate, setBulkNextCutoffDate] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const canBulkApply = Boolean(summary.institution && summary.rows.length && bulkNextCutoffDate);

  useEffect(() => {
    if (!bulkMessage) return undefined;
    const timer = window.setTimeout(() => setBulkMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [bulkMessage]);

  const applyToPatients = async () => {
    if (!summary.institution || !canBulkApply) return;
    const updatedCount = await onApplyCutoffToPatients(
      summary.institution,
      summary.rows.map((row) => row.patient),
      {
        previousCutoffDate: bulkPreviousCutoffDate,
        prescriptionDays: Number(bulkPrescriptionDays) || 0,
        nextCutoffDate: bulkNextCutoffDate
      }
    );
    setBulkMessage(`${updatedCount}名の切日に反映しました`);
  };

  const updateBulkPreviousCutoffDate = (value: string) => {
    setBulkPreviousCutoffDate(value);
    const calculated = calcNextCutoffDate(value, Number(bulkPrescriptionDays) || 0);
    if (calculated) setBulkNextCutoffDate(calculated);
  };

  const updateBulkPrescriptionDays = (value: string) => {
    setBulkPrescriptionDays(value);
    const calculated = calcNextCutoffDate(bulkPreviousCutoffDate, Number(value) || 0);
    if (calculated) setBulkNextCutoffDate(calculated);
  };

  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{summary.label}</h2>
          <p className="text-xs font-semibold text-slate-600">
            往診曜日：{summary.weekdayLabel || "未設定"}
          </p>
        </div>
        <Badge tone="slate">対象 {summary.patientCount}名</Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-800">
          最短切日：{summary.shortestCutoffDate ? formatDateLabel(summary.shortestCutoffDate) : "未設定"}
        </span>
        <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-800">
          次回往診：{summary.earliestNextVisitDate ? formatDateLabel(summary.earliestNextVisitDate) : "未設定"}
        </span>
      </div>

      <div className="mt-3 rounded-md border border-care-100 bg-care-50 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_7rem_1fr_auto] md:items-end">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-care-900">対象患者へ反映する前回切日</span>
            <input
              type="date"
              className="min-h-10 rounded-md border border-care-200 bg-white px-2"
              value={bulkPreviousCutoffDate}
              onChange={(event) => updateBulkPreviousCutoffDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-care-900">日数</span>
            <input
              type="number"
              inputMode="numeric"
              className="min-h-10 rounded-md border border-care-200 bg-white px-2"
              value={bulkPrescriptionDays}
              onChange={(event) => updateBulkPrescriptionDays(event.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-care-900">次回切日</span>
            <input
              type="date"
              className="min-h-10 rounded-md border border-care-200 bg-white px-2 font-bold text-rose-800"
              value={bulkNextCutoffDate}
              onChange={(event) => setBulkNextCutoffDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void applyToPatients()}
            disabled={!canBulkApply}
            className={[
              "min-h-10 rounded-md px-3 font-semibold",
              canBulkApply ? "bg-care-700 text-white" : "bg-slate-200 text-slate-500"
            ].join(" ")}
          >
            対象患者へ反映
          </button>
        </div>
        {bulkMessage ? <p className="mt-2 text-sm font-semibold text-care-900">{bulkMessage}</p> : null}
      </div>

      <div className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
        {summary.rows.length ? (
          summary.rows.map((row) => (
            <MedicalInstitutionCutoffRow
              key={row.patient.id}
              row={row}
              onSaveCutoff={onSaveCutoff}
            />
          ))
        ) : (
          <p className="rounded-md bg-slate-50 p-2 text-sm font-semibold text-slate-500">対象患者はいません</p>
        )}
      </div>
    </article>
  );
}

function MedicalInstitutionCutoffRow({
  row,
  onSaveCutoff
}: {
  row: MedicalInstitutionCutoffSummary["rows"][number];
  onSaveCutoff: (
    patient: Patient,
    institution: MedicalInstitution,
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string }
  ) => Promise<void>;
}) {
  const [previousCutoffDate, setPreviousCutoffDate] = useState(row.previousCutoffDate);
  const [prescriptionDays, setPrescriptionDays] = useState(row.prescriptionDays ? String(row.prescriptionDays) : "");
  const [nextCutoffDate, setNextCutoffDate] = useState(
    row.cutoffDate || calcNextCutoffDate(row.previousCutoffDate, row.prescriptionDays)
  );
  const [saved, setSaved] = useState(false);
  const isDirty =
    previousCutoffDate !== row.previousCutoffDate ||
    Number(prescriptionDays || 0) !== row.prescriptionDays ||
    nextCutoffDate !== row.cutoffDate;

  useEffect(() => {
    setPreviousCutoffDate(row.previousCutoffDate);
    setPrescriptionDays(row.prescriptionDays ? String(row.prescriptionDays) : "");
    setNextCutoffDate(row.cutoffDate || calcNextCutoffDate(row.previousCutoffDate, row.prescriptionDays));
  }, [row.previousCutoffDate, row.prescriptionDays, row.cutoffDate]);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(false), 1600);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const save = async () => {
    await onSaveCutoff(row.patient, row.institution, {
      previousCutoffDate,
      prescriptionDays: Number(prescriptionDays) || 0,
      nextCutoffDate
    });
    setSaved(true);
  };

  const updatePreviousCutoffDate = (value: string) => {
    setPreviousCutoffDate(value);
    const calculated = calcNextCutoffDate(value, Number(prescriptionDays) || 0);
    if (calculated) setNextCutoffDate(calculated);
  };

  const updatePrescriptionDays = (value: string) => {
    setPrescriptionDays(value);
    const calculated = calcNextCutoffDate(previousCutoffDate, Number(value) || 0);
    if (calculated) setNextCutoffDate(calculated);
  };

  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-2 text-sm lg:grid-cols-[minmax(7rem,1fr)_auto_9rem_5rem_9rem_auto] lg:items-end">
      <div>
        <p className="font-bold text-slate-900">{row.patient.name}</p>
        <p className="text-xs font-semibold text-slate-500">
          {row.relation} / 往診：{row.nextVisitDate ? formatDateLabel(row.nextVisitDate) : "未設定"}
        </p>
      </div>
      <span className="hidden rounded-md bg-white px-2 py-2 text-xs font-semibold text-slate-600 lg:inline">
        現切日 {row.cutoffDate ? formatDateLabel(row.cutoffDate) : "-"}
      </span>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-slate-600">前回切日</span>
        <input
          type="date"
          className="min-h-10 rounded-md border border-slate-300 bg-white px-2"
          value={previousCutoffDate}
          onChange={(event) => updatePreviousCutoffDate(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-slate-600">日数</span>
        <input
          type="number"
          inputMode="numeric"
          className="min-h-10 rounded-md border border-slate-300 bg-white px-2"
          value={prescriptionDays}
          onChange={(event) => updatePrescriptionDays(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-slate-600">次回切日</span>
        <input
          type="date"
          className="min-h-10 rounded-md border border-slate-300 bg-white px-2 font-bold text-rose-800"
          value={nextCutoffDate}
          onChange={(event) => setNextCutoffDate(event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={!isDirty && !saved}
        className={[
          "min-h-10 rounded-md px-3 font-semibold",
          isDirty
            ? "bg-care-700 text-white"
            : saved
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-200 text-slate-500"
        ].join(" ")}
      >
        {saved ? "保存済" : "保存"}
      </button>
    </div>
  );
}

function FacilityRCalendarSlot({
  slotNumber,
  patient,
  data,
  reorderMode
}: {
  slotNumber: number;
  patient?: Patient;
  data: AppData;
  reorderMode: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot-${slotNumber}` });
  const highlight = isOver ? "outline outline-2 outline-care-600" : "";

  if (!patient) {
    return (
      <article
        ref={setNodeRef}
        className={`min-h-64 rounded-md border border-dashed border-slate-300 bg-white p-4 text-slate-500 ${highlight}`}
      >
        <p className="text-lg font-bold">{slotNumber}</p>
        <p className="mt-20 text-center font-semibold">空き</p>
      </article>
    );
  }

  return (
    <div ref={setNodeRef} className={highlight}>
      <DraggableFacilityRPatientCard
        patient={patient}
        data={data}
        reorderMode={reorderMode}
        slotNumber={slotNumber}
      />
    </div>
  );
}

function DraggableFacilityRPatientCard({
  patient,
  data,
  reorderMode,
  slotNumber
}: {
  patient: Patient;
  data: AppData;
  reorderMode: boolean;
  slotNumber: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: patient.id,
    disabled: !reorderMode
  });
  const style = {
    transform: CSS.Translate.toString(transform)
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "z-10 opacity-80" : ""}>
      <MedicationPatientCard
        patient={patient}
        data={data}
        reorderMode={reorderMode}
        slotNumber={slotNumber}
        dragHandleProps={{ ...attributes, ...listeners }}
        showAuditStatus={false}
        showFacilityName={false}
      />
    </div>
  );
}

async function seedMedicationMockPatients({
  data,
  reload,
  setSeedMessage,
  facilityName = "確認施設"
}: {
  data: AppData;
  reload: () => Promise<void>;
  setSeedMessage: (message: string) => void;
  facilityName?: string;
}) {
  const existingMockCount = data.patients.filter((patient) => /^模擬患者\d+/.test(patient.name)).length;
  const targetTotal = 20;
  const isFacilityCalendar = isFacilityCalendarFacility(facilityName);
  const currentTargetCount = isFacilityCalendar
    ? data.patients.filter((patient) => patientMatchesFacilityCalendar(patient, facilityName)).length
    : data.patients.length;
  const countToAdd = Math.max(0, targetTotal - currentTargetCount);
  if (countToAdd === 0) {
    setSeedMessage("すでに20件以上あります");
    return;
  }

  const now = nowString();
  const startDate = todayString();
  const endDate = format(addDays(new Date(), 6), "yyyy-MM-dd");
  const dosageForms: DosageForm[] = ["tablet", "powder", "magnesium", "kampo"];

  await db.transaction(
    "rw",
    [
      db.patients,
      db.medicationCalendars,
      db.medicationCalendarDays,
      db.medicationPackagePatterns,
      db.medicationPackageItems
    ],
    async () => {
      for (let index = 0; index < countToAdd; index += 1) {
        const number = existingMockCount + index + 1;
        const suffix = String(number).padStart(2, "0");
        const patientId = createId();
        const calendarId = createId();

        await db.patients.add({
          id: patientId,
          order: data.patients.length + index,
          facilityCalendarSlot: isFacilityCalendar ? currentTargetCount + index + 1 : undefined,
          name: `模擬患者${suffix}`,
          kana: `モギカンジャ${suffix}`,
          birthday: "1940-01-01",
          locationType: "facility",
          facilityName: isFacilityCalendar ? facilityName : `確認施設${((number - 1) % 5) + 1}`,
          address: "東京都テスト区1-1-1",
          phone: "03-0000-0000",
          doctorName: "テスト医師",
          nurseContact: "テスト訪問看護",
          familyContact: "家族 090-0000-0000",
          hasOneDosePackage: true,
          hasCrushing: number % 4 === 0,
          hasNarcotics: false,
          hasColdStorageMedicine: number % 6 === 0,
          memo: "グリッド表示確認用",
          createdAt: now,
          updatedAt: now
        });

        await db.medicationCalendars.add({
          id: calendarId,
          patientId,
          startDate,
          endDate,
          status: number % 7 === 0 ? "needsReview" : number % 3 === 0 ? "completed" : "inProgress",
          memo: "グリッド表示確認用",
          createdAt: now,
          updatedAt: now
        });

        for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
          const dayDate = format(addDays(new Date(), dayOffset), "yyyy-MM-dd");
          await db.medicationCalendarDays.add({
            id: createId(),
            calendarId,
            date: dayDate,
            morning: "朝 一包化",
            noon: number % 2 === 0 ? "" : "昼 一包化",
            evening: "夕 一包化",
            bedtime: number % 3 === 0 ? "寝る前 一包化" : "",
            wakeup: "",
            asNeeded: "",
            external: "",
            other: "",
            memo: number % 7 === 0 ? "変更あり" : "",
            checked: number % 3 === 0,
            hasIssue: number % 7 === 0,
            issueMemo: number % 7 === 0 ? "変更確認" : "",
            createdAt: now,
            updatedAt: now
          });
        }

        for (const timing of medicationCoreTimings) {
          const patternId = createId();
          await db.medicationPackagePatterns.add({ id: patternId, patientId, timing, updatedAt: now });
          const itemCount =
            timing === "noon" && number % 2 === 0
              ? 0
              : timing === "bedtime" && number % 3 !== 0
                ? 0
                : 1 + (timing === "morning" ? number % 3 : 0);

          for (let order = 0; order < itemCount; order += 1) {
            const dosageForm = dosageForms[(number + order) % dosageForms.length];
            await db.medicationPackageItems.add({
              id: createId(),
              patternId,
              order,
              dosageForm,
              quantity: dosageForm === "magnesium" ? "" : String(order + 1),
              medicineName: dosageForm === "kampo" ? `ツムラ${60 + number}` : "",
              clinicName: order === 0 ? "メインクリニック" : "追加クリニック",
              isTemporary: number % 8 === 0 && order === 0,
              isStopped: number % 9 === 0 && order === 0,
              isSelfAdjustment: dosageForm === "magnesium",
              memo: "",
              createdAt: now,
              updatedAt: now
            });
          }
        }
      }
    }
  );

  await reload();
  setSeedMessage(`模擬患者を${countToAdd}件追加しました`);
}
function MedicationPatientCard({
  patient,
  data,
  reorderMode,
  slotNumber,
  dragHandleProps,
  showAuditStatus = true,
  showFacilityName = true
}: {
  patient: Patient;
  data: AppData;
  reorderMode: boolean;
  slotNumber?: number;
  dragHandleProps: Record<string, unknown>;
  showAuditStatus?: boolean;
  showFacilityName?: boolean;
}) {
  const calendar = getLatestMedicationCalendar(patient.id, data.medicationCalendars);
  const days = calendar ? data.medicationCalendarDays.filter((day) => day.calendarId === calendar.id) : [];
  const patterns = data.medicationPackagePatterns.filter((pattern) => pattern.patientId === patient.id);
  const items = getPatternItems(patterns, data.medicationPackageItems, patient, data.medicalInstitutions);
  const issueCount = days.filter((day) => day.hasIssue || day.issueMemo || getMedicationDayDataWarnings(day).length).length;
  const packageCount = getPackageCount(patterns, data.medicationPackageItems, patient, data.medicalInstitutions);
  const status = calendar?.status || "notStarted";
  const cutoffSummary = getCutoffSummary(
    data.medicationClinicCutoffs.filter((cutoff) => cutoff.patientId === patient.id)
  );
  const facilityClinicTone = getFacilityClinicCardTone(patient, data.medicalInstitutions);
  const cardTone = showAuditStatus
    ? {
        notStarted: "border-slate-200 bg-white",
        inProgress: "border-amber-200 bg-amber-50",
        needsReview: "border-rose-200 bg-rose-50",
        completed: "border-care-100 bg-care-50"
      }[status]
    : facilityClinicTone;

  const content = (
    <article className={`h-full rounded-md border p-4 ${cardTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {slotNumber && showAuditStatus ? <p className="text-sm font-bold text-slate-500">位置番号：{slotNumber}</p> : null}
          <h2 className="text-xl font-bold">{patient.name}</h2>
          {showFacilityName ? <p className="text-slate-600">{formatLocationLabel(patient.facilityName, "自宅")}</p> : null}
        </div>
        {reorderMode ? (
          <button
            type="button"
            className="touch-target rounded-md border border-slate-300 bg-white px-3"
            aria-label="並び替え"
            {...dragHandleProps}
          >
            <GripVertical size={22} />
          </button>
        ) : null}
      </div>

      {showAuditStatus ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={status === "completed" ? "care" : status === "needsReview" ? "rose" : status === "inProgress" ? "amber" : "slate"}>
            {medicationStatusLabels[status]}
          </Badge>
          <Badge tone={issueCount ? "rose" : "slate"}>要確認 {issueCount}</Badge>
          <Badge tone="slate">完了率 {getMedicationCompletionRate(days)}%</Badge>
        </div>
      ) : null}

      {showAuditStatus ? (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          対象期間 {calendar ? `${formatDateLabel(calendar.startDate)} - ${formatDateLabel(calendar.endDate)}` : "未作成"}
        </p>
      ) : (
        <div className="mt-3 space-y-1 text-sm font-semibold text-slate-700">
          <p>設置期間：{cutoffSummary.installationPeriod || "未設定"}</p>
          <p>最短切日：{cutoffSummary.shortestCutoffDate ? formatDateLabel(cutoffSummary.shortestCutoffDate) : "未設定"}</p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {medicationCoreTimings.map((timing) => (
          <MedicationLine
            key={timing}
            timing={timing}
            items={items[timing] || []}
            labelOverride={!showAuditStatus && timing === "bedtime" ? "寝" : undefined}
            showPackageCount={!showAuditStatus}
          />
        ))}
      </div>

      {showAuditStatus ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-700">
          <span>包数：{packageCount}</span>
          <span>順番：{status === "completed" ? "確認済み" : "未確認"}</span>
        </div>
      ) : null}
      {hasTemporaryItem(items) ? <p className="mt-2 font-bold text-amber-800">臨時あり</p> : null}
    </article>
  );

  if (reorderMode) return content;
  return (
    <Link to={`/patients/${patient.id}/package-audit`} className="block h-full">
      {content}
    </Link>
  );
}

function MedicationLine({
  timing,
  items,
  labelOverride,
  showPackageCount = false
}: {
  timing: MedicationTiming;
  items: MedicationPackageItem[];
  labelOverride?: string;
  showPackageCount?: boolean;
}) {
  const hasItems = items.length > 0;
  return (
    <p className={hasItems ? "text-slate-900" : "rounded-md bg-slate-50 px-2 py-1 italic text-slate-400"}>
      <span className={`font-bold ${hasItems ? medicationLineLabelColors[timing] || "text-slate-700" : "text-slate-400"}`}>
        {labelOverride || medicationTimingLabels[timing]}
        {showPackageCount ? `（${items.length}）` : ""}：
      </span>
      {formatPackageItems(items)}
    </p>
  );
}

function PatientsPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialFacilityName =
    id === "new" ? new URLSearchParams(location.search).get("facility") || "" : "";
  const selectedId = id === "new" ? "" : id || data.patients[0]?.id || "";
  const selectedPatient = data.patients.find((patient) => patient.id === selectedId);

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <PatientSidebar
        data={data}
        selectedId={selectedId}
        onCreate={() => navigate("/patients/new")}
      />
      <PatientDetail
        key={`${id || selectedId || "new"}-${initialFacilityName}`}
        patient={id === "new" ? undefined : selectedPatient}
        initialFacilityName={initialFacilityName}
        data={data}
        reload={reload}
      />
    </div>
  );
}

function PatientSidebar({
  data,
  selectedId,
  onCreate
}: {
  data: AppData;
  selectedId: string;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.patients;
    return data.patients.filter((patient) =>
      [patient.name, patient.kana, patient.facilityName, patient.address]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [data.patients, query]);

  return (
    <aside className="space-y-3">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={20}
          />
          <input
            className="touch-target w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-3 text-base"
            placeholder="名前・施設名で検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          className="touch-target inline-flex items-center gap-2 rounded-md bg-care-700 px-4 py-2 font-semibold text-white"
        >
          <Plus size={20} />
          新規
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {filtered.length ? (
          filtered.map((patient) => {
            const visits = data.visits.filter((visit) => visit.patientId === patient.id);
            const visit = visits.find((item) => !item.completed);
            const patientTasks = data.tasks.filter((task) => task.patientId === patient.id);
            const highRisk = isPatientHighRisk(patient, data.visits, data.tasks);
            const todayAction = requiresActionToday(visit, patientTasks);
            return (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className={[
                  "block border-b border-slate-100 px-4 py-3 last:border-b-0",
                  selectedId === patient.id ? "bg-care-50" : "bg-white hover:bg-slate-50",
                  highRisk ? "border-l-4 border-l-rose-500" : todayAction ? "border-l-4 border-l-care-600" : ""
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-lg font-bold">{patient.name}</span>
                    <span className="text-slate-600">{formatLocationLabel(patient.facilityName, "自宅")}</span>
                  </span>
                  {todayAction ? (
                    <span className="rounded-md bg-care-100 px-2 py-1 text-sm font-bold text-care-900">
                      今日
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {highRisk ? <Badge tone="rose">要注意</Badge> : null}
                  {visit?.remainingDays && visit.remainingDays <= 3 ? (
                    <Badge tone="amber">残薬 {visit.remainingDays}日</Badge>
                  ) : null}
                  {patient.hasOneDosePackage ? <Badge tone="slate">一包化</Badge> : null}
                </div>
              </Link>
            );
          })
        ) : (
          <p className="p-4 text-slate-600">該当する患者はいません</p>
        )}
      </div>
    </aside>
  );
}

function PatientDetail({
  patient,
  initialFacilityName = "",
  data,
  reload
}: {
  patient?: Patient;
  initialFacilityName?: string;
  data: AppData;
  reload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState("");
  const [activeTab, setActiveTab] = useState<PatientDetailTab>("basic");
  const [form, setForm] = useState<PatientFormValues>(
    patient ? toPatientForm(patient) : createPatientForm(initialFacilityName)
  );
  const [outpatientInstitutionId, setOutpatientInstitutionId] = useState("");
  const existingVisit = patient ? data.visits.find((visit) => visit.patientId === patient.id && !visit.completed) : undefined;
  const [visit, setVisit] = useState<Visit>(existingVisit || emptyVisit(patient?.id || ""));
  const existingChecklist = patient
    ? data.checklists.find((item) => item.patientId === patient.id && item.date === todayString())
    : undefined;
  const [checklist, setChecklist] = useState<Checklist>(existingChecklist || emptyChecklist(patient?.id || ""));

  const patientTasks = patient ? data.tasks.filter((task) => task.patientId === patient.id) : [];
  const patientCalendars = patient
    ? data.medicationCalendars.filter((calendar) => calendar.patientId === patient.id)
    : [];
  const refillDays = daysUntil(visit.nextRefillDate);
  const selectedMainInstitution = data.medicalInstitutions.find(
    (institution) => institution.id === form.mainMedicalInstitutionId
  );
  const calculatedNextVisitDate = calcNextHomeVisitDate(
    form.lastVisitDate || "",
    Number(form.prescriptionDays) || 0,
    selectedMainInstitution?.homeVisitWeekday || ""
  );
  const displayedNextVisitDate = form.isNextVisitDateManual
    ? form.nextVisitDate || ""
    : calculatedNextVisitDate;
  const registeredLocationOptions = useMemo(
    () => getRegisteredLocationOptions(data.patients),
    [data.patients]
  );
  const isCustomLocation = !registeredLocationOptions.includes(form.facilityName || "");

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(""), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const updateForm = <K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateLocationLabel = (value: string) => {
    const label = value.trim();
    setForm((current) => ({
      ...current,
      locationType: label === "個人宅" || !label ? "home" : "facility",
      facilityName: label
    }));
  };
  const selectLocationLabel = (value: string) => {
    if (value === "__custom__") {
      if (!isCustomLocation) {
        updateLocationLabel("");
      }
      return;
    }
    updateLocationLabel(value);
  };

  const savePatient = async () => {
    if (!form.name.trim()) {
      setSaved("患者名を入力してください");
      return;
    }

    const timestamp = nowString();
    const patientId = patient?.id || createId();
    const locationLabel = normalizeFacilityCalendarName(form.facilityName.trim() || "個人宅");
    const isFacilityCalendarPatient = isFacilityCalendarFacility(locationLabel);
    const existingFacilitySlot = patient?.facilityCalendarSlot || form.facilityCalendarSlot;
    const facilityCalendarSlot = isFacilityCalendarPatient
      ? isValidFacilityCalendarSlot(existingFacilitySlot)
        ? existingFacilitySlot
        : getNextAvailableFacilityCalendarSlot(data.patients, patientId, locationLabel)
      : undefined;

    if (isFacilityCalendarPatient && !facilityCalendarSlot) {
      setSaved(`${locationLabel}カレンダーの空きマスがありません`);
      return;
    }

    const payload: Patient = {
      ...form,
      id: patientId,
      order: facilityCalendarSlot ? facilityCalendarSlot - 1 : patient?.order ?? data.patients.length,
      locationType: locationLabel === "個人宅" ? "home" : "facility",
      facilityName: locationLabel,
      facilityCalendarSlot,
      mainMedicalInstitutionId: form.mainMedicalInstitutionId || "",
      additionalMedicalInstitutionIds: form.additionalMedicalInstitutionIds || [],
      lastVisitDate: form.lastVisitDate || "",
      prescriptionDays: Number(form.prescriptionDays) || 0,
      nextVisitDate: form.isNextVisitDateManual ? form.nextVisitDate || "" : calculatedNextVisitDate,
      isNextVisitDateManual: Boolean(form.isNextVisitDateManual),
      billingMethod: form.billingMethod || "",
      billingName: form.billingName || "",
      billingMemo: form.billingMemo || "",
      billingChecked: Boolean(form.billingChecked),
      createdAt: patient?.createdAt || timestamp,
      updatedAt: timestamp
    };

    await db.patients.put(payload);

    if (!patient) {
      const newVisit = { ...emptyVisit(patientId), patientId, updatedAt: timestamp };
      const newChecklist = { ...emptyChecklist(patientId), patientId, updatedAt: timestamp };
      await Promise.all([db.visits.put(newVisit), db.checklists.put(newChecklist)]);
      navigate(`/patients/${patientId}`, { replace: true });
    }

    await reload();
    setSaved("保存しました");
  };

  const saveVisit = async () => {
    if (!patient) {
      setSaved("先に患者情報を保存してください");
      return;
    }
    const timestamp = nowString();
    await db.visits.put({
      ...visit,
      patientId: patient.id,
      nextRefillDate: calcNextRefillDate(visit.prescriptionDate, Number(visit.prescriptionDays)),
      prescriptionDays: Number(visit.prescriptionDays) || 0,
      remainingDays: Number(visit.remainingDays) || 0,
      updatedAt: timestamp
    });
    await reload();
    setSaved("予定を保存しました");
  };

  const saveChecklist = async () => {
    if (!patient) {
      setSaved("先に患者情報を保存してください");
      return;
    }
    const timestamp = nowString();
    await db.checklists.put({
      ...checklist,
      patientId: patient.id,
      updatedAt: timestamp
    });
    await reload();
    setSaved("チェックシートを保存しました");
  };

  const toggleTask = async (task: Task) => {
    await db.tasks.update(task.id, { completed: !task.completed, updatedAt: nowString() });
    await reload();
  };

  const deletePatient = async () => {
    if (!patient) return;
    const ok = window.confirm(`${patient.name} を削除します。関連する予定、タスク、服薬カレンダー、一包化データも削除されます。`);
    if (!ok) return;
    await deletePatientCascade(patient.id);
    await reload();
    navigate("/patients", { replace: true });
  };

  const additionalInstitutionIds = form.additionalMedicalInstitutionIds || [];
  const outpatientInstitutions = additionalInstitutionIds
    .map((id) => data.medicalInstitutions.find((institution) => institution.id === id))
    .filter((institution): institution is MedicalInstitution => Boolean(institution));
  const outpatientOptions = data.medicalInstitutions.filter(
    (institution) =>
      institution.id !== form.mainMedicalInstitutionId && !additionalInstitutionIds.includes(institution.id)
  );
  const updateMainInstitution = (id: string) => {
    setForm((current) => ({
      ...current,
      mainMedicalInstitutionId: id,
      additionalMedicalInstitutionIds: (current.additionalMedicalInstitutionIds || []).filter((item) => item !== id)
    }));
  };
  const addOutpatientInstitution = () => {
    if (!outpatientInstitutionId) return;
    setForm((current) => {
      const currentIds = current.additionalMedicalInstitutionIds || [];
      return {
        ...current,
        additionalMedicalInstitutionIds: Array.from(new Set([...currentIds, outpatientInstitutionId])).filter(
          (item) => item !== current.mainMedicalInstitutionId
        )
      };
    });
    setOutpatientInstitutionId("");
  };
  const removeOutpatientInstitution = (id: string) => {
    setForm((current) => ({
      ...current,
      additionalMedicalInstitutionIds: (current.additionalMedicalInstitutionIds || []).filter((item) => item !== id)
    }));
  };
  const enableManualNextVisitDate = () => {
    setForm((current) => ({
      ...current,
      isNextVisitDateManual: true,
      nextVisitDate: current.nextVisitDate || calculatedNextVisitDate
    }));
  };
  const disableManualNextVisitDate = () => {
    setForm((current) => ({
      ...current,
      isNextVisitDateManual: false,
      nextVisitDate: calculatedNextVisitDate
    }));
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <UserRound size={26} />
            {patient ? patient.name : "患者登録"}
          </h1>
          <button
            type="button"
            onClick={savePatient}
            className="touch-target inline-flex items-center gap-2 rounded-md bg-care-700 px-5 py-2 font-semibold text-white"
          >
            <Save size={20} />
            患者情報を保存
          </button>
        </div>
        <PatientDetailTabs activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "basic" ? (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <TextInput label="患者名" value={form.name} onChange={(value) => updateForm("name", value)} />
          <TextInput label="フリガナ" value={form.kana} onChange={(value) => updateForm("kana", value)} />
          <TextInput label="生年月日" type="date" value={form.birthday} onChange={(value) => updateForm("birthday", value)} />
          <label className="grid gap-1">
            <span className="font-semibold text-slate-700">所属先</span>
            <select
              className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
              value={isCustomLocation ? "__custom__" : form.facilityName}
              onChange={(event) => selectLocationLabel(event.target.value)}
            >
              {registeredLocationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
              <option value="__custom__">新しい所属先を入力</option>
            </select>
            {isCustomLocation ? (
              <input
                className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
                placeholder="所属先名"
                value={form.facilityName}
                onChange={(event) => updateLocationLabel(event.target.value)}
              />
            ) : null}
          </label>
          <TextInput label="主治医" value={form.doctorName} onChange={(value) => updateForm("doctorName", value)} />
          <label className="grid gap-1">
            <span className="font-semibold text-slate-700">医療機関（居宅）</span>
            <select
              className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
              value={form.mainMedicalInstitutionId || ""}
              onChange={(event) => updateMainInstitution(event.target.value)}
            >
              <option value="">未選択</option>
              {data.medicalInstitutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 md:col-span-2">
            <p className="font-semibold text-slate-700">医療機関（外来）</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
                value={outpatientInstitutionId}
                onChange={(event) => setOutpatientInstitutionId(event.target.value)}
              >
                <option value="">外来医療機関を選択</option>
                {outpatientOptions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addOutpatientInstitution}
                disabled={!outpatientInstitutionId}
                className="touch-target rounded-md bg-care-700 px-5 py-3 font-semibold text-white disabled:bg-slate-300"
              >
                追加
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {outpatientInstitutions.length ? (
                outpatientInstitutions.map((institution) => (
                  <span
                    key={institution.id}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-100 px-3 py-2 font-semibold text-slate-800"
                  >
                    {institution.name}
                    <button
                      type="button"
                      onClick={() => removeOutpatientInstitution(institution.id)}
                      className="rounded-md bg-white px-2 py-1 text-sm font-bold text-rose-700"
                    >
                      削除
                    </button>
                  </span>
                ))
              ) : (
                <p className="rounded-md bg-slate-100 p-3 text-slate-600">外来医療機関は未登録です</p>
              )}
            </div>
          </div>
          <TextInput label="訪問看護" value={form.nurseContact} onChange={(value) => updateForm("nurseContact", value)} />
          <TextInput label="家族連絡先" value={form.familyContact} onChange={(value) => updateForm("familyContact", value)} />
          <section className="grid gap-3 rounded-md border border-care-100 bg-care-50 p-4 md:col-span-2 md:grid-cols-4">
            <h2 className="text-lg font-bold text-care-950 md:col-span-4">往診日自動計算</h2>
            <DateInput
              label="前回往診日"
              value={form.lastVisitDate || ""}
              onChange={(value) => updateForm("lastVisitDate", value)}
            />
            <TextInput
              label="処方日数"
              type="number"
              value={form.prescriptionDays ? String(form.prescriptionDays) : ""}
              onChange={(value) => updateForm("prescriptionDays", Number(value) || 0)}
            />
            <div className="rounded-md border border-care-200 bg-white p-3">
              <p className="font-semibold text-slate-700">医療機関の往診曜日</p>
              <p className="mt-2 text-xl font-bold">
                {selectedMainInstitution?.homeVisitWeekday
                  ? homeVisitWeekdayLabels[selectedMainInstitution.homeVisitWeekday]
                  : "未設定"}
              </p>
            </div>
            <div className="grid gap-2">
              {form.isNextVisitDateManual ? (
                <DateInput
                  label="次回往診日"
                  value={form.nextVisitDate || ""}
                  onChange={(value) => updateForm("nextVisitDate", value)}
                />
              ) : (
                <div className="rounded-md border border-care-200 bg-white p-3">
                  <p className="font-semibold text-slate-700">次回往診日 自動計算結果</p>
                  <p className="mt-2 text-xl font-bold">
                    {displayedNextVisitDate ? formatDateLabel(displayedNextVisitDate) : "計算条件を入力"}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={form.isNextVisitDateManual ? disableManualNextVisitDate : enableManualNextVisitDate}
                className="touch-target rounded-md border border-care-300 bg-white px-4 py-2 font-semibold text-care-950"
              >
                {form.isNextVisitDateManual ? "自動計算に戻す" : "手動修正"}
              </button>
            </div>
          </section>
          <label className="grid gap-1 md:col-span-2">
            <span className="font-semibold text-slate-700">メモ</span>
            <textarea
              className="min-h-28 rounded-md border border-slate-300 px-3 py-3"
              value={form.memo}
              onChange={(event) => updateForm("memo", event.target.value)}
            />
          </label>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-4">
            <Toggle label="一包化あり" checked={form.hasOneDosePackage} onChange={(value) => updateForm("hasOneDosePackage", value)} />
            <Toggle label="粉砕あり" checked={form.hasCrushing} onChange={(value) => updateForm("hasCrushing", value)} />
            <Toggle label="麻薬あり" checked={form.hasNarcotics} onChange={(value) => updateForm("hasNarcotics", value)} />
            <Toggle
              label="冷所薬あり"
              checked={form.hasColdStorageMedicine}
              onChange={(value) => updateForm("hasColdStorageMedicine", value)}
            />
          </div>
        </div>
        ) : null}
      </section>

      {activeTab === "schedule" ? (
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-xl font-bold">訪問・配達管理</h2>
          <button
            type="button"
            onClick={saveVisit}
            className="touch-target rounded-md bg-slate-900 px-5 py-2 font-semibold text-white"
          >
            予定を保存
          </button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <DateInput label="次回訪問日" value={visit.visitDate} onChange={(value) => setVisitValue(setVisit, "visitDate", value)} />
          <DateInput label="次回配達日" value={visit.deliveryDate} onChange={(value) => setVisitValue(setVisit, "deliveryDate", value)} />
          <DateInput label="往診日" value={visit.homeVisitDate} onChange={(value) => setVisitValue(setVisit, "homeVisitDate", value)} />
          <DateInput label="退院日" value={visit.dischargeDate} onChange={(value) => setVisitValue(setVisit, "dischargeDate", value)} />
          <DateInput label="処方日" value={visit.prescriptionDate} onChange={(value) => {
            setVisit((current) => ({
              ...current,
              prescriptionDate: value,
              nextRefillDate: calcNextRefillDate(value, Number(current.prescriptionDays))
            }));
          }} />
          <TextInput
            label="処方日数"
            type="number"
            value={String(visit.prescriptionDays)}
            onChange={(value) => {
              const days = Number(value);
              setVisit((current) => ({
                ...current,
                prescriptionDays: days,
                nextRefillDate: calcNextRefillDate(current.prescriptionDate, days)
              }));
            }}
          />
          <TextInput
            label="残薬日数"
            type="number"
            value={String(visit.remainingDays)}
            onChange={(value) => setVisitValue(setVisit, "remainingDays", Number(value))}
          />
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-700">処方切れ予定日</p>
            <p className="mt-2 text-xl font-bold">{formatDateLabel(visit.nextRefillDate)}</p>
          </div>
          <div className={["rounded-md border p-3", refillDays <= 3 ? "border-rose-200 bg-rose-50 text-rose-950" : "border-care-100 bg-care-50 text-care-950"].join(" ")}>
            <p className="font-semibold">残薬不足警告</p>
            <p className="mt-2 text-xl font-bold">
              {visit.remainingDays <= 3 || refillDays <= 3 ? "対応が必要" : "通常"}
            </p>
          </div>
          <label className="grid gap-1 md:col-span-3">
            <span className="font-semibold text-slate-700">予定メモ</span>
            <textarea
              className="min-h-24 rounded-md border border-slate-300 px-3 py-3"
              value={visit.memo}
              onChange={(event) => setVisitValue(setVisit, "memo", event.target.value)}
            />
          </label>
        </div>
      </section>
      ) : null}

      {activeTab === "tasks" ? (
        <PatientTasks patient={patient} tasks={patientTasks} reload={reload} onToggle={toggleTask} />
      ) : null}

      {activeTab === "checklist" ? (
        <ChecklistPanel checklist={checklist} setChecklist={setChecklist} onSave={saveChecklist} />
      ) : null}

      {activeTab === "medication" ? (
        <MedicationCalendarPanel
          patient={patient}
          calendars={patientCalendars}
          days={data.medicationCalendarDays}
          audits={data.medicationCalendarAudits}
          reload={reload}
          setSaved={setSaved}
        />
      ) : null}

      {activeTab === "billing" ? (
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xl font-bold">請求</h2>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">請求方法</span>
              <select
                className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
                value={form.billingMethod || ""}
                onChange={(event) => updateForm("billingMethod", event.target.value as BillingMethod)}
              >
                <option value="">未選択</option>
                {Object.entries(billingMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextInput
              label="請求先"
              value={form.billingName || ""}
              onChange={(value) => updateForm("billingName", value)}
            />
            <label className="grid gap-1 md:col-span-2">
              <span className="font-semibold text-slate-700">メモ</span>
              <textarea
                className="min-h-28 rounded-md border border-slate-300 px-3 py-3"
                value={form.billingMemo || ""}
                onChange={(event) => updateForm("billingMemo", event.target.value)}
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === "other" ? (
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-xl font-bold">その他</h2>
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <h3 className="text-lg font-bold text-rose-950">患者データの削除</h3>
              <p className="mt-2 text-rose-900">
                患者情報、予定、タスク、チェックシート、服薬カレンダー、一包化データをまとめて削除します。
              </p>
              <button
                type="button"
                onClick={() => void deletePatient()}
                disabled={!patient}
                className="touch-target mt-4 rounded-md bg-rose-600 px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                患者を削除
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {saved ? (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md bg-slate-900 px-5 py-3 font-semibold text-white shadow-lg">
          {saved}
        </div>
      ) : null}
    </div>
  );
}

function PatientDetailTabs({
  activeTab,
  onChange
}: {
  activeTab: PatientDetailTab;
  onChange: (tab: PatientDetailTab) => void;
}) {
  const tabs: Array<{ id: PatientDetailTab; label: string; icon: typeof UserRound }> = [
    { id: "basic", label: "基本情報", icon: UserRound },
    { id: "schedule", label: "予定", icon: CalendarDays },
    { id: "tasks", label: "タスク", icon: ClipboardCheck },
    { id: "checklist", label: "チェック", icon: CheckCircle2 },
    { id: "medication", label: "服薬カレンダー", icon: Pill },
    { id: "billing", label: "請求", icon: CreditCard },
    { id: "other", label: "その他", icon: Settings }
  ];

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={[
            "touch-target inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2 font-semibold",
            activeTab === id ? "bg-care-700 text-white" : "bg-slate-100 text-slate-700"
          ].join(" ")}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </div>
  );
}

function PatientTasks({
  patient,
  tasks,
  reload,
  onToggle
}: {
  patient?: Patient;
  tasks: Task[];
  reload: () => Promise<void>;
  onToggle: (task: Task) => Promise<void>;
}) {
  const [showOpenOnly, setShowOpenOnly] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("delivery");
  const [dueDate, setDueDate] = useState(todayString());
  const visibleTasks = showOpenOnly ? tasks.filter((task) => !task.completed) : tasks;

  const addTask = async () => {
    if (!patient || !title.trim()) return;
    await db.tasks.add({
      id: createId(),
      patientId: patient.id,
      title: title.trim(),
      type,
      dueDate,
      completed: false,
      memo: "",
      createdAt: nowString(),
      updatedAt: nowString()
    });
    setTitle("");
    await reload();
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-xl font-bold">タスク管理</h2>
        <Toggle label="未完了のみ" checked={showOpenOnly} onChange={setShowOpenOnly} />
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <TextInput label="タスク追加" value={title} onChange={setTitle} />
        <label className="grid gap-1">
          <span className="font-semibold text-slate-700">種別</span>
          <select
            className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
            value={type}
            onChange={(event) => setType(event.target.value as TaskType)}
          >
            {Object.entries(taskTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <DateInput label="期限" value={dueDate} onChange={setDueDate} />
        <button
          type="button"
          onClick={addTask}
          disabled={!patient}
          className="touch-target self-end rounded-md bg-care-700 px-5 py-3 font-semibold text-white disabled:bg-slate-300"
        >
          追加
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {visibleTasks.length ? (
          visibleTasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => void onToggle(task)}
              className={[
                "flex w-full items-center justify-between gap-4 px-4 py-3 text-left",
                task.completed ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50"
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <CheckCircle2 className={task.completed ? "text-care-600" : "text-slate-300"} size={26} />
                <span>
                  <span className="block text-lg font-bold">{task.title}</span>
                  <span>{taskTypeLabels[task.type]} / {formatDateLabel(task.dueDate)}</span>
                </span>
              </span>
              {isDueToday(task.dueDate) && !task.completed ? <Badge tone="care">今日</Badge> : null}
            </button>
          ))
        ) : (
          <p className="px-4 py-5 text-slate-600">表示するタスクはありません</p>
        )}
      </div>
    </section>
  );
}

function ChecklistPanel({
  checklist,
  setChecklist,
  onSave
}: {
  checklist: Checklist;
  setChecklist: React.Dispatch<React.SetStateAction<Checklist>>;
  onSave: () => Promise<void>;
}) {
  const checks: Array<[keyof Checklist, string]> = [
    ["prescriptionChecked", "処方内容確認"],
    ["remainingMedicineChecked", "残薬確認"],
    ["oneDosePackageChecked", "一包化確認"],
    ["adherenceChecked", "服薬状況確認"],
    ["sideEffectChecked", "副作用確認"],
    ["interactionChecked", "併用薬確認"],
    ["conditionChecked", "体調変化確認"]
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-xl font-bold">在宅チェックシート</h2>
        <button
          type="button"
          onClick={() => void onSave()}
          className="touch-target rounded-md bg-slate-900 px-5 py-2 font-semibold text-white"
        >
          チェックを保存
        </button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {checks.map(([key, label]) => (
          <Toggle
            key={String(key)}
            label={label}
            checked={Boolean(checklist[key])}
            onChange={(value) => setChecklist((current) => ({ ...current, [key]: value }))}
          />
        ))}
        <label className="grid gap-1 md:col-span-2">
          <span className="font-semibold text-slate-700">医師への確認事項</span>
          <textarea
            className="min-h-24 rounded-md border border-slate-300 px-3 py-3"
            value={checklist.doctorNote}
            onChange={(event) => setChecklist((current) => ({ ...current, doctorNote: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="font-semibold text-slate-700">家族・施設への連絡事項</span>
          <textarea
            className="min-h-24 rounded-md border border-slate-300 px-3 py-3"
            value={checklist.familyNote}
            onChange={(event) => setChecklist((current) => ({ ...current, familyNote: event.target.value }))}
          />
        </label>
        <Toggle
          label="チェックシート完了"
          checked={checklist.completed}
          onChange={(value) => setChecklist((current) => ({ ...current, completed: value }))}
        />
      </div>
    </section>
  );
}

function MedicationCalendarPanel({
  patient,
  calendars,
  days,
  audits,
  reload,
  setSaved
}: {
  patient?: Patient;
  calendars: MedicationCalendar[];
  days: MedicationCalendarDay[];
  audits: MedicationCalendarAudit[];
  reload: () => Promise<void>;
  setSaved: (message: string) => void;
}) {
  const sortedCalendars = [...calendars].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const [selectedCalendarId, setSelectedCalendarId] = useState(sortedCalendars[0]?.id || "");
  const selectedCalendar = sortedCalendars.find((calendar) => calendar.id === selectedCalendarId) || sortedCalendars[0];
  const calendarDays = selectedCalendar
    ? days.filter((day) => day.calendarId === selectedCalendar.id).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const [selectedDayId, setSelectedDayId] = useState(calendarDays[0]?.id || "");
  const selectedDay = calendarDays.find((day) => day.id === selectedDayId) || calendarDays[0];
  const [selectedTiming, setSelectedTiming] = useState<MedicationTiming>("morning");
  const selectedAudit = selectedDay
    ? audits.find((audit) => audit.calendarDayId === selectedDay.id && audit.timing === selectedTiming)
    : undefined;
  const [calendarForm, setCalendarForm] = useState<MedicationCalendar>(
    selectedCalendar || emptyMedicationCalendar(patient?.id || "")
  );
  const [dayForm, setDayForm] = useState<MedicationCalendarDay>(
    selectedDay || emptyMedicationCalendarDay(selectedCalendar?.id || "", todayString())
  );
  const [auditForm, setAuditForm] = useState<MedicationCalendarAudit>(
    selectedAudit || emptyMedicationAudit(selectedDay?.id || "", selectedTiming)
  );

  useEffect(() => {
    if (!selectedCalendarId && sortedCalendars[0]) {
      setSelectedCalendarId(sortedCalendars[0].id);
    }
  }, [selectedCalendarId, sortedCalendars]);

  useEffect(() => {
    if (selectedCalendar) {
      setCalendarForm(selectedCalendar);
    }
  }, [selectedCalendar]);

  useEffect(() => {
    if (calendarDays[0] && !calendarDays.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(calendarDays[0].id);
    }
  }, [calendarDays, selectedDayId]);

  useEffect(() => {
    if (selectedDay) {
      setDayForm(selectedDay);
    }
  }, [selectedDay]);

  useEffect(() => {
    if (selectedAudit) {
      setAuditForm(selectedAudit);
    } else if (selectedDay) {
      setAuditForm(emptyMedicationAudit(selectedDay.id, selectedTiming));
    }
  }, [selectedAudit, selectedDay, selectedTiming]);

  const createCalendar = async () => {
    if (!patient) {
      setSaved("先に患者情報を保存してください");
      return;
    }
    if (!calendarForm.startDate || !calendarForm.endDate || calendarForm.endDate < calendarForm.startDate) {
      setSaved("対象期間を確認してください");
      return;
    }

    const timestamp = nowString();
    const calendar: MedicationCalendar = {
      ...calendarForm,
      id: createId(),
      patientId: patient.id,
      status: "notStarted",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const generatedDays = eachDayOfInterval({
      start: parseISO(calendar.startDate),
      end: parseISO(calendar.endDate)
    }).map((date) => emptyMedicationCalendarDay(calendar.id, format(date, "yyyy-MM-dd")));
    const generatedAudits = generatedDays.flatMap((day) =>
      medicationCoreTimings.map((timing) => emptyMedicationAudit(day.id, timing))
    );

    await db.transaction(
      "rw",
      db.medicationCalendars,
      db.medicationCalendarDays,
      db.medicationCalendarAudits,
      async () => {
        await db.medicationCalendars.add(calendar);
        await db.medicationCalendarDays.bulkAdd(generatedDays);
        await db.medicationCalendarAudits.bulkAdd(generatedAudits);
      }
    );
    setSelectedCalendarId(calendar.id);
    setSelectedDayId(generatedDays[0]?.id || "");
    await reload();
    setSaved("服薬カレンダーを作成しました");
  };

  const saveCalendar = async () => {
    if (!selectedCalendar || !patient) return;
    if (!calendarForm.startDate || !calendarForm.endDate || calendarForm.endDate < calendarForm.startDate) {
      setSaved("対象期間を確認してください");
      return;
    }
    const timestamp = nowString();
    const rangeDates = eachDayOfInterval({
      start: parseISO(calendarForm.startDate),
      end: parseISO(calendarForm.endDate)
    }).map((date) => format(date, "yyyy-MM-dd"));
    const existingDates = new Set(calendarDays.map((day) => day.date));
    const missingDays = rangeDates
      .filter((date) => !existingDates.has(date))
      .map((date) => emptyMedicationCalendarDay(selectedCalendar.id, date));
    const missingAudits = missingDays.flatMap((day) =>
      medicationCoreTimings.map((timing) => emptyMedicationAudit(day.id, timing))
    );

    await db.transaction(
      "rw",
      db.medicationCalendars,
      db.medicationCalendarDays,
      db.medicationCalendarAudits,
      async () => {
        await db.medicationCalendars.put({
      ...calendarForm,
      id: selectedCalendar.id,
      patientId: patient.id,
          updatedAt: timestamp
        });
        if (missingDays.length) {
          await db.medicationCalendarDays.bulkAdd(missingDays);
          await db.medicationCalendarAudits.bulkAdd(missingAudits);
        }
      }
    );
    await reload();
    setSaved("服薬カレンダーを保存しました");
  };

  const saveDay = async () => {
    if (!selectedCalendar || !selectedDay) return;
    const timestamp = nowString();
    const nextDay: MedicationCalendarDay = {
      ...dayForm,
      hasIssue: Boolean(dayForm.issueMemo.trim()) || getMedicationDayDataWarnings(dayForm).length > 0,
      updatedAt: timestamp
    };
    await db.medicationCalendarDays.put(nextDay);

    const nextDays = calendarDays.map((day) => (day.id === nextDay.id ? nextDay : day));
    await db.medicationCalendars.update(selectedCalendar.id, {
      status: deriveMedicationStatus(nextDays),
      updatedAt: timestamp
    });
    await reload();
    setSaved("日付の内容を保存しました");
  };

  const saveAudit = async () => {
    if (!selectedDay) return;
    const allChecked = medicationAuditChecks.every(([key]) => Boolean(auditForm[key]));
    await db.medicationCalendarAudits.put({
      ...auditForm,
      calendarDayId: selectedDay.id,
      timing: selectedTiming,
      auditedAt: allChecked ? nowString() : auditForm.auditedAt,
      updatedAt: nowString()
    });
    await reload();
    setSaved("鑑査チェックを保存しました");
  };

  const completionRate = getMedicationCompletionRate(calendarDays);
  const warningCount = calendarDays.reduce((count, day) => count + getMedicationDayWarnings(day).length, 0);

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Pill size={24} />
            服薬カレンダー
          </h2>
          <div className="flex flex-wrap gap-2">
            {selectedCalendar ? (
              <button
                type="button"
                onClick={saveCalendar}
                className="touch-target rounded-md border border-slate-300 px-4 py-2 font-semibold"
              >
                期間を保存
              </button>
            ) : null}
            <button
              type="button"
              onClick={createCalendar}
              disabled={!patient}
              className="touch-target rounded-md bg-care-700 px-4 py-2 font-semibold text-white disabled:bg-slate-300"
            >
              カレンダー作成
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_150px_150px_160px]">
          <label className="grid gap-1">
            <span className="font-semibold text-slate-700">対象カレンダー</span>
            <select
              className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
              value={selectedCalendar?.id || ""}
              onChange={(event) => setSelectedCalendarId(event.target.value)}
            >
              {sortedCalendars.length ? (
                sortedCalendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {formatDateLabel(calendar.startDate)} - {formatDateLabel(calendar.endDate)}
                  </option>
                ))
              ) : (
                <option value="">未作成</option>
              )}
            </select>
          </label>
          <DateInput
            label="開始日"
            value={calendarForm.startDate}
            onChange={(value) => setCalendarForm((current) => ({ ...current, startDate: value }))}
          />
          <DateInput
            label="終了日"
            value={calendarForm.endDate}
            onChange={(value) => setCalendarForm((current) => ({ ...current, endDate: value }))}
          />
          <label className="grid gap-1">
            <span className="font-semibold text-slate-700">鑑査ステータス</span>
            <select
              className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
              value={calendarForm.status}
              onChange={(event) =>
                setCalendarForm((current) => ({
                  ...current,
                  status: event.target.value as MedicationCalendarStatus
                }))
              }
            >
              {Object.entries(medicationStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={completionRate === 100 ? "care" : "amber"}>完了率 {completionRate}%</Badge>
          {selectedCalendar ? <Badge tone="slate">{medicationStatusLabels[selectedCalendar.status]}</Badge> : null}
          {warningCount > 0 ? <Badge tone="rose">自動警告 {warningCount}件</Badge> : null}
        </div>
      </div>

      {selectedCalendar && selectedDay ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">カレンダーメモ</span>
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-3"
                value={calendarForm.memo}
                onChange={(event) => setCalendarForm((current) => ({ ...current, memo: event.target.value }))}
              />
            </label>
            <div className="overflow-hidden rounded-md border border-slate-200">
              {calendarDays.map((day) => {
                const warnings = getMedicationDayWarnings(day);
                return (
                  <button
                    type="button"
                    key={day.id}
                    onClick={() => setSelectedDayId(day.id)}
                    className={[
                      "flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 text-left last:border-b-0",
                      getMedicationDayTone(day),
                      selectedDay.id === day.id ? "outline outline-2 outline-care-600" : ""
                    ].join(" ")}
                  >
                    <span>
                      <span className="block font-bold">{formatDateLabel(day.date)}</span>
                      <span className="text-sm text-slate-600">
                        {day.checked ? "鑑査済み" : day.hasIssue ? "要確認" : "未鑑査"}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      {warnings.length ? <AlertTriangle size={20} className="text-rose-700" /> : null}
                      {day.memo || day.issueMemo ? <MessageSquareText size={20} className="text-slate-600" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {medicationCoreTimings.map((timing) => (
                <label key={timing} className="grid gap-1">
                  <span className="font-semibold text-slate-700">{medicationTimingLabels[timing]}</span>
                  <textarea
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-3"
                    value={String(dayForm[timing])}
                    onChange={(event) =>
                      setDayForm((current) => ({ ...current, [timing]: event.target.value }))
                    }
                  />
                </label>
              ))}
              <TextInput
                label="頓服"
                value={dayForm.asNeeded}
                onChange={(value) => setDayForm((current) => ({ ...current, asNeeded: value }))}
              />
              <TextInput
                label="外用"
                value={dayForm.external}
                onChange={(value) => setDayForm((current) => ({ ...current, external: value }))}
              />
              <label className="grid gap-1 md:col-span-2">
                <span className="font-semibold text-slate-700">注意メモ</span>
                <textarea
                  className="min-h-20 rounded-md border border-slate-300 px-3 py-3"
                  value={dayForm.memo}
                  onChange={(event) => setDayForm((current) => ({ ...current, memo: event.target.value }))}
                />
              </label>
              <label className="grid gap-1 md:col-span-2">
                <span className="font-semibold text-slate-700">要確認メモ</span>
                <textarea
                  className="min-h-20 rounded-md border border-rose-200 bg-rose-50 px-3 py-3"
                  value={dayForm.issueMemo}
                  onChange={(event) =>
                    setDayForm((current) => ({
                      ...current,
                      issueMemo: event.target.value,
                      hasIssue: Boolean(event.target.value.trim())
                    }))
                  }
                />
              </label>
              <Toggle
                label="この日を鑑査済み"
                checked={dayForm.checked}
                onChange={(value) => setDayForm((current) => ({ ...current, checked: value }))}
              />
              <button
                type="button"
                onClick={saveDay}
                className="touch-target rounded-md bg-slate-900 px-5 py-3 font-semibold text-white"
              >
                日付内容を保存
              </button>
            </div>

            <div className="rounded-md border border-slate-200">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-lg font-bold">鑑査チェックリスト</h3>
              </div>
              <div className="grid gap-3 p-4">
                <div className="flex flex-wrap gap-2">
                  {medicationCoreTimings.map((timing) => (
                    <button
                      key={timing}
                      type="button"
                      onClick={() => setSelectedTiming(timing)}
                      className={[
                        "touch-target rounded-md px-4 py-2 font-semibold",
                        selectedTiming === timing ? "bg-care-700 text-white" : "bg-slate-100 text-slate-700"
                      ].join(" ")}
                    >
                      {medicationTimingLabels[timing]}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {medicationAuditChecks.map(([key, label]) => (
                    <Toggle
                      key={String(key)}
                      label={label}
                      checked={Boolean(auditForm[key])}
                      onChange={(value) => setAuditForm((current) => ({ ...current, [key]: value }))}
                    />
                  ))}
                </div>
                <label className="grid gap-1">
                  <span className="font-semibold text-slate-700">鑑査メモ</span>
                  <textarea
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-3"
                    value={auditForm.auditorMemo}
                    onChange={(event) =>
                      setAuditForm((current) => ({ ...current, auditorMemo: event.target.value }))
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={saveAudit}
                  className="touch-target rounded-md bg-care-700 px-5 py-3 font-semibold text-white"
                >
                  鑑査チェックを保存
                </button>
              </div>
            </div>

            {getMedicationDayWarnings(dayForm).length ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950">
                <p className="font-bold">自動警告</p>
                <ul className="mt-2 list-disc pl-5">
                  {getMedicationDayWarnings(dayForm).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="p-5 text-slate-600">服薬カレンダーは未作成です。開始日と終了日を確認して作成してください。</div>
      )}
    </section>
  );
}

function MedicalInstitutionsPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MedicalInstitutionType | "all">("all");
  const [editingId, setEditingId] = useState<string>("");
  const editingInstitution = data.medicalInstitutions.find((institution) => institution.id === editingId);
  const [form, setForm] = useState<Omit<MedicalInstitution, "id" | "createdAt" | "updatedAt">>(
    emptyMedicalInstitutionForm
  );
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (editingInstitution) {
      const { id, createdAt, updatedAt, ...nextForm } = editingInstitution;
      setForm({
        ...nextForm,
        homeVisitWeekday: nextForm.homeVisitWeekday || ""
      });
    } else {
      setForm(emptyMedicalInstitutionForm);
    }
  }, [editingInstitution]);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(""), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const filteredInstitutions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.medicalInstitutions.filter((institution) => {
      const matchesQuery =
        !normalized ||
        [
          institution.name,
          institution.kana,
          institution.phone,
          institution.fax,
          institution.address,
          institution.homeVisitWeekday ? homeVisitWeekdayLabels[institution.homeVisitWeekday] : ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesType = typeFilter === "all" || institution.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [data.medicalInstitutions, query, typeFilter]);
  const editingCutoffSummary = editingInstitution
    ? getMedicalInstitutionCutoffSummary({
        institution: editingInstitution,
        patients: data.patients,
        cutoffs: data.medicationClinicCutoffs,
        packagePatterns: data.medicationPackagePatterns,
        packageItems: data.medicationPackageItems
      })
    : undefined;

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveInstitution = async () => {
    if (!form.name.trim()) {
      setSaved("医療機関名を入力してください");
      return;
    }
    const timestamp = nowString();
    const institution: MedicalInstitution = {
      ...form,
      id: editingInstitution?.id || createId(),
      createdAt: editingInstitution?.createdAt || timestamp,
      updatedAt: timestamp
    };
    await db.medicalInstitutions.put(institution);
    setEditingId(institution.id);
    await reload();
    setSaved("保存しました");
  };

  const deleteInstitution = async () => {
    if (!editingInstitution) return;
    const ok = window.confirm(
      `${editingInstitution.name} を削除します。患者との紐付けと一包化編集内の医療機関名も解除されます。`
    );
    if (!ok) return;
    await db.transaction("rw", [db.medicalInstitutions, db.patients, db.medicationPackageItems], async () => {
      await db.medicalInstitutions.delete(editingInstitution.id);
      const linkedPatients = data.patients.filter(
        (patient) =>
          patient.mainMedicalInstitutionId === editingInstitution.id ||
          (patient.additionalMedicalInstitutionIds || []).includes(editingInstitution.id)
      );
      await Promise.all(
        linkedPatients.map((patient) =>
          db.patients.update(patient.id, {
            mainMedicalInstitutionId:
              patient.mainMedicalInstitutionId === editingInstitution.id ? "" : patient.mainMedicalInstitutionId || "",
            additionalMedicalInstitutionIds: (patient.additionalMedicalInstitutionIds || []).filter(
              (id) => id !== editingInstitution.id
            ),
            updatedAt: nowString()
          })
        )
      );
      await db.medicationPackageItems
        .where("clinicName")
        .equals(editingInstitution.name)
        .modify({ clinicName: "", updatedAt: nowString() });
    });
    setEditingId("");
    await reload();
    setSaved("削除しました");
  };

  const saveInstitutionCutoff = async (
    patient: Patient,
    institution: MedicalInstitution,
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string }
  ) => {
    const timestamp = nowString();
    const existing = data.medicationClinicCutoffs.find(
      (cutoff) => cutoff.patientId === patient.id && cutoff.medicalInstitutionId === institution.id
    );
    await db.medicationClinicCutoffs.put({
      id: existing?.id || createId(),
      patientId: patient.id,
      medicalInstitutionId: institution.id,
      previousCutoffDate: values.previousCutoffDate,
      prescriptionDays: Number(values.prescriptionDays) || 0,
      nextCutoffDate:
        values.nextCutoffDate || calcNextCutoffDate(values.previousCutoffDate, Number(values.prescriptionDays) || 0),
      memo: existing?.memo || "",
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp
    });
    await reload();
    setSaved("切日を保存しました");
  };

  const applyInstitutionCutoffToPatients = async (
    institution: MedicalInstitution,
    patients: Patient[],
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string }
  ) => {
    const timestamp = nowString();
    const nextCutoffDate =
      values.nextCutoffDate || calcNextCutoffDate(values.previousCutoffDate, Number(values.prescriptionDays) || 0);
    const cutoffs: MedicationClinicCutoff[] = patients.map((patient) => {
      const existing = data.medicationClinicCutoffs.find(
        (cutoff) => cutoff.patientId === patient.id && cutoff.medicalInstitutionId === institution.id
      );
      return {
        id: existing?.id || createId(),
        patientId: patient.id,
        medicalInstitutionId: institution.id,
        previousCutoffDate: values.previousCutoffDate,
        prescriptionDays: Number(values.prescriptionDays) || 0,
        nextCutoffDate,
        memo: existing?.memo || "",
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp
      };
    });

    if (cutoffs.length) {
      await db.medicationClinicCutoffs.bulkPut(cutoffs);
    }
    await reload();
    setSaved(`${cutoffs.length}名の切日に反映しました`);
    return cutoffs.length;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h1 className="text-2xl font-bold">医療機関一覧</h1>
          <button
            type="button"
            onClick={() => setEditingId("")}
            className="touch-target inline-flex items-center gap-2 rounded-md bg-care-700 px-4 py-2 font-semibold text-white"
          >
            <Plus size={20} />
            新規
          </button>
        </div>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={20}
            />
            <input
              className="touch-target w-full rounded-md border border-slate-300 bg-white py-3 pl-10 pr-3 text-base"
              placeholder="医療機関名・フリガナで検索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as MedicalInstitutionType | "all")}
          >
            <option value="all">すべての種別</option>
            {Object.entries(medicalInstitutionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredInstitutions.length ? (
            filteredInstitutions.map((institution) => {
              const patientCount = getMedicalInstitutionPatientCount(institution.id, data.patients);
              return (
                <button
                  key={institution.id}
                  type="button"
                  onClick={() => setEditingId(institution.id)}
                  className={[
                    "grid w-full gap-3 px-4 py-4 text-left hover:bg-slate-50 md:grid-cols-[minmax(18rem,1fr)_96px_96px_92px_72px]",
                    editingId === institution.id ? "bg-care-50" : "bg-white"
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block text-xl font-bold leading-snug">{institution.name}</span>
                    <span className="text-sm text-slate-600">{institution.kana}</span>
                  </span>
                  <span className="self-center font-semibold">{medicalInstitutionTypeLabels[institution.type]}</span>
                  <span className="self-center font-semibold">
                    {institution.homeVisitWeekday ? homeVisitWeekdayLabels[institution.homeVisitWeekday] : "-"}
                  </span>
                  <span className="self-center">
                    {institution.isMainHomeCareClinic ? <Badge tone="care">対象</Badge> : <Badge tone="slate">-</Badge>}
                  </span>
                  <span className="self-center font-bold">{patientCount}人</span>
                </button>
              );
            })
          ) : (
            <p className="p-5 text-slate-600">該当する医療機関はありません</p>
          )}
        </div>
      </section>

      <div className="space-y-4">
        {editingCutoffSummary ? (
          <MedicalInstitutionCutoffSummaryCard
            summary={editingCutoffSummary}
            onSaveCutoff={saveInstitutionCutoff}
            onApplyCutoffToPatients={applyInstitutionCutoffToPatients}
          />
        ) : null}
        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-xl font-bold">{editingInstitution ? "医療機関編集" : "医療機関追加"}</h2>
          <div className="mt-4 grid gap-3">
            <TextInput label="医療機関名" value={form.name} onChange={(value) => updateForm("name", value)} />
            <TextInput label="フリガナ" value={form.kana} onChange={(value) => updateForm("kana", value)} />
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">種別</span>
              <select
                className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value as MedicalInstitutionType)}
              >
                {Object.entries(medicalInstitutionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">往診曜日</span>
              <select
                className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
                value={form.homeVisitWeekday}
                onChange={(event) => updateForm("homeVisitWeekday", event.target.value as HomeVisitWeekday | "")}
              >
                <option value="">未設定</option>
                {Object.entries(homeVisitWeekdayLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextInput label="電話番号" value={form.phone} onChange={(value) => updateForm("phone", value)} />
            <TextInput label="FAX" value={form.fax} onChange={(value) => updateForm("fax", value)} />
            <TextInput label="住所" value={form.address} onChange={(value) => updateForm("address", value)} />
            <Toggle
              label="メイン在宅クリニック対象"
              checked={form.isMainHomeCareClinic}
              onChange={(value) => updateForm("isMainHomeCareClinic", value)}
            />
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">メモ</span>
              <textarea
                className="min-h-28 rounded-md border border-slate-300 px-3 py-3"
                value={form.memo}
                onChange={(event) => updateForm("memo", event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void saveInstitution()}
              className="touch-target rounded-md bg-care-700 px-5 py-3 font-semibold text-white"
            >
              保存
            </button>
            {editingInstitution ? (
              <button
                type="button"
                onClick={() => void deleteInstitution()}
                className="touch-target rounded-md bg-rose-600 px-5 py-3 font-semibold text-white"
              >
                医療機関を削除
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      {saved ? (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md bg-slate-900 px-5 py-3 font-semibold text-white shadow-lg">
          {saved}
        </div>
      ) : null}
    </div>
  );
}

function PackageAuditEditor({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = data.patients.find((item) => item.id === id);
  const [activePackageTab, setActivePackageTab] = useState<"items" | "cutoffs" | "photos">("items");
  const [selectedTiming, setSelectedTiming] = useState<MedicationTiming>("morning");
  const [savedItemId, setSavedItemId] = useState("");
  const packagePhotos = patient
    ? data.medicationPackagePhotos
        .filter((photo) => photo.patientId === patient.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const pattern = patient
    ? data.medicationPackagePatterns.find(
        (item) => item.patientId === patient.id && item.timing === selectedTiming
      )
    : undefined;
  const patternItems = pattern
    ? sortPackageItemsForPatient(
        patient,
        data.medicationPackageItems.filter((item) => item.patternId === pattern.id),
        data.medicalInstitutions
      )
    : [];
  const linkedInstitutions = patient ? getPatientMedicalInstitutions(patient, data.medicalInstitutions) : [];
  const packageInstitutionOptions = linkedInstitutions.length ? linkedInstitutions : data.medicalInstitutions;
  const patientCutoffs = patient
    ? data.medicationClinicCutoffs.filter((cutoff) => cutoff.patientId === patient.id)
    : [];
  const cutoffInstitutions = linkedInstitutions;
  const [draft, setDraft] = useState<Omit<MedicationPackageItem, "id" | "patternId" | "order" | "createdAt" | "updatedAt">>({
    dosageForm: "tablet",
    quantity: "",
    medicineName: "",
    clinicName: "",
    packageChangeType: "none" as const,
    isAdded: false,
    isChanged: false,
    isTemporary: false,
    isStopped: false,
    isSelfAdjustment: false,
    memo: ""
  });

  const ensurePattern = async () => {
    if (!patient) return undefined;
    const existing = data.medicationPackagePatterns.find(
      (item) => item.patientId === patient.id && item.timing === selectedTiming
    );
    if (existing) return existing;

    const nextPattern: MedicationPackagePattern = {
      id: createId(),
      patientId: patient.id,
      timing: selectedTiming,
      updatedAt: nowString()
    };
    await db.medicationPackagePatterns.add(nextPattern);
    await reload();
    return nextPattern;
  };

  const addPackageItem = async () => {
    const targetPattern = await ensurePattern();
    if (!targetPattern || !patient) return;
    const timestamp = nowString();
    const nextItem: MedicationPackageItem = {
      ...draft,
      id: createId(),
      patternId: targetPattern.id,
      order: patternItems.length,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await db.medicationPackageItems.add(nextItem);
    await normalizePackageOrder(sortPackageItemsByBasicRule(patient, [...patternItems, nextItem], data.medicalInstitutions));
    setDraft({
      dosageForm: "tablet",
      quantity: "",
      medicineName: "",
      clinicName: "",
      packageChangeType: "none",
      isAdded: false,
      isChanged: false,
      isTemporary: false,
      isStopped: false,
      isSelfAdjustment: false,
      memo: ""
    });
    await reload();
  };

  const updatePackageItem = async (item: MedicationPackageItem, patch: Partial<MedicationPackageItem>) => {
    if (!patient) return;
    const updatedAt = nowString();
    await db.medicationPackageItems.update(item.id, { ...patch, updatedAt });
    const nextItems = patternItems.map((current) =>
      current.id === item.id ? { ...current, ...patch, updatedAt } : current
    );
    await normalizePackageOrder(sortPackageItemsByBasicRule(patient, nextItems, data.medicalInstitutions));
    await reload();
    setSavedItemId(item.id);
    window.setTimeout(() => {
      setSavedItemId((current) => (current === item.id ? "" : current));
    }, 2400);
  };

  const deletePackageItem = async (item: MedicationPackageItem) => {
    await db.medicationPackageItems.delete(item.id);
    await normalizePackageOrder(patternItems.filter((current) => current.id !== item.id));
    await reload();
  };

  const movePackageItem = async (item: MedicationPackageItem, direction: -1 | 1) => {
    const currentIndex = patternItems.findIndex((current) => current.id === item.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= patternItems.length) return;
    await normalizePackageOrder(arrayMove(patternItems, currentIndex, nextIndex));
    await reload();
  };

  const addPackagePhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!patient || !event.target.files?.length) return;
    const files = Array.from(event.target.files).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    const timestamp = nowString();
    const photos = await Promise.all(
      files.map(async (file) => ({
        id: createId(),
        patientId: patient.id,
        imageDataUrl: await fileToDataUrl(file),
        memo: "",
        createdAt: timestamp,
        updatedAt: timestamp
      }))
    );
    await db.medicationPackagePhotos.bulkAdd(photos);
    event.target.value = "";
    await reload();
  };

  const updatePackagePhoto = async (photo: MedicationPackagePhoto, patch: Partial<MedicationPackagePhoto>) => {
    await db.medicationPackagePhotos.update(photo.id, { ...patch, updatedAt: nowString() });
    await reload();
  };

  const deletePackagePhoto = async (photo: MedicationPackagePhoto) => {
    const ok = window.confirm("この写真を削除します。");
    if (!ok) return;
    await db.medicationPackagePhotos.delete(photo.id);
    await reload();
  };

  const saveClinicCutoff = async (
    institution: MedicalInstitution,
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string; memo: string }
  ) => {
    if (!patient) return;
    const timestamp = nowString();
    const existing = patientCutoffs.find((cutoff) => cutoff.medicalInstitutionId === institution.id);
    const nextCutoffDate = values.nextCutoffDate || calcNextCutoffDate(values.previousCutoffDate, values.prescriptionDays);
    const cutoff: MedicationClinicCutoff = {
      id: existing?.id || createId(),
      patientId: patient.id,
      medicalInstitutionId: institution.id,
      previousCutoffDate: values.previousCutoffDate,
      prescriptionDays: Number(values.prescriptionDays) || 0,
      nextCutoffDate,
      memo: values.memo,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp
    };
    await db.medicationClinicCutoffs.put(cutoff);
    await reload();
  };

  if (!patient) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <p className="text-slate-600">患者が見つかりません</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{patient.name} 一包化編集</h1>
            <p className="mt-1 text-slate-600">{formatLocationLabel(patient.facilityName, "自宅")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/medication-audit")}
            className="touch-target rounded-md border border-slate-300 px-4 py-2 font-semibold"
          >
            一覧へ戻る
          </button>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
          {[
            { id: "items", label: "一包化内容" },
            { id: "cutoffs", label: "切日" },
            { id: "photos", label: `写真 ${packagePhotos.length}` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePackageTab(tab.id as "items" | "cutoffs" | "photos")}
              className={[
                "touch-target shrink-0 rounded-md px-4 py-2 font-semibold",
                activePackageTab === tab.id ? "bg-care-700 text-white" : "bg-slate-100 text-slate-700"
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activePackageTab === "items" ? (
        <>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
          {medicationEditableTimings.map((timing) => {
            const tabTone = medicationTimingTabClasses[timing];
            return (
              <button
                key={timing}
                type="button"
                onClick={() => setSelectedTiming(timing)}
                className={[
                  "touch-target shrink-0 rounded-md border px-4 py-2 font-semibold",
                  selectedTiming === timing
                    ? tabTone?.active || "border-care-700 bg-care-700 text-white"
                    : tabTone?.inactive || "border-slate-200 bg-slate-100 text-slate-700"
                ].join(" ")}
              >
                {medicationTimingLabels[timing]}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <h2 className={`text-xl font-bold ${medicationLineLabelColors[selectedTiming] || "text-slate-900"}`}>
              {medicationTimingLabels[selectedTiming]}の内容
            </h2>
            {patternItems.length ? (
              patternItems.map((item, index) => (
                <article
                  key={item.id}
                  className={[
                    "rounded-md border bg-white p-4 transition-colors",
                    savedItemId === item.id ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200"
                  ].join(" ")}
                >
                  <div className="mb-3 flex min-h-7 flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-700">薬剤 {index + 1}</p>
                    {savedItemId === item.id ? (
                      <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                        保存しました
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-[140px_120px_1fr_1fr]">
                    <label className="grid gap-1">
                      <span className="font-semibold text-slate-700">剤形</span>
                      <select
                        className="touch-target rounded-md border border-slate-300 bg-white px-3 py-2"
                        value={item.dosageForm}
                        onChange={(event) =>
                          void updatePackageItem(item, { dosageForm: event.target.value as DosageForm })
                        }
                      >
                        {Object.entries(dosageFormLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <DeferredTextInput
                      label="数量"
                      value={item.quantity}
                      onCommit={(value) => void updatePackageItem(item, { quantity: value })}
                    />
                    <DeferredTextInput
                      label="薬剤名"
                      value={item.medicineName}
                      onCommit={(value) => void updatePackageItem(item, { medicineName: value })}
                    />
                    <MedicalInstitutionSelect
                      label="医療機関"
                      value={item.clinicName}
                      institutions={packageInstitutionOptions}
                      onChange={(value) => void updatePackageItem(item, { clinicName: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <PackageFlagCheckboxes
                      label="区分"
                      values={getPackageFlags(item)}
                      onChange={(key, checked) => void updatePackageItem(item, getPackageFlagPatch(item, key, checked))}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                    <DeferredTextInput
                      label="メモ"
                      value={item.memo}
                      onCommit={(value) => void updatePackageItem(item, { memo: value })}
                    />
                    <button
                      type="button"
                      onClick={() => void movePackageItem(item, -1)}
                      disabled={index === 0}
                      className="touch-target self-end rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:text-slate-300"
                    >
                      上へ
                    </button>
                    <button
                      type="button"
                      onClick={() => void movePackageItem(item, 1)}
                      disabled={index === patternItems.length - 1}
                      className="touch-target self-end rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:text-slate-300"
                    >
                      下へ
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePackageItem(item)}
                      className="touch-target self-end rounded-md bg-rose-600 px-4 py-2 font-semibold text-white"
                    >
                      削除
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-md bg-slate-100 p-4 italic text-slate-600">お薬はありません</p>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-md border border-slate-200 p-4">
              <h2 className="text-lg font-bold">追加</h2>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1">
                  <span className="font-semibold text-slate-700">剤形</span>
                  <select
                    className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
                    value={draft.dosageForm}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, dosageForm: event.target.value as DosageForm }))
                    }
                  >
                    {Object.entries(dosageFormLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <TextInput label="数量" value={draft.quantity} onChange={(value) => setDraft((current) => ({ ...current, quantity: value }))} />
                <TextInput label="薬剤名" value={draft.medicineName} onChange={(value) => setDraft((current) => ({ ...current, medicineName: value }))} />
                <MedicalInstitutionSelect
                  label="医療機関"
                  value={draft.clinicName}
                  institutions={packageInstitutionOptions}
                  onChange={(value) => setDraft((current) => ({ ...current, clinicName: value }))}
                />
                <PackageFlagCheckboxes
                  label="区分"
                  values={getPackageFlags(draft)}
                  onChange={(key, checked) =>
                    setDraft((current) => ({ ...current, ...getPackageFlagPatch(current, key, checked) }))
                  }
                />
                <TextInput label="メモ" value={draft.memo} onChange={(value) => setDraft((current) => ({ ...current, memo: value }))} />
                <button
                  type="button"
                  onClick={() => void addPackageItem()}
                  className="touch-target rounded-md bg-care-700 px-5 py-3 font-semibold text-white"
                >
                  追加
                </button>
              </div>
            </section>
            <section className="rounded-md border border-slate-200 p-4">
              <h2 className="text-lg font-bold">カード表示プレビュー</h2>
              <div className="mt-3 space-y-2">
                {medicationCoreTimings.map((timing) => {
                  const targetPattern = data.medicationPackagePatterns.find(
                    (item) => item.patientId === patient.id && item.timing === timing
                  );
                  const targetItems = targetPattern
                    ? sortPackageItemsForPatient(
                        patient,
                        data.medicationPackageItems.filter((item) => item.patternId === targetPattern.id),
                        data.medicalInstitutions
                      )
                    : [];
                  return <MedicationLine key={timing} timing={timing} items={targetItems} />;
                })}
              </div>
            </section>
          </aside>
        </div>
        </>
        ) : activePackageTab === "cutoffs" ? (
          <ClinicCutoffPanel
            institutions={cutoffInstitutions}
            cutoffs={patientCutoffs}
            onSave={saveClinicCutoff}
          />
        ) : (
          <PackagePhotoPanel
            photos={packagePhotos}
            onAddPhotos={addPackagePhotos}
            onUpdatePhoto={updatePackagePhoto}
            onDeletePhoto={deletePackagePhoto}
          />
        )}
      </section>
    </div>
  );
}

function ClinicCutoffPanel({
  institutions,
  cutoffs,
  onSave
}: {
  institutions: MedicalInstitution[];
  cutoffs: MedicationClinicCutoff[];
  onSave: (
    institution: MedicalInstitution,
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string; memo: string }
  ) => Promise<void>;
}) {
  const cutoffSummary = getCutoffSummary(cutoffs);

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-xl font-bold">切日管理</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-700">最短切日</p>
            <p className="mt-2 text-2xl font-bold">
              {cutoffSummary.shortestCutoffDate ? formatDateLabel(cutoffSummary.shortestCutoffDate) : "未設定"}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-700">設置期間</p>
            <p className="mt-2 text-2xl font-bold">{cutoffSummary.installationPeriod || "未設定"}</p>
          </div>
        </div>
      </section>

      {institutions.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {institutions.map((institution) => (
            <ClinicCutoffEditor
              key={institution.id}
              institution={institution}
              cutoff={cutoffs.find((item) => item.medicalInstitutionId === institution.id)}
              onSave={onSave}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-slate-100 p-5 text-slate-600">患者情報に医療機関を登録してください</p>
      )}
    </div>
  );
}

function ClinicCutoffEditor({
  institution,
  cutoff,
  onSave
}: {
  institution: MedicalInstitution;
  cutoff?: MedicationClinicCutoff;
  onSave: (
    institution: MedicalInstitution,
    values: { previousCutoffDate: string; prescriptionDays: number; nextCutoffDate: string; memo: string }
  ) => Promise<void>;
}) {
  const [previousCutoffDate, setPreviousCutoffDate] = useState(cutoff?.previousCutoffDate || "");
  const [prescriptionDays, setPrescriptionDays] = useState(cutoff?.prescriptionDays || 0);
  const [nextCutoffDate, setNextCutoffDate] = useState(cutoff?.nextCutoffDate || "");
  const [memo, setMemo] = useState(cutoff?.memo || "");

  useEffect(() => {
    setPreviousCutoffDate(cutoff?.previousCutoffDate || "");
    setPrescriptionDays(cutoff?.prescriptionDays || 0);
    setNextCutoffDate(cutoff?.nextCutoffDate || "");
    setMemo(cutoff?.memo || "");
  }, [cutoff]);

  const updatePreviousCutoffDate = (value: string) => {
    setPreviousCutoffDate(value);
    const calculated = calcNextCutoffDate(value, Number(prescriptionDays) || 0);
    if (calculated) setNextCutoffDate(calculated);
  };

  const updatePrescriptionDays = (value: string) => {
    const days = Number(value) || 0;
    setPrescriptionDays(days);
    const calculated = calcNextCutoffDate(previousCutoffDate, days);
    if (calculated) setNextCutoffDate(calculated);
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-xl font-bold">{institution.name}</h3>
      <div className="mt-3 grid gap-3">
        <DateInput label="前回切日" value={previousCutoffDate} onChange={updatePreviousCutoffDate} />
        <TextInput
          label="処方日数"
          type="number"
          value={prescriptionDays ? String(prescriptionDays) : ""}
          onChange={updatePrescriptionDays}
        />
        <DateInput label="次回切日" value={nextCutoffDate} onChange={setNextCutoffDate} />
        <label className="grid gap-1">
          <span className="font-semibold text-slate-700">メモ</span>
          <textarea
            className="min-h-20 rounded-md border border-slate-300 px-3 py-3"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void onSave(institution, { previousCutoffDate, prescriptionDays, nextCutoffDate, memo })}
          className="touch-target rounded-md bg-care-700 px-5 py-3 font-semibold text-white"
        >
          切日を保存
        </button>
      </div>
    </section>
  );
}

function PackagePhotoPanel({
  photos,
  onAddPhotos,
  onUpdatePhoto,
  onDeletePhoto
}: {
  photos: MedicationPackagePhoto[];
  onAddPhotos: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onUpdatePhoto: (photo: MedicationPackagePhoto, patch: Partial<MedicationPackagePhoto>) => Promise<void>;
  onDeletePhoto: (photo: MedicationPackagePhoto) => Promise<void>;
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-md border border-care-100 bg-care-50 p-4">
        <h2 className="text-xl font-bold text-care-950">撮影写真</h2>
        <label className="mt-3 inline-flex touch-target cursor-pointer items-center justify-center rounded-md bg-care-700 px-5 py-3 font-semibold text-white">
          写真を撮影・追加
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(event) => void onAddPhotos(event)}
          />
        </label>
      </div>

      {photos.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <img
                src={photo.imageDataUrl}
                alt="一包化確認写真"
                className="max-h-[520px] w-full bg-slate-100 object-contain"
              />
              <div className="grid gap-3 p-4">
                <p className="text-sm font-semibold text-slate-600">
                  追加日時 {formatDateLabel(photo.createdAt.slice(0, 10))}
                </p>
                <label className="grid gap-1">
                  <span className="font-semibold text-slate-700">写真メモ</span>
                  <textarea
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-3"
                    value={photo.memo}
                    onChange={(event) => void onUpdatePhoto(photo, { memo: event.target.value })}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void onDeletePhoto(photo)}
                  className="touch-target rounded-md bg-rose-600 px-4 py-2 font-semibold text-white"
                >
                  写真を削除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-slate-100 p-5 text-slate-600">写真はまだありません</p>
      )}
    </div>
  );
}

function TasksPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const [openOnly, setOpenOnly] = useState(true);
  const tasks = openOnly ? data.tasks.filter((task) => !task.completed) : data.tasks;

  const toggle = async (task: Task) => {
    await db.tasks.update(task.id, { completed: !task.completed, updatedAt: nowString() });
    await reload();
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h1 className="text-2xl font-bold">タスク一覧</h1>
        <Toggle label="未完了のみ" checked={openOnly} onChange={setOpenOnly} />
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.length ? (
          tasks.map((task) => {
            const patient = data.patients.find((item) => item.id === task.patientId);
            return (
              <div
                key={task.id}
                className={["grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto_auto]", task.completed ? "bg-slate-50 text-slate-400" : ""].join(" ")}
              >
                <Link to={`/patients/${task.patientId}`} className="min-h-11">
                  <p className="text-lg font-bold">{task.title}</p>
                  <p>{patient?.name || "患者未設定"} / {formatLocationLabel(patient?.facilityName || "", "自宅")}</p>
                </Link>
                <span className="self-center rounded-md bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                  {taskTypeLabels[task.type]} / {formatDateLabel(task.dueDate)}
                </span>
                <button
                  type="button"
                  onClick={() => void toggle(task)}
                  className="touch-target rounded-md border border-slate-300 px-4 py-2 font-semibold"
                >
                  {task.completed ? "未完了に戻す" : "完了"}
                </button>
              </div>
            );
          })
        ) : (
          <p className="p-5 text-slate-600">タスクはありません</p>
        )}
      </div>
    </section>
  );
}

function BillingPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const [showCash, setShowCash] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const billingPatients = data.patients
    .filter((patient) => {
      const method = patient.billingMethod || "";
      if (!method) return false;
      if (method === "cash" && !showCash) return false;
      if (method === "other" && !showOther) return false;
      return true;
    })
    .sort((a, b) => {
      const facilityDiff = formatLocationLabel(a.facilityName, "個人宅").localeCompare(
        formatLocationLabel(b.facilityName, "個人宅"),
        "ja"
      );
      if (facilityDiff !== 0) return facilityDiff;
      const methodDiff = (a.billingMethod || "").localeCompare(b.billingMethod || "");
      if (methodDiff !== 0) return methodDiff;
      return a.kana.localeCompare(b.kana, "ja");
    });
  const groupedPatients = billingPatients.reduce<Array<{ facilityName: string; patients: Patient[] }>>((groups, patient) => {
    const facilityName = formatLocationLabel(patient.facilityName, "個人宅");
    const group = groups.find((item) => item.facilityName === facilityName);
    if (group) {
      group.patients.push(patient);
    } else {
      groups.push({ facilityName, patients: [patient] });
    }
    return groups;
  }, []);

  const toggleBillingChecked = async (patient: Patient) => {
    await db.patients.update(patient.id, {
      billingChecked: !patient.billingChecked,
      updatedAt: nowString()
    });
    await reload();
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h1 className="text-2xl font-bold">請求チェックリスト</h1>
          <p className="mt-1 text-slate-600">口座引落・振込の患者を一覧表示します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle label="現金も表示" checked={showCash} onChange={setShowCash} />
          <Toggle label="その他も表示" checked={showOther} onChange={setShowOther} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(8rem,1fr)_8rem_minmax(8rem,1fr)_7rem_7rem] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 md:grid-cols-[minmax(12rem,1fr)_12rem_minmax(12rem,1fr)_12rem_10rem] md:gap-3">
        <span>患者名</span>
        <span>請求先</span>
        <span>メモ</span>
        <span>所属先</span>
        <span>支払い方法</span>
      </div>

      <div className="divide-y divide-slate-100">
        {groupedPatients.length ? (
          groupedPatients.map((group) => (
            <section key={group.facilityName}>
              <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                <h2 className="text-lg font-bold">{group.facilityName}</h2>
                <Badge tone="slate">{group.patients.length}名</Badge>
              </div>
              <div>
                {group.patients.map((patient) => (
                  <div
                    key={patient.id}
                    className={[
                      "grid items-center gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(12rem,1fr)_12rem_minmax(12rem,1fr)_12rem_10rem] md:gap-3",
                      patient.billingChecked ? "bg-care-50 text-slate-500" : "bg-white"
                    ].join(" ")}
                  >
                    <div className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-6 w-6 accent-care-700"
                        checked={Boolean(patient.billingChecked)}
                        onChange={() => void toggleBillingChecked(patient)}
                      />
                      <Link
                        to={`/patients/${patient.id}`}
                        className="flex min-h-11 items-center hover:text-care-800"
                      >
                        <span className="text-lg font-bold">{patient.name}</span>
                      </Link>
                    </div>
                    <span className="font-semibold">
                      <span className="mr-2 text-xs font-bold text-slate-500 md:hidden">請求先</span>
                      {patient.billingName || "-"}
                    </span>
                    <span>
                      <span className="mr-2 text-xs font-bold text-slate-500 md:hidden">メモ</span>
                      <span className="font-semibold">{patient.billingMemo || "-"}</span>
                    </span>
                    <span className="font-semibold">
                      <span className="mr-2 text-xs font-bold text-slate-500 md:hidden">所属先</span>
                      {formatLocationLabel(patient.facilityName, "個人宅")}
                    </span>
                    <span className="w-fit rounded-md bg-slate-100 px-3 py-2 font-semibold text-slate-800">
                      <span className="mr-2 text-xs font-bold text-slate-500 md:hidden">支払い方法</span>
                      {patient.billingMethod ? billingMethodLabels[patient.billingMethod] : "未選択"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="p-5 text-slate-600">
            {showCash || showOther
              ? "表示条件に該当する患者はいません"
              : "口座引落・振込の患者はいません"}
          </p>
        )}
      </div>
    </section>
  );
}

function SettingsPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const [backupMessage, setBackupMessage] = useState("");

  const exportData = () => {
    const payload = {
      appName: "在宅サポートノート",
      exportedAt: nowString(),
      version: 1,
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homecare-backup-${todayString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupMessage("エクスポートしました");
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const ok = window.confirm("現在の端末内データを、選択したバックアップで置き換えます。実行しますか？");
    if (!ok) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<{ data: Partial<AppData> }> & Partial<AppData>;
      const backupData = normalizeBackupData(parsed);
      await replaceAllAppData(backupData);
      await reload();
      setBackupMessage("インポートしました");
    } catch (error) {
      console.error(error);
      setBackupMessage("インポートに失敗しました。JSONファイルを確認してください");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-bold">設定</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MetricCard icon={UsersRound} label="患者" value={data.patients.length} tone="care" />
          <MetricCard icon={CalendarDays} label="予定" value={data.visits.length} tone="blue" />
          <MetricCard icon={ClipboardCheck} label="タスク" value={data.tasks.length} tone="amber" />
          <MetricCard icon={CheckCircle2} label="チェック" value={data.checklists.length} tone="slate" />
        </div>
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">オフライン保存</h2>
        <p className="mt-2 text-slate-700">
          患者情報、訪問予定、配達予定、タスク、チェックシート、メモは端末内の IndexedDB
          に保存されます。初回読み込み後は Service Worker がアプリ本体をキャッシュします。
        </p>
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">データのインポート / エクスポート</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportData}
            className="touch-target rounded-md bg-care-700 px-5 py-3 font-semibold text-white"
          >
            データをエクスポート
          </button>
          <label className="touch-target inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-5 py-3 font-semibold">
            データをインポート
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importData(event)} />
          </label>
        </div>
        {backupMessage ? <p className="mt-3 font-semibold text-care-900">{backupMessage}</p> : null}
      </section>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DeferredTextInput({
  label,
  value,
  onCommit,
  type = "text"
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  type?: string;
}) {
  const [draft, setDraft] = useState(value);
  const isDirty = draft !== value;
  const inputId = useId();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };

  return (
    <div className="grid gap-1">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <label htmlFor={inputId} className="font-semibold text-slate-700">
          {label}
        </label>
        {isDirty ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-700">変更あり</span>
            <button
              type="button"
              onClick={commit}
              className="rounded-md bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
            >
              保存
            </button>
          </div>
        ) : null}
      </div>
      <input
        id={inputId}
        type={type}
        className={[
          "touch-target rounded-md border bg-white px-3 py-3",
          isDirty ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-300"
        ].join(" ")}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <TextInput label={label} type="date" value={value} onChange={onChange} />;
}

function MedicalInstitutionSelect({
  label,
  value,
  institutions,
  onChange
}: {
  label: string;
  value: string;
  institutions: MedicalInstitution[];
  onChange: (value: string) => void;
}) {
  const hasCurrentValue = Boolean(value) && !institutions.some((institution) => institution.name === value);
  return (
    <label className="grid gap-1">
      <span className="font-semibold text-slate-700">{label}</span>
      <select
        className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">未選択</option>
        {hasCurrentValue ? <option value={value}>{value}</option> : null}
        {institutions.map((institution) => (
          <option key={institution.id} value={institution.name}>
            {institution.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PackageFlagCheckboxes({
  label,
  values,
  onChange
}: {
  label: string;
  values: Record<PackageFlagKey, boolean>;
  onChange: (key: PackageFlagKey, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold text-slate-700">{label}</span>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(packageFlagLabels) as PackageFlagKey[]).map((key) => (
          <Toggle
            key={key}
            label={packageFlagLabels[key]}
            checked={values[key]}
            onChange={(checked) => onChange(key, checked)}
          />
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="touch-target flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
      <input
        type="checkbox"
        className="h-6 w-6 accent-care-700"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "rose" | "amber" | "slate" | "care" }) {
  const className = {
    rose: "bg-rose-100 text-rose-800",
    amber: "bg-amber-100 text-amber-900",
    slate: "bg-slate-100 text-slate-700",
    care: "bg-care-100 text-care-900"
  }[tone];
  return <span className={`rounded-md px-2 py-1 text-sm font-bold ${className}`}>{children}</span>;
}

function getMedicationCompletionRate(days: MedicationCalendarDay[]) {
  if (!days.length) return 0;
  const checkedCount = days.filter((day) => day.checked).length;
  return Math.round((checkedCount / days.length) * 100);
}

function getMedicationDayWarnings(day: MedicationCalendarDay) {
  const warnings = getMedicationDayDataWarnings(day);
  if (!day.checked) {
    warnings.push("鑑査未完了です");
  }
  return warnings;
}

function getMedicationDayDataWarnings(day: MedicationCalendarDay) {
  const warnings: string[] = [];
  const coreValues = medicationCoreTimings.map((timing) => String(day[timing]).trim());
  const filledCount = coreValues.filter(Boolean).length;

  if (filledCount === 0) {
    warnings.push("朝・昼・夕・寝る前がすべて空欄です");
  } else if (filledCount > 0 && filledCount < medicationCoreTimings.length) {
    warnings.push("朝昼夕寝る前の一部だけ未入力です");
  }

  medicationCoreTimings.forEach((timing) => {
    if (hasDuplicateLines(String(day[timing]))) {
      warnings.push(`${medicationTimingLabels[timing]}に重複入力があります`);
    }
  });

  const memoText = `${day.memo} ${day.issueMemo}`;
  if (/(中止|変更|残薬|臨時)/.test(memoText) && !day.checked) {
    warnings.push("メモに中止・変更・残薬・臨時が含まれています");
  }

  return warnings;
}

function hasDuplicateLines(value: string) {
  const lines = value
    .split(/\n|、|,/)
    .map((line) => line.trim())
    .filter(Boolean);
  return new Set(lines).size !== lines.length;
}

function getMedicationDayTone(day: MedicationCalendarDay) {
  if (day.hasIssue || day.issueMemo) return "bg-rose-50 text-rose-950";
  if (day.checked) return "bg-care-50 text-care-950";
  return "bg-amber-50 text-amber-950";
}

function deriveMedicationStatus(days: MedicationCalendarDay[]): MedicationCalendarStatus {
  if (!days.length || days.every((day) => !day.checked && !day.hasIssue)) {
    return "notStarted";
  }
  if (days.some((day) => day.hasIssue || day.issueMemo || getMedicationDayDataWarnings(day).length > 0)) {
    return "needsReview";
  }
  if (days.every((day) => day.checked)) {
    return "completed";
  }
  return "inProgress";
}

function sortPatientsByOrder(patients: Patient[]) {
  return [...patients].sort((a, b) => {
    const orderDiff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
    if (orderDiff !== 0) return orderDiff;
    return a.kana.localeCompare(b.kana, "ja");
  });
}

function getFacilityCalendarSlots(patients: Patient[]) {
  const slots: Array<{ slotNumber: number; patient?: Patient }> = Array.from({ length: 20 }, (_, index) => ({
    slotNumber: index + 1
  }));

  patients.forEach((patient) => {
    const slot = patient.facilityCalendarSlot;
    if (!slot || slot < 1 || slot > 20) return;
    if (!slots[slot - 1].patient) {
      slots[slot - 1].patient = patient;
    }
  });
  return slots;
}

function isValidFacilityCalendarSlot(slot?: number) {
  return Boolean(slot && slot >= 1 && slot <= 20);
}

function normalizeFacilityCalendarName(facilityName: string) {
  const trimmed = facilityName.trim();
  const canonicalName = Object.entries(facilityCalendarNameAliases).find(([, names]) =>
    names.includes(trimmed)
  )?.[0];
  return canonicalName || trimmed;
}

function formatLocationLabel(facilityName: string, fallback = "個人宅") {
  const trimmed = facilityName.trim();
  return trimmed ? normalizeFacilityCalendarName(trimmed) : fallback;
}

function isFacilityCalendarFacility(facilityName: string) {
  return Boolean(facilityCalendarNameAliases[normalizeFacilityCalendarName(facilityName)]);
}

function patientMatchesFacilityCalendar(patient: Patient, facilityName: string) {
  const names = facilityCalendarNameAliases[normalizeFacilityCalendarName(facilityName)] || [facilityName];
  return names.includes(patient.facilityName);
}

function getNextAvailableFacilityCalendarSlot(patients: Patient[], currentPatientId = "", facilityName = "レオ") {
  const occupiedSlots = new Set(
    patients
      .filter((patient) => patient.id !== currentPatientId && patientMatchesFacilityCalendar(patient, facilityName))
      .map((patient) => patient.facilityCalendarSlot)
      .filter(isValidFacilityCalendarSlot)
  );

  for (let slot = 1; slot <= 20; slot += 1) {
    if (!occupiedSlots.has(slot)) return slot;
  }
  return undefined;
}

function getLatestMedicationCalendar(patientId: string, calendars: MedicationCalendar[]) {
  return calendars
    .filter((calendar) => calendar.patientId === patientId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

function getPatternItems(
  patterns: MedicationPackagePattern[],
  items: MedicationPackageItem[],
  patient?: Patient,
  institutions: MedicalInstitution[] = []
) {
  return patterns.reduce<Record<MedicationTiming, MedicationPackageItem[]>>((acc, pattern) => {
    acc[pattern.timing] = sortPackageItemsForPatient(
      patient,
      items.filter((item) => item.patternId === pattern.id),
      institutions
    );
    return acc;
  }, {} as Record<MedicationTiming, MedicationPackageItem[]>);
}

function formatPackageItems(items: MedicationPackageItem[]) {
  if (!items.length) return "お薬はありません";
  return items.map(formatPackageItem).join("→");
}

function formatPackageItem(item: MedicationPackageItem) {
  const medicineName = item.medicineName.trim();
  const quantityText = item.quantity || "0";
  const base = medicineName
    ? item.dosageForm === "powder" || item.dosageForm === "kampo" || item.dosageForm === "patch" || item.dosageForm === "other"
      ? medicineName
      : `${medicineName}（${quantityText}）`
    : item.dosageForm === "tablet"
      ? `錠（${quantityText}）`
      : item.dosageForm === "powder"
        ? item.quantity
          ? `粉（${quantityText}）`
          : "粉"
        : item.dosageForm === "magnesium"
          ? `カマグ（${quantityText}）`
          : item.dosageForm === "aspark"
            ? `アスK（${quantityText}）`
          : item.dosageForm === "kampo"
            ? "漢方"
            : item.dosageForm === "patch"
              ? "貼付"
              : "その他";
  const flags = getPackageFlags(item);
  const changeLabel = (Object.keys(packageFlagLabels) as PackageFlagKey[])
    .filter((key) => flags[key])
    .map((key) => `【${packageFlagLabels[key]}】`)
    .join("");
  return `${base}${changeLabel}`;
}

function getPackageFlags(item: Pick<
  MedicationPackageItem,
  "packageChangeType" | "isAdded" | "isChanged" | "isTemporary" | "isStopped"
>): Record<PackageFlagKey, boolean> {
  return {
    isAdded: Boolean(item.isAdded || item.packageChangeType === "added"),
    isChanged: Boolean(
      item.isChanged ||
        item.packageChangeType === "increased" ||
        item.packageChangeType === "decreased" ||
        item.isStopped
    ),
    isTemporary: Boolean(item.isTemporary || item.packageChangeType === "temporary")
  };
}

function getPackageFlagPatch(
  item: Pick<MedicationPackageItem, "packageChangeType" | "isAdded" | "isChanged" | "isTemporary" | "isStopped">,
  key: PackageFlagKey,
  checked: boolean
): Pick<MedicationPackageItem, "packageChangeType" | "isAdded" | "isChanged" | "isTemporary" | "isStopped" | "isSelfAdjustment"> {
  const flags = { ...getPackageFlags(item), [key]: checked };
  return {
    packageChangeType: "none",
    isAdded: flags.isAdded,
    isChanged: flags.isChanged,
    isTemporary: flags.isTemporary,
    isStopped: false,
    isSelfAdjustment: false
  };
}

function getPackageCount(
  patterns: MedicationPackagePattern[],
  items: MedicationPackageItem[],
  patient?: Patient,
  institutions: MedicalInstitution[] = []
) {
  const packageItems = getPatternItems(patterns, items, patient, institutions);
  return medicationCoreTimings.reduce((count, timing) => count + (packageItems[timing]?.length || 0), 0);
}

function hasTemporaryItem(items: Record<MedicationTiming, MedicationPackageItem[]>) {
  return Object.values(items).some((timingItems) =>
    timingItems.some((item) => getPackageFlags(item).isTemporary)
  );
}

async function normalizePackageOrder(items: MedicationPackageItem[]) {
  await Promise.all(
    items.map((item, order) => db.medicationPackageItems.update(item.id, { order, updatedAt: nowString() }))
  );
}

function sortPackageItemsForPatient(
  patient: Patient | undefined,
  items: MedicationPackageItem[],
  institutions: MedicalInstitution[]
) {
  void patient;
  void institutions;
  return [...items].sort((a, b) => a.order - b.order);
}

function sortPackageItemsByBasicRule(
  patient: Patient | undefined,
  items: MedicationPackageItem[],
  institutions: MedicalInstitution[]
) {
  return [...items].sort((a, b) => {
    const institutionRankDiff =
      getPackageInstitutionRank(patient, a.clinicName, institutions) -
      getPackageInstitutionRank(patient, b.clinicName, institutions);
    if (institutionRankDiff !== 0) return institutionRankDiff;
    const dosageRankDiff = getDosageFormRank(a.dosageForm) - getDosageFormRank(b.dosageForm);
    if (dosageRankDiff !== 0) return dosageRankDiff;
    return a.order - b.order;
  });
}

function getPackageInstitutionRank(
  patient: Patient | undefined,
  clinicName: string,
  institutions: MedicalInstitution[]
) {
  const institution = institutions.find((item) => item.name === clinicName);
  if (!patient || !institution) return 999;
  if (patient.mainMedicalInstitutionId === institution.id) return 0;
  const additionalIndex = (patient.additionalMedicalInstitutionIds || []).indexOf(institution.id);
  if (additionalIndex >= 0) return additionalIndex + 1;
  return 500;
}

function getDosageFormRank(dosageForm: DosageForm) {
  const ranks: Record<DosageForm, number> = {
    tablet: 0,
    powder: 1,
    magnesium: 2,
    aspark: 3,
    patch: 4,
    kampo: 5,
    other: 6
  };
  return ranks[dosageForm];
}

function getPatientMedicalInstitutions(patient: Patient, institutions: MedicalInstitution[]) {
  const ids = [
    patient.mainMedicalInstitutionId,
    ...(patient.additionalMedicalInstitutionIds || [])
  ].filter((id): id is string => Boolean(id));
  return ids
    .map((id) => institutions.find((institution) => institution.id === id))
    .filter((institution): institution is MedicalInstitution => Boolean(institution));
}

function getFacilityClinicCardTone(patient: Patient, institutions: MedicalInstitution[]) {
  const linkedInstitutions = getPatientMedicalInstitutions(patient, institutions);
  const hasTadaoka = linkedInstitutions.some((institution) => institution.name.includes("ただおかメディカル"));
  const hasNakayama = linkedInstitutions.some((institution) => institution.name.includes("なかやまメンタル"));

  if (hasTadaoka && hasNakayama) return "border-violet-300 bg-violet-100";
  if (hasTadaoka) return "border-red-300 bg-red-50";
  if (hasNakayama) return "border-sky-300 bg-sky-50";
  return "border-emerald-200 bg-emerald-50";
}

function getMedicalInstitutionPatientCount(institutionId: string, patients: Patient[]) {
  return patients.filter(
    (patient) =>
      patient.mainMedicalInstitutionId === institutionId ||
      (patient.additionalMedicalInstitutionIds || []).includes(institutionId)
  ).length;
}

function calcNextCutoffDate(previousCutoffDate: string, prescriptionDays: number) {
  if (!previousCutoffDate || !prescriptionDays) return "";
  return format(addDays(parseISO(previousCutoffDate), prescriptionDays), "yyyy-MM-dd");
}

function getCutoffSummary(cutoffs: MedicationClinicCutoff[]) {
  const nextDates = cutoffs
    .map((cutoff) => cutoff.nextCutoffDate)
    .filter(Boolean)
    .sort();
  const shortestCutoffDate = nextDates[0] || "";
  const installationStartDate = calcNextWeekdayDate(todayString(), 4);
  const installationPeriod = shortestCutoffDate
    ? `${formatDateLabel(installationStartDate)}〜${formatDateLabel(shortestCutoffDate)}`
    : "";
  return { shortestCutoffDate, installationStartDate, installationPeriod };
}

function getMedicalInstitutionCutoffSummary({
  institution,
  patients,
  cutoffs,
  packagePatterns,
  packageItems
}: {
  institution: MedicalInstitution;
  patients: Patient[];
  cutoffs: MedicationClinicCutoff[];
  packagePatterns: MedicationPackagePattern[];
  packageItems: MedicationPackageItem[];
}): MedicalInstitutionCutoffSummary {
  const showUnlinkedFacilityPatients =
    institution.name.includes("ただおかメディカル") || institution.name.includes("なかやまメンタル");
  const rows = patients
    .map((patient) => {
      const patientCutoff = cutoffs.find(
        (cutoff) => cutoff.patientId === patient.id && cutoff.medicalInstitutionId === institution.id
      );
      const relation = getPatientInstitutionRelation(patient, institution, patientCutoff, packagePatterns, packageItems);
      if (!relation && !(showUnlinkedFacilityPatients && patientMatchesFacilityCalendar(patient, "レオ"))) {
        return undefined;
      }
      return {
        patient,
        institution,
        previousCutoffDate: patientCutoff?.previousCutoffDate || "",
        prescriptionDays: patientCutoff?.prescriptionDays || 0,
        cutoffDate: patientCutoff?.nextCutoffDate || "",
        nextVisitDate: patient.mainMedicalInstitutionId === institution.id ? patient.nextVisitDate || "" : "",
        relation: relation || "未設定"
      };
    })
    .filter((row): row is MedicalInstitutionCutoffSummary["rows"][number] => Boolean(row))
    .sort((a, b) => {
      const dateDiff = (a.cutoffDate || "9999-12-31").localeCompare(b.cutoffDate || "9999-12-31");
      if (dateDiff !== 0) return dateDiff;
      return a.patient.kana.localeCompare(b.patient.kana, "ja");
    });
  const cutoffDates = rows.map((row) => row.cutoffDate).filter(Boolean).sort();
  const nextVisitDates = rows.map((row) => row.nextVisitDate).filter(Boolean).sort();

  return {
    key: institution.id,
    label: institution.name,
    weekdayLabel: institution.homeVisitWeekday ? homeVisitWeekdayLabels[institution.homeVisitWeekday] : "",
    institution,
    patientCount: rows.length,
    shortestCutoffDate: cutoffDates[0] || "",
    earliestNextVisitDate: nextVisitDates[0] || "",
    rows
  };
}

function getPatientInstitutionRelation(
  patient: Patient,
  institution: MedicalInstitution,
  cutoff: MedicationClinicCutoff | undefined,
  packagePatterns: MedicationPackagePattern[],
  packageItems: MedicationPackageItem[]
): "居宅" | "外来" | "一包化" | "" {
  if (patient.mainMedicalInstitutionId === institution.id) return "居宅";
  if ((patient.additionalMedicalInstitutionIds || []).includes(institution.id)) return "外来";
  if (cutoff) return "外来";
  const patternIds = packagePatterns
    .filter((pattern) => pattern.patientId === patient.id)
    .map((pattern) => pattern.id);
  if (!patternIds.length) return "";
  return packageItems.some((item) => patternIds.includes(item.patternId) && item.clinicName === institution.name)
    ? "一包化"
    : "";
}

function calcNextWeekdayDate(fromDate: string, targetWeekday: number) {
  let candidate = parseISO(fromDate);
  for (let offset = 0; offset < 7; offset += 1) {
    if (candidate.getDay() === targetWeekday) {
      return format(candidate, "yyyy-MM-dd");
    }
    candidate = addDays(candidate, 1);
  }
  return fromDate;
}

function getFacilityInstallationPeriodLabel(facilityName: string) {
  if (normalizeFacilityCalendarName(facilityName) === "レオ") {
    const startDate = calcNextWeekdayDate(todayString(), 4);
    const endDate = format(addDays(parseISO(startDate), 6), "yyyy-MM-dd");
    return `設置期間：${formatDateLabel(startDate)}〜${formatDateLabel(endDate)}（木曜始まり・水曜終わり / 1週間分）`;
  }

  const startDate = calcNextWeekdayDate(todayString(), 5);
  const endDate = format(addDays(parseISO(startDate), 13), "yyyy-MM-dd");
  return `設置期間：${formatDateLabel(startDate)}〜${formatDateLabel(endDate)}（金曜始まり・木曜終わり / 2週間分）`;
}

function getRegisteredLocationOptions(patients: Patient[]) {
  const options = new Set<string>(["個人宅", "レオ", "キレイ"]);

  patients.forEach((patient) => {
    const facilityName = normalizeFacilityCalendarName(patient.facilityName.trim());
    if (facilityName) {
      options.add(facilityName);
    }
  });

  return [...options].sort((a, b) => {
    if (a === "個人宅") return -1;
    if (b === "個人宅") return 1;
    return a.localeCompare(b, "ja");
  });
}

function calcNextHomeVisitDate(lastVisitDate: string, prescriptionDays: number, weekday: HomeVisitWeekday | "") {
  if (!lastVisitDate || !prescriptionDays || !weekday) return "";
  const targetWeekday = getWeekdayNumber(weekday);
  let candidate = addDays(parseISO(lastVisitDate), prescriptionDays);
  for (let offset = 0; offset < 7; offset += 1) {
    if (candidate.getDay() === targetWeekday) {
      return format(candidate, "yyyy-MM-dd");
    }
    candidate = addDays(candidate, 1);
  }
  return "";
}

function getWeekdayNumber(weekday: HomeVisitWeekday) {
  const weekdayNumbers: Record<HomeVisitWeekday, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  return weekdayNumbers[weekday];
}

function normalizeBackupData(parsed: Partial<{ data: Partial<AppData> }> & Partial<AppData>): AppData {
  const source = parsed.data || parsed;
  if (!Array.isArray(source.patients)) {
    throw new Error("Invalid backup: patients is missing");
  }

  return {
    patients: normalizeBackupArray(source.patients, "patients"),
    visits: normalizeBackupArray(source.visits, "visits"),
    tasks: normalizeBackupArray(source.tasks, "tasks"),
    checklists: normalizeBackupArray(source.checklists, "checklists"),
    medicationCalendars: normalizeBackupArray(source.medicationCalendars, "medicationCalendars"),
    medicationCalendarDays: normalizeBackupArray(source.medicationCalendarDays, "medicationCalendarDays"),
    medicationCalendarAudits: normalizeBackupArray(source.medicationCalendarAudits, "medicationCalendarAudits"),
    medicationPackagePatterns: normalizeBackupArray(source.medicationPackagePatterns, "medicationPackagePatterns"),
    medicationPackageItems: normalizeBackupArray(source.medicationPackageItems, "medicationPackageItems"),
    medicationPackagePhotos: normalizeBackupArray(source.medicationPackagePhotos, "medicationPackagePhotos"),
    medicationClinicCutoffs: normalizeBackupArray(source.medicationClinicCutoffs, "medicationClinicCutoffs"),
    medicalInstitutions: normalizeBackupArray(
      source.medicalInstitutions,
      "medicalInstitutions",
      initialMedicalInstitutions as MedicalInstitution[]
    )
  };
}

function normalizeBackupArray<T>(value: T[] | undefined, key: string, fallback: T[] = []) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) {
    throw new Error(`Invalid backup: ${key} is not an array`);
  }
  return value;
}

async function replaceAllAppData(data: AppData) {
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
      db.medicationPackageItems,
      db.medicationPackagePhotos,
      db.medicationClinicCutoffs,
      db.medicalInstitutions
    ],
    async () => {
      await Promise.all([
        db.patients.clear(),
        db.visits.clear(),
        db.tasks.clear(),
        db.checklists.clear(),
        db.medicationCalendars.clear(),
        db.medicationCalendarDays.clear(),
        db.medicationCalendarAudits.clear(),
        db.medicationPackagePatterns.clear(),
        db.medicationPackageItems.clear(),
        db.medicationPackagePhotos.clear(),
        db.medicationClinicCutoffs.clear(),
        db.medicalInstitutions.clear()
      ]);
      await Promise.all([
        data.patients.length ? db.patients.bulkPut(data.patients) : Promise.resolve(),
        data.visits.length ? db.visits.bulkPut(data.visits) : Promise.resolve(),
        data.tasks.length ? db.tasks.bulkPut(data.tasks) : Promise.resolve(),
        data.checklists.length ? db.checklists.bulkPut(data.checklists) : Promise.resolve(),
        data.medicationCalendars.length ? db.medicationCalendars.bulkPut(data.medicationCalendars) : Promise.resolve(),
        data.medicationCalendarDays.length ? db.medicationCalendarDays.bulkPut(data.medicationCalendarDays) : Promise.resolve(),
        data.medicationCalendarAudits.length ? db.medicationCalendarAudits.bulkPut(data.medicationCalendarAudits) : Promise.resolve(),
        data.medicationPackagePatterns.length ? db.medicationPackagePatterns.bulkPut(data.medicationPackagePatterns) : Promise.resolve(),
        data.medicationPackageItems.length ? db.medicationPackageItems.bulkPut(data.medicationPackageItems) : Promise.resolve(),
        data.medicationPackagePhotos.length ? db.medicationPackagePhotos.bulkPut(data.medicationPackagePhotos) : Promise.resolve(),
        data.medicationClinicCutoffs.length ? db.medicationClinicCutoffs.bulkPut(data.medicationClinicCutoffs) : Promise.resolve(),
        data.medicalInstitutions.length ? db.medicalInstitutions.bulkPut(data.medicalInstitutions) : Promise.resolve()
      ]);
    }
  );
}

async function deletePatientCascade(patientId: string) {
  const calendars = await db.medicationCalendars.where("patientId").equals(patientId).toArray();
  const calendarIds = calendars.map((calendar) => calendar.id);
  const calendarDays = calendarIds.length
    ? await db.medicationCalendarDays.where("calendarId").anyOf(calendarIds).toArray()
    : [];
  const calendarDayIds = calendarDays.map((day) => day.id);
  const packagePatterns = await db.medicationPackagePatterns.where("patientId").equals(patientId).toArray();
  const packagePatternIds = packagePatterns.map((pattern) => pattern.id);

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
      db.medicationPackageItems,
      db.medicationPackagePhotos,
      db.medicationClinicCutoffs
    ],
    async () => {
      await Promise.all([
        db.patients.delete(patientId),
        db.visits.where("patientId").equals(patientId).delete(),
        db.tasks.where("patientId").equals(patientId).delete(),
        db.checklists.where("patientId").equals(patientId).delete(),
        db.medicationCalendars.where("patientId").equals(patientId).delete(),
        calendarIds.length
          ? db.medicationCalendarDays.where("calendarId").anyOf(calendarIds).delete()
          : Promise.resolve(0),
        calendarDayIds.length
          ? db.medicationCalendarAudits.where("calendarDayId").anyOf(calendarDayIds).delete()
          : Promise.resolve(0),
        db.medicationPackagePatterns.where("patientId").equals(patientId).delete(),
        packagePatternIds.length
          ? db.medicationPackageItems.where("patternId").anyOf(packagePatternIds).delete()
          : Promise.resolve(0),
        db.medicationPackagePhotos.where("patientId").equals(patientId).delete(),
        db.medicationClinicCutoffs.where("patientId").equals(patientId).delete()
      ]);
    }
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function toPatientForm(patient: Patient): PatientFormValues {
  const { id, order, createdAt, updatedAt, ...form } = patient;
  return {
    ...form,
    facilityName: formatLocationLabel(patient.facilityName, patient.locationType === "home" ? "個人宅" : ""),
    mainMedicalInstitutionId: patient.mainMedicalInstitutionId || "",
    additionalMedicalInstitutionIds: patient.additionalMedicalInstitutionIds || [],
    lastVisitDate: patient.lastVisitDate || "",
    prescriptionDays: patient.prescriptionDays || 0,
    nextVisitDate: patient.nextVisitDate || "",
    isNextVisitDateManual: Boolean(patient.isNextVisitDateManual),
    billingMethod: patient.billingMethod || "",
    billingName: patient.billingName || "",
    billingMemo: patient.billingMemo || "",
    billingChecked: Boolean(patient.billingChecked)
  };
}

function createPatientForm(facilityName = ""): PatientFormValues {
  const locationLabel = formatLocationLabel(facilityName, "個人宅");
  return {
    ...emptyPatientForm,
    locationType: locationLabel === "個人宅" ? "home" : "facility",
    facilityName: locationLabel
  };
}

function setVisitValue<K extends keyof Visit>(
  setVisit: React.Dispatch<React.SetStateAction<Visit>>,
  key: K,
  value: Visit[K]
) {
  setVisit((current) => ({ ...current, [key]: value }));
}

export default App;
