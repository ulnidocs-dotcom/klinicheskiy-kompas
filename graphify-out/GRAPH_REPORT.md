# Graph Report - klinicheskiy-kompas  (2026-10-20)

## Corpus Check
- 78 files · ~97,342 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 472 nodes · 508 edges · 71 communities (58 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `456db6ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Структура файлов|Структура файлов]]
- [[_COMMUNITY_Структура файлов|Структура файлов]]
- [[_COMMUNITY_Структура файлов|Структура файлов]]
- [[_COMMUNITY_«Клинический компас» — HTML-интерфейсы врача и пациента (демо-прототип)|«Клинический компас» — HTML-интерфейсы врача и пациента (демо-прототип)]]
- [[_COMMUNITY_ui.js|ui.js]]
- [[_COMMUNITY_kk.js|kk.js]]
- [[_COMMUNITY_rules.test.js|rules.test.js]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_scales.js|scales.js]]
- [[_COMMUNITY_scenarios.test.js|scenarios.test.js]]
- [[_COMMUNITY_store.test.js|store.test.js]]
- [[_COMMUNITY_serve.js|serve.js]]
- [[_COMMUNITY_therapy.js|therapy.js]]
- [[_COMMUNITY_adherence.test.js|adherence.test.js]]
- [[_COMMUNITY_load.js|load.js]]
- [[_COMMUNITY_therapy.test.js|therapy.test.js]]
- [[_COMMUNITY_parser.js|parser.js]]
- [[_COMMUNITY_kk.test.js|kk.test.js]]
- [[_COMMUNITY_parser.test.js|parser.test.js]]
- [[_COMMUNITY_scales.test.js|scales.test.js]]
- [[_COMMUNITY_ui.test.js|ui.test.js]]
- [[_COMMUNITY_store.js|store.js]]
- [[_COMMUNITY_patient.js|patient.js]]
- [[_COMMUNITY_today.js|today.js]]
- [[_COMMUNITY_scale.js|scale.js]]
- [[_COMMUNITY_onboarding.js|onboarding.js]]
- [[_COMMUNITY_patient.test.js|patient.test.js]]
- [[_COMMUNITY_doctor.js|doctor.js]]
- [[_COMMUNITY_Клинический компас — демо-прототип|Клинический компас — демо-прототип]]
- [[_COMMUNITY_doctor.test.js|doctor.test.js]]
- [[_COMMUNITY_therapy.js|therapy.js]]
- [[_COMMUNITY_build.test.js|build.test.js]]
- [[_COMMUNITY_contrast.test.js|contrast.test.js]]
- [[_COMMUNITY_tiles.js|tiles.js]]
- [[_COMMUNITY_tiles.test.js|tiles.test.js]]
- [[_COMMUNITY_psych.js|psych.js]]
- [[_COMMUNITY_intake.js|intake.js]]
- [[_COMMUNITY_battery.test.js|battery.test.js]]
- [[_COMMUNITY_battery.js|battery.js]]
- [[_COMMUNITY_intake.test.js|intake.test.js]]
- [[_COMMUNITY_patient.js|patient.js]]

## God Nodes (most connected - your core abstractions)
1. `«Клинический компас» — HTML-интерфейсы врача и пациента (демо-прототип)` - 14 edges
2. `Структура файлов` - 13 edges
3. `Структура файлов` - 13 edges
4. `Структура файлов` - 12 edges
5. `render()` - 11 edges
6. `render()` - 10 edges
7. `Клинический компас — демо-прототип` - 8 edges
8. `current()` - 6 edges
9. `head()` - 6 edges
10. `save()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `render()` --indirect_call--> `pid()`  [INFERRED]
  doctor/import.js → assets/patient.js
- `render()` --indirect_call--> `pid()`  [INFERRED]
  doctor/messages.js → assets/patient.js
- `checkinCard()` --calls--> `checkinOn()`  [INFERRED]
  patient/today.js → assets/patient.js
- `openDay()` --calls--> `checkinOn()`  [INFERRED]
  patient/today.js → assets/patient.js
- `save()` --calls--> `checkinOn()`  [INFERRED]
  patient/today.js → assets/patient.js

## Import Cycles
- None detected.

## Communities (71 total, 13 thin omitted)

### Community 0 - "Структура файлов"
Cohesion: 0.12
Nodes (15): Task 10: Лаунчер демо, Task 11: Обновить граф и итоговая проверка, Task 1: Каркас проекта и тест-раннер, Task 2: Справочник шкал и подсчёт, Task 3: Классы препаратов, Авиандр и проверка терапии, Task 4: Приверженность, Task 5: Правила алертинга и маршрутизации, Task 6: Парсер истории болезни (+7 more)

### Community 1 - "Структура файлов"
Cohesion: 0.13
Nodes (14): Task 10: Материалы — источники и правила, Task 11: Профиль врача, Task 12: Сквозная проверка обеих ролей, Task 1: Оболочка врача и хелперы, Task 2: Очередь пациентов, Task 3: Карточка пациента, Task 4: Оценка на приёме, Task 5: Терапия и подтверждение назначения (+6 more)

### Community 2 - "Структура файлов"
Cohesion: 0.14
Nodes (13): Task 10: Профиль, Task 11: Сквозная проверка пациента, Task 1: Оболочка пациента и материалы, Task 2: Вход и связь с врачом, Task 3: «Сегодня», Task 4: Пошаговый опросник, Task 5: «Мне сейчас очень плохо», Task 6: Лечение и самочувствие на терапии (+5 more)

### Community 3 - "«Клинический компас» — HTML-интерфейсы врача и пациента (демо-прототип)"
Cohesion: 0.10
Nodes (19): 10. Клинические сценарии, 11. Проверка, 12. Открытые вопросы, 13.1 Батарея и порядок (≈ 20 минут), 13.2 Источники и лицензии, 13.3 Предложение маршрута (правила команды, до экспертной проверки), 13.4 ЦТО без автоматической интерпретации, 13.5 Данные и экраны (+11 more)

### Community 4 - "ui.js"
Cohesion: 0.18
Nodes (3): fmtDate(), fmtDateTime(), fmtTime()

### Community 5 - "kk.js"
Cohesion: 0.24
Nodes (4): confirmed(), missedStreak(), pdc(), dayKey()

### Community 6 - "rules.test.js"
Cohesion: 0.31
Nodes (6): assert, at(), dosesFor(), patient(), scale(), test

### Community 7 - "package.json"
Cohesion: 0.25
Nodes (7): description, name, private, scripts, serve, test, version

### Community 8 - "scales.js"
Cohesion: 0.87
Nodes (5): bandFor(), cssrsBand(), def(), interpret(), score()

### Community 10 - "scenarios.test.js"
Cohesion: 0.40
Nodes (4): assert, eventsOf(), signals(), test

### Community 11 - "store.test.js"
Cohesion: 0.33
Nodes (5): assert, memStorage(), mk(), NOW, test

### Community 12 - "serve.js"
Cohesion: 0.17
Nodes (11): assert, path, { resolvePath }, root, test, fs, http, path (+3 more)

### Community 13 - "therapy.js"
Cohesion: 0.60
Nodes (3): check(), isIndicated(), patientClasses()

### Community 15 - "load.js"
Cohesion: 0.40
Nodes (4): FILES, fs, path, root

### Community 18 - "parser.js"
Cohesion: 0.60
Nodes (5): extract(), extractAge(), extractEgfr(), mentions(), negated()

### Community 23 - "store.js"
Cohesion: 0.26
Nodes (11): get(), apply(), current(), migrate(), pref(), resolve(), set(), sync() (+3 more)

### Community 29 - "patient.js"
Cohesion: 0.09
Nodes (8): dayTitle(), noonOf(), pathTiles(), pid(), start(), trendWord(), render(), render()

### Community 30 - "today.js"
Cohesion: 0.22
Nodes (17): checkinOn(), checkinCard(), closeFlow(), doneCard(), glide(), header(), helpCard(), intakeCard() (+9 more)

### Community 42 - "doctor.js"
Cohesion: 0.12
Nodes (10): audio(), beep(), closeCriticalModal(), patientHeader(), renderSide(), showCriticalModal(), signalBadge(), signalHtml() (+2 more)

### Community 43 - "Клинический компас — демо-прототип"
Cohesion: 0.22
Nodes (8): Где расширять, Демо-сценарии, Запуск, Источники, Клинический компас — демо-прототип, Ограничения демо, Принципы, Структура

### Community 53 - "build.test.js"
Cohesion: 0.17
Nodes (13): assert, { build }, fs, os, path, test, build(), fs (+5 more)

### Community 54 - "contrast.test.js"
Cohesion: 0.10
Nodes (15): assert, AURA_HUES, colorOf(), css, fs, lum(), PAIRS, path (+7 more)

### Community 55 - "tiles.js"
Cohesion: 0.27
Nodes (6): dotLayout(), dotRow(), frac(), rangeBar(), ringArc(), ringGauge()

### Community 58 - "psych.js"
Cohesion: 0.16
Nodes (6): colorStrip(), ctoHtml(), levelBadge(), queue(), renderSide(), routeHtml()

### Community 59 - "intake.js"
Cohesion: 0.32
Nodes (12): answered(), cssrsStep(), ctoIntro(), ctoStep(), done(), finish(), formStep(), go() (+4 more)

### Community 60 - "battery.test.js"
Cohesion: 0.10
Nodes (18): A_ITEMS, assert, cs(), CS_NONE, D_ITEMS, dass(), intake(), NO (+10 more)

### Community 61 - "battery.js"
Cohesion: 0.43
Nodes (7): checked(), ctoSimilarity(), dassBand(), routeIntake(), scoreDass(), scoreTipi(), spearman()

### Community 62 - "intake.test.js"
Cohesion: 0.25
Nodes (4): assert, FORM, NOW, test

## Knowledge Gaps
- **141 isolated node(s):** `name`, `version`, `private`, `description`, `test` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `checkinOn()` connect `today.js` to `patient.js`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `save()` connect `today.js` to `intake.js`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `get()` connect `store.js` to `patient.js`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Структура файлов` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Структура файлов` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Структура файлов` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._