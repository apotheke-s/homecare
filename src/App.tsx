import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
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
  useNavigate,
  useParams
} from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
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
import type {
  Checklist,
  MedicationCalendar,
  MedicationCalendarAudit,
  MedicationCalendarDay,
  MedicationCalendarStatus,
  MedicationTiming,
  DosageForm,
  MedicationPackageItem,
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
};

type PatientDetailTab = "basic" | "schedule" | "tasks" | "checklist" | "medication";

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
  magnesium: "Mg",
  patch: "貼付",
  kampo: "漢方",
  other: "その他"
};

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

const emptyPatientForm: PatientFormValues = {
  name: "",
  kana: "",
  birthday: "",
  locationType: "home",
  facilityName: "",
  address: "",
  phone: "",
  doctorName: "",
  nurseContact: "",
  familyContact: "",
  hasOneDosePackage: false,
  hasCrushing: false,
  hasNarcotics: false,
  hasColdStorageMedicine: false,
  memo: ""
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
    medicationPackageItems: []
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

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
      medicationPackageItems
    ] = await Promise.all([
      db.patients.toArray(),
      db.visits.toArray(),
      db.tasks.orderBy("dueDate").toArray(),
      db.checklists.toArray(),
      db.medicationCalendars.toArray(),
      db.medicationCalendarDays.toArray(),
      db.medicationCalendarAudits.toArray(),
      db.medicationPackagePatterns.toArray(),
      db.medicationPackageItems.toArray()
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
      medicationPackageItems
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

  const dismissNotice = () => setNotice("");

  return (
    <BrowserRouter basename={routerBaseName}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
            <Link to="/" className="flex min-h-11 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-care-700 text-white">
                <Home size={24} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xl font-bold leading-tight">在宅サポートノート</p>
                <p className="text-sm text-slate-600">オフライン在宅PWA</p>
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
            <nav className="hidden gap-2 md:flex" aria-label="主要メニュー">
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
                onClick={() => window.location.reload()}
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
                path="/medication-audit"
                element={<MedicationAuditPage data={data} reload={reload} />}
              />
              <Route path="/facility-r-calendar" element={<FacilityRCalendarPage data={data} reload={reload} />} />
              <Route path="/settings" element={<SettingsPage data={data} />} />
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
    { to: "/patients", label: "患者一覧", icon: UsersRound },
    { to: "/tasks", label: "タスク", icon: ClipboardCheck },
    { to: "/medication-audit", label: "服薬カレンダー鑑査", icon: Pill },
    { to: "/facility-r-calendar", label: "老人ホームRカレンダー", icon: Package },
    { to: "/settings", label: "設定", icon: Settings }
  ];

  return items.map(({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "touch-target inline-flex items-center gap-2 rounded-md px-4 py-2 text-base font-semibold",
          isActive ? "bg-care-700 text-white" : "text-slate-700 hover:bg-slate-100"
        ].join(" ")
      }
      end={to === "/"}
    >
      <Icon size={20} />
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
                    <span className="text-slate-600">{patient.facilityName || "自宅"}</span>
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
                <p className="mt-1 text-slate-600">{patient.facilityName || patient.address || "自宅"}</p>
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
    const currentTargetCount =
      facilityName === "老人ホームR"
        ? data.patients.filter((patient) => patient.facilityName === "老人ホームR").length
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
            facilityName: facilityName === "老人ホームR" ? "老人ホームR" : `確認施設${((number - 1) % 5) + 1}`,
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
                onClick={() => void seedMockPatients("老人ホームR")}
                className="touch-target rounded-md bg-care-700 px-4 py-2 font-semibold text-white"
              >
                老人ホームR患者を追加
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

function FacilityRCalendarPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const facilityPatients = useMemo(
    () => sortPatientsByOrder(data.patients.filter((patient) => patient.facilityName === "老人ホームR")),
    [data.patients]
  );
  const [reorderMode, setReorderMode] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");
  const [orderedIds, setOrderedIds] = useState(facilityPatients.map((patient) => patient.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  useEffect(() => {
    setOrderedIds(facilityPatients.map((patient) => patient.id));
  }, [facilityPatients]);

  const orderedPatients = orderedIds
    .map((id) => facilityPatients.find((patient) => patient.id === id))
    .filter((patient): patient is Patient => Boolean(patient))
    .slice(0, 20);
  const slots = Array.from({ length: 20 }, (_, index) => ({
    slotNumber: index + 1,
    patient: orderedPatients[index]
  }));

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

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Package size={26} />
              老人ホームRカレンダー
            </h1>
            <p className="mt-1 text-slate-600">
              施設名が老人ホームRの患者だけを、服薬カレンダー鑑査と同じカードで20マスへ固定表示します。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {import.meta.env.DEV ? (
              <button
                type="button"
                onClick={() =>
                  void seedMedicationMockPatients({
                    data,
                    reload,
                    setSeedMessage,
                    facilityName: "老人ホームR"
                  })
                }
                className="touch-target rounded-md bg-care-700 px-4 py-2 font-semibold text-white"
              >
                老人ホームR患者を追加
              </button>
            ) : null}
            <Badge tone="slate">対象 {facilityPatients.length} / 20</Badge>
            <Toggle label="並び替えモードON" checked={reorderMode} onChange={setReorderMode} />
          </div>
        </div>
        {seedMessage ? <p className="mt-3 font-semibold text-care-900">{seedMessage}</p> : null}
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {slots.map(({ slotNumber, patient }) =>
              patient ? (
                <SortableMedicationPatientCard
                  key={patient.id}
                  patient={patient}
                  data={data}
                  reorderMode={reorderMode}
                  slotNumber={slotNumber}
                />
              ) : (
                <article
                  key={`empty-${slotNumber}`}
                  className="min-h-64 rounded-md border border-dashed border-slate-300 bg-white p-4 text-slate-500"
                >
                  <p className="text-lg font-bold">{slotNumber}</p>
                  <p className="mt-20 text-center font-semibold">空き</p>
                </article>
              )
            )}
          </section>
        </SortableContext>
      </DndContext>
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
  const currentTargetCount =
    facilityName === "老人ホームR"
      ? data.patients.filter((patient) => patient.facilityName === "老人ホームR").length
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
          facilityName: facilityName === "老人ホームR" ? "老人ホームR" : `確認施設${((number - 1) % 5) + 1}`,
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
  dragHandleProps
}: {
  patient: Patient;
  data: AppData;
  reorderMode: boolean;
  slotNumber?: number;
  dragHandleProps: Record<string, unknown>;
}) {
  const calendar = getLatestMedicationCalendar(patient.id, data.medicationCalendars);
  const days = calendar ? data.medicationCalendarDays.filter((day) => day.calendarId === calendar.id) : [];
  const patterns = data.medicationPackagePatterns.filter((pattern) => pattern.patientId === patient.id);
  const items = getPatternItems(patterns, data.medicationPackageItems);
  const issueCount = days.filter((day) => day.hasIssue || day.issueMemo || getMedicationDayDataWarnings(day).length).length;
  const packageCount = getPackageCount(patterns, data.medicationPackageItems);
  const status = calendar?.status || "notStarted";
  const cardTone = {
    notStarted: "border-slate-200 bg-white",
    inProgress: "border-amber-200 bg-amber-50",
    needsReview: "border-rose-200 bg-rose-50",
    completed: "border-care-100 bg-care-50"
  }[status];

  const content = (
    <article className={`h-full rounded-md border p-4 ${cardTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {slotNumber ? <p className="text-sm font-bold text-slate-500">{slotNumber}</p> : null}
          <h2 className="text-xl font-bold">{patient.name}</h2>
          <p className="text-slate-600">{patient.facilityName || "自宅"}</p>
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

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={status === "completed" ? "care" : status === "needsReview" ? "rose" : status === "inProgress" ? "amber" : "slate"}>
          {medicationStatusLabels[status]}
        </Badge>
        <Badge tone={issueCount ? "rose" : "slate"}>要確認 {issueCount}</Badge>
        <Badge tone="slate">完了率 {getMedicationCompletionRate(days)}%</Badge>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        対象期間 {calendar ? `${formatDateLabel(calendar.startDate)} - ${formatDateLabel(calendar.endDate)}` : "未作成"}
      </p>

      <div className="mt-3 space-y-2">
        {medicationCoreTimings.map((timing) => (
          <MedicationLine key={timing} timing={timing} items={items[timing] || []} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-700">
        <span>包数：{packageCount} / {days.length ? packageCount : 0}</span>
        <span>順番：{status === "completed" ? "確認済み" : "未確認"}</span>
      </div>
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

function MedicationLine({ timing, items }: { timing: MedicationTiming; items: MedicationPackageItem[] }) {
  return (
    <p className={items.length ? "text-slate-900" : "rounded-md bg-slate-100 px-2 py-1 italic text-slate-500"}>
      <span className="font-bold">{medicationTimingLabels[timing]}：</span>
      {formatPackageItems(items)}
    </p>
  );
}

function PatientsPage({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
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
        key={id || selectedId || "new"}
        patient={id === "new" ? undefined : selectedPatient}
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
                    <span className="text-slate-600">{patient.facilityName || "自宅"}</span>
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
  data,
  reload
}: {
  patient?: Patient;
  data: AppData;
  reload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState("");
  const [activeTab, setActiveTab] = useState<PatientDetailTab>("basic");
  const [form, setForm] = useState<PatientFormValues>(patient ? toPatientForm(patient) : emptyPatientForm);
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

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(""), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const updateForm = <K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const savePatient = async () => {
    if (!form.name.trim()) {
      setSaved("患者名を入力してください");
      return;
    }

    const timestamp = nowString();
    const patientId = patient?.id || createId();
    const payload: Patient = {
      ...form,
      id: patientId,
      order: patient?.order ?? data.patients.length,
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
            <span className="font-semibold text-slate-700">施設名 / 自宅</span>
            <select
              className="touch-target rounded-md border border-slate-300 bg-white px-3 py-3"
              value={form.locationType}
              onChange={(event) => updateForm("locationType", event.target.value as PatientFormValues["locationType"])}
            >
              <option value="home">自宅</option>
              <option value="facility">施設</option>
            </select>
          </label>
          <TextInput label="施設名" value={form.facilityName} onChange={(value) => updateForm("facilityName", value)} />
          <TextInput label="住所" value={form.address} onChange={(value) => updateForm("address", value)} />
          <TextInput label="電話番号" value={form.phone} onChange={(value) => updateForm("phone", value)} />
          <TextInput label="主治医" value={form.doctorName} onChange={(value) => updateForm("doctorName", value)} />
          <TextInput label="訪問看護" value={form.nurseContact} onChange={(value) => updateForm("nurseContact", value)} />
          <TextInput label="家族連絡先" value={form.familyContact} onChange={(value) => updateForm("familyContact", value)} />
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
    { id: "medication", label: "服薬カレンダー", icon: Pill }
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

function PackageAuditEditor({ data, reload }: { data: AppData; reload: () => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = data.patients.find((item) => item.id === id);
  const [selectedTiming, setSelectedTiming] = useState<MedicationTiming>("morning");
  const pattern = patient
    ? data.medicationPackagePatterns.find(
        (item) => item.patientId === patient.id && item.timing === selectedTiming
      )
    : undefined;
  const patternItems = pattern
    ? data.medicationPackageItems
        .filter((item) => item.patternId === pattern.id)
        .sort((a, b) => a.order - b.order)
    : [];
  const [draft, setDraft] = useState<Omit<MedicationPackageItem, "id" | "patternId" | "order" | "createdAt" | "updatedAt">>({
    dosageForm: "tablet",
    quantity: "",
    medicineName: "",
    clinicName: "",
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
    if (!targetPattern) return;
    const timestamp = nowString();
    await db.medicationPackageItems.add({
      ...draft,
      id: createId(),
      patternId: targetPattern.id,
      order: patternItems.length,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    setDraft({
      dosageForm: "tablet",
      quantity: "",
      medicineName: "",
      clinicName: "",
      isTemporary: false,
      isStopped: false,
      isSelfAdjustment: false,
      memo: ""
    });
    await reload();
  };

  const updatePackageItem = async (item: MedicationPackageItem, patch: Partial<MedicationPackageItem>) => {
    await db.medicationPackageItems.update(item.id, { ...patch, updatedAt: nowString() });
    await reload();
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
            <p className="mt-1 text-slate-600">{patient.facilityName || "自宅"}</p>
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
          {medicationEditableTimings.map((timing) => (
            <button
              key={timing}
              type="button"
              onClick={() => setSelectedTiming(timing)}
              className={[
                "touch-target shrink-0 rounded-md px-4 py-2 font-semibold",
                selectedTiming === timing ? "bg-care-700 text-white" : "bg-slate-100 text-slate-700"
              ].join(" ")}
            >
              {medicationTimingLabels[timing]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <h2 className="text-xl font-bold">{medicationTimingLabels[selectedTiming]}の内容</h2>
            {patternItems.length ? (
              patternItems.map((item, index) => (
                <article key={item.id} className="rounded-md border border-slate-200 bg-white p-4">
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
                    <TextInput
                      label="数量"
                      value={item.quantity}
                      onChange={(value) => void updatePackageItem(item, { quantity: value })}
                    />
                    <TextInput
                      label="薬剤名"
                      value={item.medicineName}
                      onChange={(value) => void updatePackageItem(item, { medicineName: value })}
                    />
                    <TextInput
                      label="医療機関"
                      value={item.clinicName}
                      onChange={(value) => void updatePackageItem(item, { clinicName: value })}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Toggle
                      label="臨時薬"
                      checked={item.isTemporary}
                      onChange={(value) => void updatePackageItem(item, { isTemporary: value })}
                    />
                    <Toggle
                      label="中止薬"
                      checked={item.isStopped}
                      onChange={(value) => void updatePackageItem(item, { isStopped: value })}
                    />
                    <Toggle
                      label="自己調節薬"
                      checked={item.isSelfAdjustment}
                      onChange={(value) => void updatePackageItem(item, { isSelfAdjustment: value })}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                    <TextInput
                      label="メモ"
                      value={item.memo}
                      onChange={(value) => void updatePackageItem(item, { memo: value })}
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
                <TextInput label="医療機関" value={draft.clinicName} onChange={(value) => setDraft((current) => ({ ...current, clinicName: value }))} />
                <Toggle label="臨時薬" checked={draft.isTemporary} onChange={(value) => setDraft((current) => ({ ...current, isTemporary: value }))} />
                <Toggle label="中止薬" checked={draft.isStopped} onChange={(value) => setDraft((current) => ({ ...current, isStopped: value }))} />
                <Toggle label="自己調節薬" checked={draft.isSelfAdjustment} onChange={(value) => setDraft((current) => ({ ...current, isSelfAdjustment: value }))} />
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
                    ? data.medicationPackageItems
                        .filter((item) => item.patternId === targetPattern.id)
                        .sort((a, b) => a.order - b.order)
                    : [];
                  return <MedicationLine key={timing} timing={timing} items={targetItems} />;
                })}
              </div>
            </section>
          </aside>
        </div>
      </section>
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
                  <p>{patient?.name || "患者未設定"} / {patient?.facilityName || "自宅"}</p>
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

function SettingsPage({ data }: { data: AppData }) {
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

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <TextInput label={label} type="date" value={value} onChange={onChange} />;
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

function getLatestMedicationCalendar(patientId: string, calendars: MedicationCalendar[]) {
  return calendars
    .filter((calendar) => calendar.patientId === patientId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

function getPatternItems(patterns: MedicationPackagePattern[], items: MedicationPackageItem[]) {
  return patterns.reduce<Record<MedicationTiming, MedicationPackageItem[]>>((acc, pattern) => {
    acc[pattern.timing] = items
      .filter((item) => item.patternId === pattern.id)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<MedicationTiming, MedicationPackageItem[]>);
}

function formatPackageItems(items: MedicationPackageItem[]) {
  if (!items.length) return "お薬はありません";
  return items.map(formatPackageItem).join("→");
}

function formatPackageItem(item: MedicationPackageItem) {
  const base =
    item.dosageForm === "tablet"
      ? `錠（${item.quantity || "0"}）`
      : item.dosageForm === "powder"
        ? `粉（${item.quantity || "0"}）`
        : item.dosageForm === "magnesium"
          ? "Mg"
          : item.dosageForm === "kampo"
            ? item.medicineName || "漢方"
            : item.dosageForm === "patch"
              ? item.medicineName || "貼付"
              : item.medicineName || "その他";
  const temporary = item.isTemporary ? "【臨時】" : "";
  const stopped = item.isStopped ? "【中止】" : "";
  return `${base}${temporary}${stopped}`;
}

function getPackageCount(patterns: MedicationPackagePattern[], items: MedicationPackageItem[]) {
  const packageItems = getPatternItems(patterns, items);
  return medicationCoreTimings.reduce((count, timing) => count + (packageItems[timing]?.length || 0), 0);
}

function hasTemporaryItem(items: Record<MedicationTiming, MedicationPackageItem[]>) {
  return Object.values(items).some((timingItems) => timingItems.some((item) => item.isTemporary));
}

async function normalizePackageOrder(items: MedicationPackageItem[]) {
  await Promise.all(
    items.map((item, order) => db.medicationPackageItems.update(item.id, { order, updatedAt: nowString() }))
  );
}

function toPatientForm(patient: Patient): PatientFormValues {
  const { id, createdAt, updatedAt, ...form } = patient;
  return form;
}

function setVisitValue<K extends keyof Visit>(
  setVisit: React.Dispatch<React.SetStateAction<Visit>>,
  key: K,
  value: Visit[K]
) {
  setVisit((current) => ({ ...current, [key]: value }));
}

export default App;
