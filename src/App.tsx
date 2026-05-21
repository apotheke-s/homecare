import { useEffect, useMemo, useState } from "react";
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
  Home,
  Menu,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  Stethoscope,
  UserRound,
  UsersRound
} from "lucide-react";
import { addDays, format } from "date-fns";
import { db, seedSampleData } from "./db";
import type { Checklist, Patient, PatientFormValues, Task, TaskType, Visit } from "./types";
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

function App() {
  const [data, setData] = useState<AppData>({
    patients: [],
    visits: [],
    tasks: [],
    checklists: []
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const reload = async () => {
    const [patients, visits, tasks, checklists] = await Promise.all([
      db.patients.orderBy("kana").toArray(),
      db.visits.toArray(),
      db.tasks.orderBy("dueDate").toArray(),
      db.checklists.toArray()
    ]);
    setData({ patients, visits, tasks, checklists });
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
              <Route path="/tasks" element={<TasksPage data={data} reload={reload} />} />
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={CalendarDays} label="今日の訪問" value={todayVisits.length} tone="care" />
        <MetricCard icon={Package} label="今日の配達" value={todayDeliveries.length} tone="blue" />
        <MetricCard icon={AlertTriangle} label="残薬注意" value={lowMedicine.length} tone="rose" />
        <MetricCard icon={Stethoscope} label="医師確認" value={doctorTasks.length} tone="amber" />
        <MetricCard icon={ClipboardCheck} label="未完了タスク" value={openTasks.length} tone="slate" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DashboardList title="今日の対応" items={[...todayVisits, ...todayDeliveries]} data={data} />
        <TaskListPanel title="未完了タスク" tasks={openTasks.slice(0, 8)} patients={data.patients} />
      </div>

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
  const [form, setForm] = useState<PatientFormValues>(patient ? toPatientForm(patient) : emptyPatientForm);
  const existingVisit = patient ? data.visits.find((visit) => visit.patientId === patient.id && !visit.completed) : undefined;
  const [visit, setVisit] = useState<Visit>(existingVisit || emptyVisit(patient?.id || ""));
  const existingChecklist = patient
    ? data.checklists.find((item) => item.patientId === patient.id && item.date === todayString())
    : undefined;
  const [checklist, setChecklist] = useState<Checklist>(existingChecklist || emptyChecklist(patient?.id || ""));

  const patientTasks = patient ? data.tasks.filter((task) => task.patientId === patient.id) : [];
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
      </section>

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

      <PatientTasks patient={patient} tasks={patientTasks} reload={reload} onToggle={toggleTask} />

      <ChecklistPanel checklist={checklist} setChecklist={setChecklist} onSave={saveChecklist} />

      {saved ? (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md bg-slate-900 px-5 py-3 font-semibold text-white shadow-lg">
          {saved}
        </div>
      ) : null}
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
