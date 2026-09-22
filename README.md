# Pravka

Редактор конфигов [zapret](https://github.com/bol-van/zapret) — `winws` / `nfqws`, `.bat` и голые аргументы. Правка стратегий между `--new`, а не универсальный shell-редактор.

Живая версия на Vercel: [https://pravka-eta.vercel.app/](https://pravka-eta.vercel.app/)

## Возможности

- Своя подсветка флагов: WinDivert, фильтры, hostlist/ipset, desync, fake, `--new`, `%BIN%`, порты, пути и лишний хвост.
- Автодополнение флагов и значений (`fake`, `multisplit`, `badseq`, `midsld`…).
- Hover по опциям из документации nfqws/winws.
- Линтер: неизвестные флаги, битые режимы, linux-only в `.bat`, `fake,multisplit` без `--dpi-desync-split-pos`, мусор в командной строке.
- Оглавление блоков, панель проблем, форматирование с `^`.
- Темы редактора (Zapret, Dracula, One Dark, Nord, Monokai, Tokyo Night, Catppuccin, Gruvbox, светлые), перенос строк, масштаб интерфейса.

## Запуск

Онлайн: [pravka-eta.vercel.app](https://pravka-eta.vercel.app/)

Локально:

```bash
npm install
npm run dev
```

Сборка: `npm run build`.

## Клавиши

| Сочетание | Действие |
| --- | --- |
| `Ctrl+S` | Сохранить файл |
| `Ctrl+Shift+F` | Форматировать |
| `Ctrl+Shift+M` | Панель проблем |
| `Ctrl+Alt+Z` | Перенос строк |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Масштаб |

Конфиг и настройки живут в `localStorage` браузера.

## Откуда флаги

Каталог собран по [docs/readme.md](https://github.com/bol-van/zapret/blob/master/docs/readme.md) и [docs/windows.md](https://github.com/bol-van/zapret/blob/master/docs/windows.md). Сам zapret сюда не входит — это только правка его командной строки.
