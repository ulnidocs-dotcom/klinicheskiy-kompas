# Graph Report - klinicheskiy-kompas  (2026-10-19)

## Corpus Check
- 31 files · ~35,957 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 173 nodes · 164 edges · 29 communities (22 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff5c4ace`
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

## God Nodes (most connected - your core abstractions)
1. `Структура файлов` - 13 edges
2. `Структура файлов` - 13 edges
3. `«Клинический компас» — HTML-интерфейсы врача и пациента (демо-прототип)` - 13 edges
4. `Структура файлов` - 12 edges
5. `def()` - 5 edges
6. `bandFor()` - 4 edges
7. `score()` - 4 edges
8. `at()` - 4 edges
9. `confirmed()` - 3 edges
10. `pdc()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `pdc()` --calls--> `dayKey()`  [INFERRED]
  assets/adherence.js → assets/kk.js
- `missedStreak()` --calls--> `dayKey()`  [INFERRED]
  assets/adherence.js → assets/kk.js

## Import Cycles
- None detected.

## Communities (29 total, 7 thin omitted)

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
Cohesion: 0.14
Nodes (13): 10. Клинические сценарии, 11. Проверка, 12. Открытые вопросы, 1. Цель и рамки, 2. Научная база UX-решений, 3. Визуальная система, 4. Архитектура, 5. Экраны пациента (+5 more)

### Community 4 - "ui.js"
Cohesion: 0.22
Nodes (3): fmtDate(), fmtDateTime(), fmtTime()

### Community 5 - "kk.js"
Cohesion: 0.27
Nodes (4): confirmed(), missedStreak(), pdc(), dayKey()

### Community 6 - "rules.test.js"
Cohesion: 0.31
Nodes (6): assert, at(), dosesFor(), patient(), scale(), test

### Community 7 - "package.json"
Cohesion: 0.25
Nodes (7): description, name, private, scripts, serve, test, version

### Community 8 - "scales.js"
Cohesion: 0.80
Nodes (5): bandFor(), cssrsBand(), def(), interpret(), score()

### Community 10 - "scenarios.test.js"
Cohesion: 0.40
Nodes (4): assert, eventsOf(), signals(), test

### Community 11 - "store.test.js"
Cohesion: 0.40
Nodes (5): assert, memStorage(), mk(), NOW, test

### Community 12 - "serve.js"
Cohesion: 0.33
Nodes (5): fs, http, path, root, TYPES

### Community 13 - "therapy.js"
Cohesion: 0.60
Nodes (3): check(), isIndicated(), patientClasses()

### Community 15 - "load.js"
Cohesion: 0.40
Nodes (4): FILES, fs, path, root

## Knowledge Gaps
- **82 isolated node(s):** `name`, `version`, `private`, `description`, `test` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `name`, `version`, `private` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Структура файлов` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Структура файлов` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Структура файлов` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `«Клинический компас» — HTML-интерфейсы врача и пациента (демо-прототип)` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._