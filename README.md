# 🧮 Calculadora Interactiva v2.0

[![Status](https://img.shields.io/badge/status-active-success)]()
[![JavaScript](https://img.shields.io/badge/JS-Vanilla-yellow)]()
[![Responsive](https://img.shields.io/badge/UI-Responsive-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

Aplicación web de calculadora científica construida con **JavaScript puro**, enfocada en arquitectura limpia, evaluación de expresiones matemáticas y experiencia de usuario moderna.

🔗 **Live Demo**  
👉 https://calculadora-interactiva-js.infinityfreeapp.com/?i=1

---

## 🚀 Features

- ⚙️ Evaluación de expresiones con **Shunting-Yard Algorithm**
- 🧮 Operaciones:
  - Básicas (`+ − × ÷ %`)
  - Avanzadas (`^`, paréntesis)
- 📐 Funciones científicas:
  - Trigonométricas: `sin`, `cos`, `tan`
  - Logarítmicas: `log`, `ln`
  - Otras: `√`, `x²`, `xʸ`, `n!`
- 🧠 Sistema de memoria (MC / MR / M+ / M−)
- 📜 Historial persistente (`localStorage`)
- 🌗 Dark / Light mode persistente
- 🔊 Feedback sonoro (Web Audio API)
- ♿ Accesibilidad (ARIA + navegación por teclado)
- ⌨️ Atajos de teclado completos
- 📱 UI totalmente responsive

---

## 🧠 Core Concepts

### 🔹 Parser matemático
- Tokenización
- Conversión infijo → RPN
- Evaluación mediante stack

### 🔹 Manejo de estado
- Estado centralizado sin frameworks
- Control de entrada, tokens y memoria

### 🔹 Arquitectura modular
- Separación lógica/UI/eventos
- Delegación de eventos eficiente
- Render reactivo manual

---

## 🗂️ Estructura del proyecto
.
├── index.html
├── styles.css
└── script.js

## ⌨️ Keyboard Shortcuts

| Key         | Action        |
|------------|--------------|
| 0–9        | Input digits |
| + − * / ^  | Operators    |
| ( )        | Parentheses  |
| Enter      | Calculate    |
| Esc        | Clear        |
| Backspace  | Delete       |

---

## 🛠️ Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Web Audio API
- LocalStorage / SessionStorage

---

## 🎯 Objetivo

Proyecto diseñado para demostrar:

- Implementación de algoritmos en frontend
- Manejo de estado sin frameworks
- Buenas prácticas en UX/UI
- Código escalable y mantenible en JS puro

---

## 📈 Posibles mejoras

- Modularización con ES Modules
- Tests unitarios (Jest / Vitest)
- Soporte para radianes
- Historial exportable
- PWA (offline support)

---

## 👤 Autor

**Michael Heredia**  
🔗 https://github.com/DmeshellHeredia

---

## 📄 License

MIT License
