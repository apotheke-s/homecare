# 在宅サポートノート

iPad Safari のホーム画面追加を想定した、完全オフライン対応の在宅患者管理PWAです。

## 技術構成

- React + Vite + TypeScript
- Tailwind CSS
- vite-plugin-pwa / Service Worker
- Dexie.js / IndexedDB
- date-fns

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run preview
```

`dist/` を GitHub Pages に配置できます。PWA の app shell は precache され、初回読み込み後はオフラインで起動できます。

## 主な画面

- `/` ダッシュボード
- `/patients` 患者一覧
- `/patients/:id` 患者詳細
- `/patients/:id/package-audit` 一包化編集
- `/tasks` タスク一覧
- `/medication-audit` 服薬カレンダー鑑査
- `/settings` 設定

患者詳細では基本情報、予定、タスク、チェックシート、服薬カレンダーをタブで切り替えます。服薬カレンダーは患者ごとに期間を作成し、日付ごとの朝・昼・夕・寝る前、注意メモ、要確認メモ、鑑査チェックをオフライン保存できます。
服薬カレンダー鑑査画面では患者カードをiPad横向きで4列表示し、並び替えモードON時のみドラッグで手動並び替えできます。カードには一包化内容、包数、順番確認状態、鑑査ステータス、完了率を表示し、カードから一包化編集画面へ遷移できます。

## 保存先

端末内 IndexedDB `homecare-pwa-db` に以下を保存します。

- patients
- visits
- tasks
- checklists
- medicationCalendars
- medicationCalendarDays
- medicationCalendarAudits
- medicationPackagePatterns
- medicationPackageItems
