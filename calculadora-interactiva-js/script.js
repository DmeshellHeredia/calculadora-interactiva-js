  /* ================================================================
    CALCULADORA INTERACTIVA — script.js  v2.0
    Arquitectura:
      §1  Constantes y tipos de token
      §2  Funciones matemáticas puras (lanzan en error)
      §3  Parser de expresiones — Shunting-Yard
      §4  Estado centralizado
      §5  Motor de sonido (Web Audio API)
      §6  Historial (localStorage)
      §7  Referencias DOM
      §8  Funciones de UI
      §9  Acciones de la calculadora
      §10 Tema y modo
      §11 Sistema de eventos (delegación)
      §12 Atajos de teclado
      §13 Modal "Acerca de"
      §14 Inicialización
    ================================================================ */

  "use strict";

  /* ── §1  CONSTANTES Y TIPOS ─────────────────────────────────── */

  const TT = Object.freeze({
    NUM: "num",
    OP:  "op",
    FN:  "fn",
    LP:  "lp",   // (
    RP:  "rp",   // )
  });

  const OP_INFO = Object.freeze({
    "+": { prec: 1, asoc: "L", sym: "+" },
    "-": { prec: 1, asoc: "L", sym: "−" },
    "*": { prec: 2, asoc: "L", sym: "×" },
    "/": { prec: 2, asoc: "L", sym: "÷" },
    "%": { prec: 2, asoc: "L", sym: "%" },
    "^": { prec: 3, asoc: "R", sym: "^" },
  });

  const MAX_DIGITOS    = 14;
  const MAX_HISTORIAL  = 12;
  const LS_HISTORIAL   = "calc_historial_v2";
  const LS_TEMA        = "calc_tema";
  const LS_MODO        = "calc_modo";
  const LS_SONIDO      = "calc_sonido";
  const SS_ULTIMO_RES  = "calc_ultimoRes";

  /* ── §2  MATEMÁTICAS PURAS ──────────────────────────────────── */

  /** Convierte grados a radianes */
  const toRad = (deg) => (deg * Math.PI) / 180;

  /** Devuelve n! o lanza si inválido */
  function factorial(n) {
    if (n < 0)          throw new Error("Factorial de número negativo.");
    if (!Number.isInteger(n)) throw new Error("Factorial requiere entero.");
    if (n > 170)        throw new Error("Factorial demasiado grande.");
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  /**
   * Registro de funciones científicas.
   * fn recibe el argumento y lanza en caso de error.
   */
  const FUNCIONES = Object.freeze({
    sin:      { fn: (x) => Math.sin(toRad(x)),    etq: "sin" },
    cos:      { fn: (x) => Math.cos(toRad(x)),    etq: "cos" },
    tan:      { fn: (x) => {
                  if (Math.abs(x % 180) === 90) throw new Error("tan(90°) indefinido.");
                  return Math.tan(toRad(x));
                },                                 etq: "tan" },
    sqrt:     { fn: (x) => {
                  if (x < 0) throw new Error("Raíz de número negativo.");
                  return Math.sqrt(x);
                },                                 etq: "√"   },
    log:      { fn: (x) => {
                  if (x <= 0) throw new Error("log(x) requiere x > 0.");
                  return Math.log10(x);
                },                                 etq: "log" },
    ln:       { fn: (x) => {
                  if (x <= 0) throw new Error("ln(x) requiere x > 0.");
                  return Math.log(x);
                },                                 etq: "ln"  },
    cuadrado: { fn: (x) => x * x,                 etq: "sqr" },
    factorial:{ fn: (x) => factorial(x),           etq: "n!"  },
  });

  /** Aplica un operador binario o lanza en error */
  function aplicarOp(a, op, b) {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/":
        if (b === 0) throw new Error("División entre cero.");
        return a / b;
      case "%":
        if (b === 0) throw new Error("Módulo entre cero.");
        return a % b;
      case "^": return Math.pow(a, b);
      default:  throw new Error(`Operador desconocido: "${op}".`);
    }
  }

  /* ── §3  PARSER: SHUNTING-YARD ──────────────────────────────── */

  /**
   * Construye un token numérico.
   * @param {number} v  - valor numérico
   * @param {string} [d] - cadena para mostrar (opcional)
   */
  const mkNum = (v, d) => ({ t: TT.NUM, v,  d: d ?? formatearNum(v) });
  const mkOp  = (v)    => ({ t: TT.OP,  v,  d: ` ${OP_INFO[v].sym} ` });
  const mkFn  = (v)    => ({ t: TT.FN,  v,  d: FUNCIONES[v]?.etq ?? v });
  const mkLP  = ()     => ({ t: TT.LP,       d: "(" });
  const mkRP  = ()     => ({ t: TT.RP,       d: ")" });

  /**
   * Convierte un token a su representación visual.
   */
  function tokTexto(t) {
    switch (t.t) {
      case TT.NUM: return t.d;
      case TT.OP:  return t.d;
      case TT.FN:  return t.d;
      case TT.LP:  return "(";
      case TT.RP:  return ")";
      default:     return "";
    }
  }

  /**
   * Algoritmo Shunting-Yard: convierte tokens en notación infija
   * a notación polaca inversa (RPN).
   * @param {Array} tokens
   * @returns {Array} RPN
   */
  function infijosARPN(tokens) {
    const salida = [];
    const pila   = [];

    for (const tok of tokens) {
      switch (tok.t) {
        case TT.NUM:
          salida.push(tok);
          break;

        case TT.FN:
          pila.push(tok);
          break;

        case TT.OP: {
          const { prec, asoc } = OP_INFO[tok.v];
          while (pila.length) {
            const tope = pila[pila.length - 1];
            if (tope.t === TT.LP) break;
            const topePrec = tope.t === TT.FN
              ? 999
              : (OP_INFO[tope.v]?.prec ?? 0);
            if (topePrec > prec || (topePrec === prec && asoc === "L")) {
              salida.push(pila.pop());
            } else break;
          }
          pila.push(tok);
          break;
        }

        case TT.LP:
          pila.push(tok);
          break;

        case TT.RP: {
          let encontrado = false;
          while (pila.length) {
            if (pila[pila.length - 1].t === TT.LP) {
              pila.pop();
              encontrado = true;
              break;
            }
            salida.push(pila.pop());
          }
          if (!encontrado) throw new Error("Paréntesis no balanceados.");
          // Si hay función en la cima, sacarla
          if (pila.length && pila[pila.length - 1].t === TT.FN) {
            salida.push(pila.pop());
          }
          break;
        }
      }
    }

    while (pila.length) {
      const tope = pila.pop();
      if (tope.t === TT.LP || tope.t === TT.RP) {
        throw new Error("Paréntesis no balanceados.");
      }
      salida.push(tope);
    }

    return salida;
  }

  /**
   * Evalúa una secuencia en RPN.
   */
  function evaluarRPN(rpn) {
    const pila = [];

    for (const tok of rpn) {
      switch (tok.t) {
        case TT.NUM:
          pila.push(tok.v);
          break;

        case TT.OP: {
          if (pila.length < 2) throw new Error("Expresión incompleta.");
          const b = pila.pop(), a = pila.pop();
          pila.push(aplicarOp(a, tok.v, b));
          break;
        }

        case TT.FN: {
          if (pila.length < 1) throw new Error("Argumento de función faltante.");
          pila.push(FUNCIONES[tok.v].fn(pila.pop()));
          break;
        }
      }
    }

    if (pila.length !== 1) throw new Error("Expresión inválida.");
    return pila[0];
  }

  /**
   * Evalúa un array de tokens en notación infija.
   * Lanza Error si hay algún problema.
   */
  function evaluarTokens(tokens) {
    if (!tokens.length) throw new Error("Expresión vacía.");
    return evaluarRPN(infijosARPN(tokens));
  }

  /* ── §4  ESTADO ─────────────────────────────────────────────── */

  /**
   * Estado centralizado de la calculadora.
   * Nunca se muta desde fuera de las funciones de acción.
   */
  const estado = {
    tokens:        [],      // tokens confirmados
    entrada:       "0",     // número en curso
    esperando:     true,    // esperando primer dígito (tras op / fn / lp)
    parenProf:     0,       // paréntesis sin cerrar
    recienIgual:   false,   // acaba de presionar =
    expresionPost: "",      // expresión mostrada tras = o error
    memoria:       0,
    hayMemoria:    false,
    ultimoRes:     null,    // ANS
    hayError:      false,
  };

  function resetear() {
    // Conserva memoria, ultimoRes y tema
    estado.tokens       = [];
    estado.entrada      = "0";
    estado.esperando    = true;
    estado.parenProf    = 0;
    estado.recienIgual  = false;
    estado.expresionPost= "";
    estado.hayError     = false;
  }

  /** Recalcula parenProf desde el array de tokens (defensivo) */
  function recalcularProf() {
    estado.parenProf = estado.tokens.reduce((acc, t) => {
      if (t.t === TT.LP) return acc + 1;
      if (t.t === TT.RP) return acc - 1;
      return acc;
    }, 0);
  }

  /* ── §5  SONIDO ─────────────────────────────────────────────── */

  let audioCtx = null;
  let sonidoActivo = false;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  /**
   * Genera un tono breve con el oscillator de Web Audio API.
   */
  function tono(freq, dur, tipo = "sine", vol = 0.055) {
    if (!sonidoActivo) return;
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = tipo;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch (_) { /* silencioso */ }
  }

  const SONIDOS = {
    digito:   () => tono(880, 0.045, "sine",     0.040),
    operador: () => tono(660, 0.065, "sine",     0.048),
    igual:    () => tono(1047, 0.10, "sine",     0.060),
    limpiar:  () => tono(440, 0.09,  "sine",     0.038),
    error:    () => tono(180, 0.22,  "sawtooth", 0.045),
    memoria:  () => tono(770, 0.08,  "triangle", 0.046),
    copiar:   () => tono(1320, 0.06, "sine",     0.040),
  };

  /* ── §6  HISTORIAL ──────────────────────────────────────────── */

  let historial = [];

  function cargarHistorial() {
    try {
      const raw = localStorage.getItem(LS_HISTORIAL);
      historial = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(historial)) historial = [];
    } catch { historial = []; }
  }

  function guardarHistorial() {
    try { localStorage.setItem(LS_HISTORIAL, JSON.stringify(historial)); }
    catch { /* cuota excedida */ }
  }

  function agregarAlHistorial(expresion, valor) {
    const item = {
      id:        Date.now(),
      expresion: expresion.trim(),
      valor,
      display:   formatearNum(valor),
      hora:      new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
    };
    historial.unshift(item);
    if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
    guardarHistorial();
  }

  /* ── §7  REFERENCIAS DOM ────────────────────────────────────── */

  const $ = (id) => document.getElementById(id);

  const pantalla        = $("pantalla");
  const pantallExpr     = $("pantallExpresion");
  const pantallValor    = $("pantallaValor");
  const copiarBtn       = $("copiarBtn");
  const indMem          = $("indicadorMemoria");
  const indParen        = $("indicadorParen");
  const tecladoCient    = $("tecladoCientifico");
  const histListaEl     = $("historialLista");
  const histVacioEl     = $("historialVacio");
  const limpHistBtn     = $("limpiarHistorialBtn");
  const sonidoBtn       = $("sonidoBtn");
  const sobreBtn        = $("sobreBtn");
  const temaBtn         = $("temaBtn");
  const temaIcono       = $("temaIcono");
  const modalOverlay    = $("modalOverlay");
  const modalCerrar     = $("modalCerrar");
  const anuncioSR       = $("anuncioSR");
  const modoBtns        = document.querySelectorAll(".modo-btn");

  /* ── §8  FUNCIONES DE UI ────────────────────────────────────── */

  /**
   * Formatea un número para mostrar en pantalla.
   * Evita dígitos flotantes excesivos y usa notación científica si necesario.
   */
  function formatearNum(n) {
    if (!isFinite(n)) return n > 0 ? "∞" : "-∞";
    if (isNaN(n))     return "Error";

    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e13 || abs < 1e-9)) {
      return n.toExponential(6).replace(/\.?0+e/, "e");
    }
    // Hasta 10 decimales significativos
    return parseFloat(n.toPrecision(12)).toString();
  }

  /** Ajusta font-size del valor según su longitud */
  function ajustarFontValor(str) {
    const len = str.length;
    pantallValor.style.fontSize =
      len > 16 ? "1.05rem" :
      len > 13 ? "1.4rem"  :
      len > 10 ? "1.8rem"  :
                "";
  }

  /** Construye el texto de la expresión para la línea pequeña */
  function textoExpresion() {
    if (estado.recienIgual || estado.hayError) return estado.expresionPost;
    const partes = estado.tokens.map(tokTexto);
    if (!estado.esperando) partes.push(estado.entrada);
    return partes.join("");
  }

  /** Actualiza toda la pantalla */
  function puedeCopiarValorActual() {
    if (estado.hayError) return false;

    const texto = String(estado.entrada).trim();
    if (!texto) return false;
    if (texto === "0") return false;
    if (texto === "Error") return false;

    return !Number.isNaN(Number(texto));
  }

  function actualizarDisplay({ animar = false } = {}) {
    // Expresión pequeña
    pantallExpr.textContent = textoExpresion();

    // Valor principal
    pantallValor.textContent = estado.entrada;
    ajustarFontValor(estado.entrada);

    // Estado de error
    pantalla.classList.toggle("pantalla-error", estado.hayError);

    // Botón copiar
    copiarBtn.hidden = !puedeCopiarValorActual();

    // Indicador de memoria
    indMem.hidden = !estado.hayMemoria;

    // Indicador de paréntesis abiertos
    const p = estado.parenProf;
    indParen.hidden = p <= 0;
    if (p > 0) indParen.textContent = "(".repeat(Math.min(p, 5));

    // Destacar botón de operador activo
    actualizarBotónOpActivo();

    // Animación de resultado
    if (animar) {
      pantallValor.classList.remove("resultado-animar");
      void pantallValor.offsetWidth;
      pantallValor.classList.add("resultado-animar");
    }
  }

  /** Destaca el operador que está esperando segundo operando */
  function actualizarBotónOpActivo() {
    document.querySelectorAll(".btn-operador.op-activo")
      .forEach((b) => b.classList.remove("op-activo"));

    if (estado.esperando && estado.tokens.length) {
      const last = estado.tokens[estado.tokens.length - 1];
      if (last.t === TT.OP) {
        const op = last.v;
        const sym = OP_INFO[op]?.sym;
        document.querySelectorAll(".btn-operador").forEach((b) => {
          // Compara el texto visible del botón con el símbolo
          if (b.textContent.trim() === sym) b.classList.add("op-activo");
        });
      }
    }
  }

  /** Renderiza el historial completo */
  function renderizarHistorial(nuevoId = null) {
    histListaEl.innerHTML = "";
    histVacioEl.hidden = historial.length > 0;

    historial.forEach((item) => {
      const li = document.createElement("li");
      li.className = "historial-item" + (item.id === nuevoId ? " nuevo" : "");
      li.dataset.valor = item.valor;
      li.setAttribute("tabindex", "0");
      li.setAttribute("role", "button");
      li.setAttribute(
        "aria-label",
        `Reutilizar resultado ${item.display} de ${item.expresion}`
      );

      li.innerHTML = `
        <span class="hist-expresion" title="${item.expresion}">${item.expresion}</span>
        <span class="hist-resultado">= ${item.display}</span>
        <span class="hist-hora">${item.hora}</span>
      `;
      histListaEl.appendChild(li);
    });
  }

  /** Muestra un mensaje toast temporal */
  function toast(msg, tipo = "info", duracion = 2000) {
    // Reusa el mismo toast si existe
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className   = `toast toast-${tipo}`;

    // Forzar reflow antes de añadir "visible"
    void el.offsetWidth;
    el.classList.add("visible");

    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.classList.remove("visible");
    }, duracion);
  }

  /** Anuncia un mensaje para lectores de pantalla */
  function anunciarSR(msg) {
    anuncioSR.textContent = "";
    // RAF asegura que el change sea percibido como nuevo
    requestAnimationFrame(() => { anuncioSR.textContent = msg; });
  }

  /** Anima el botón que fue pulsado */
  function animarBtn(btn) {
    if (!btn) return;
    btn.classList.remove("anim-presionado");
    void btn.offsetWidth;
    btn.classList.add("anim-presionado");
    btn.addEventListener("animationend", () => {
      btn.classList.remove("anim-presionado");
    }, { once: true });
  }

  /** Sacude la pantalla (error) */
  function animarError() {
    pantalla.classList.remove("anim-error");
    void pantalla.offsetWidth;
    pantalla.classList.add("anim-error");
  }

  /* ── §9  ACCIONES DE CALCULADORA ────────────────────────────── */

  /** Muestra un error en pantalla */
  function mostrarError(msg) {
    estado.hayError     = true;
    estado.entrada      = msg;
    estado.expresionPost= "Error";
    actualizarDisplay();
    animarError();
    SONIDOS.error();
    anunciarSR(`Error: ${msg}`);
  }

  /** Limpia todo (preserva memoria y ultimoRes) */
  function accionLimpiar() {
    const { memoria, hayMemoria, ultimoRes } = estado;
    resetear();
    estado.memoria    = memoria;
    estado.hayMemoria = hayMemoria;
    estado.ultimoRes  = ultimoRes;
    actualizarDisplay();
    SONIDOS.limpiar();
  }

  /** Borra el último carácter o el último token */
  function accionBorrar() {
    if (estado.hayError)    { accionLimpiar(); return; }
    if (estado.recienIgual) return; // no tiene sentido borrar tras =

    if (estado.esperando) {
      // Borra el último token del array
      if (!estado.tokens.length) return;
      const ultimo = estado.tokens[estado.tokens.length - 1];
      estado.tokens.pop();

      // Si era un LP y ahora el tope es FN, quita también el FN
      if (
        ultimo.t === TT.LP &&
        estado.tokens.length &&
        estado.tokens[estado.tokens.length - 1].t === TT.FN
      ) {
        estado.tokens.pop();
      }

      recalcularProf();

      // Si el nuevo tope es un número (RP), desactivamos esperando
      const nuevo = estado.tokens[estado.tokens.length - 1];
      if (!nuevo || nuevo.t === TT.OP || nuevo.t === TT.FN || nuevo.t === TT.LP) {
        // seguimos esperando
      } else {
        // Era RP: ahora el cursor queda tras el paréntesis
        estado.esperando = true;
      }
      actualizarDisplay();
      return;
    }

    // Borra carácter del número en curso
    if (estado.entrada.length <= 1 ||
        (estado.entrada.startsWith("-") && estado.entrada.length === 2)) {
      estado.entrada   = "0";
      estado.esperando = !estado.tokens.length;
    } else {
      estado.entrada = estado.entrada.slice(0, -1);
      if (estado.entrada === "-") estado.entrada = "0";
    }

    actualizarDisplay();
  }

  /** Agrega un dígito */
  function accionDigito(d) {
    if (estado.hayError) { resetear(); }

    if (estado.recienIgual) {
      resetear();
    }

    if (estado.esperando) {
      estado.entrada   = d === "0" ? "0" : d;
      estado.esperando = false;
    } else {
      if (estado.entrada === "0" && d !== ".") {
        estado.entrada = d;
      } else {
        // Limitar dígitos (excluir punto y signo del conteo)
        const digitos = estado.entrada.replace(/[^0-9]/g, "").length;
        if (digitos >= MAX_DIGITOS) return;
        estado.entrada += d;
      }
    }

    actualizarDisplay();
    SONIDOS.digito();
  }

  /** Agrega el punto decimal */
  function accionDecimal() {
    if (estado.hayError)    { resetear(); }
    if (estado.recienIgual) { resetear(); }

    if (estado.esperando) {
      estado.entrada   = "0.";
      estado.esperando = false;
      actualizarDisplay();
      return;
    }

    if (!estado.entrada.includes(".")) {
      estado.entrada += ".";
      actualizarDisplay();
    }
  }

  /** Alterna el signo del número actual */
  function accionSigno() {
    if (estado.hayError) return;

    if (estado.esperando && !estado.tokens.length) return; // nada que negar

    if (estado.entrada === "0") return;

    estado.entrada = estado.entrada.startsWith("-")
      ? estado.entrada.slice(1)
      : "-" + estado.entrada;

    if (estado.recienIgual && estado.ultimoRes !== null) {
      estado.ultimoRes = -estado.ultimoRes;
    }
    actualizarDisplay();
  }

  /** Convierte el valor actual a porcentaje (÷ 100) */
  function accionPorcentaje() {
    if (estado.hayError) return;
    if (estado.esperando && !estado.tokens.length) return;

    const val = parseFloat(estado.entrada);
    if (isNaN(val)) return;

    estado.entrada = formatearNum(val / 100);
    actualizarDisplay();
  }

  /**
   * Agrega un operador binario.
   * Reemplaza si el último token también era operador.
   */
  function accionOperador(op) {
    if (estado.hayError) return;

    // Tras resultado: empieza nueva expresión con ese resultado
    if (estado.recienIgual) {
      const n = parseFloat(estado.entrada);
      estado.tokens        = [mkNum(n, estado.entrada), mkOp(op)];
      estado.entrada       = "0";
      estado.esperando     = true;
      estado.recienIgual   = false;
      estado.expresionPost = "";
      actualizarDisplay();
      SONIDOS.operador();
      return;
    }

    // Si esperamos operando...
    if (estado.esperando && estado.tokens.length) {
      const ultimo = estado.tokens[estado.tokens.length - 1];

      if (ultimo.t === TT.OP) {
        // Reemplaza el operador anterior
        estado.tokens[estado.tokens.length - 1] = mkOp(op);
        actualizarDisplay();
        SONIDOS.operador();
        return;
      }

      if (ultimo.t === TT.LP || ultimo.t === TT.FN) {
        // Después de '(' solo permitimos '-' como menos unario (inserta 0)
        if (op === "-") {
          estado.tokens.push(mkNum(0, "0"));
          estado.tokens.push(mkOp("-"));
          actualizarDisplay();
          SONIDOS.operador();
        }
        return;
      }
    }

    // Sin tokens y estado fresco: añade 0 implícito
    if (!estado.tokens.length && estado.esperando) {
      estado.tokens.push(mkNum(0, "0"));
    } else if (!estado.esperando) {
      // Confirma la entrada como número
      estado.tokens.push(mkNum(parseFloat(estado.entrada), estado.entrada));
    }

    estado.tokens.push(mkOp(op));
    estado.entrada   = "0";
    estado.esperando = true;

    actualizarDisplay();
    SONIDOS.operador();
  }

  /** Inserta una constante (π, e) */
  function accionConstante(nombre) {
    if (estado.hayError) return;

    const CONST = { pi: { v: Math.PI, d: "π" }, euler: { v: Math.E, d: "e" } };
    const c = CONST[nombre];
    if (!c) return;

    if (estado.recienIgual) {
      resetear();
      estado.tokens.push(mkOp("*")); // implícita
    }

    if (!estado.esperando) {
      // número seguido de constante → multiplicación implícita
      estado.tokens.push(mkNum(parseFloat(estado.entrada), estado.entrada));
      estado.tokens.push(mkOp("*"));
    }

    // La constante va directamente como token numérico
    estado.tokens.push(mkNum(c.v, c.d));
    estado.entrada   = formatearNum(c.v);
    estado.esperando = true;
    estado.recienIgual = false;

    actualizarDisplay();
    SONIDOS.digito();
  }

  /** Abre paréntesis */
  function accionParenAbrir() {
    if (estado.hayError) return;

    if (estado.recienIgual) {
      // Resultado seguido de '(' → multiplicación implícita
      const n = parseFloat(estado.entrada);
      estado.tokens        = [mkNum(n, estado.entrada), mkOp("*")];
      estado.recienIgual   = false;
      estado.expresionPost = "";
    } else if (!estado.esperando) {
      // Número seguido de '(' → multiplicación implícita
      estado.tokens.push(mkNum(parseFloat(estado.entrada), estado.entrada));
      estado.tokens.push(mkOp("*"));
    }

    estado.tokens.push(mkLP());
    estado.parenProf++;
    estado.entrada   = "0";
    estado.esperando = true;

    actualizarDisplay();
  }

  /** Cierra paréntesis */
  function accionParenCerrar() {
    if (estado.hayError) return;
    if (estado.parenProf <= 0) return; // nada que cerrar

    // Evita paréntesis vacíos: '('  + ')' inmediato
    const ultimo = estado.tokens[estado.tokens.length - 1];
    if (ultimo && ultimo.t === TT.LP) return;

    if (!estado.esperando) {
      estado.tokens.push(mkNum(parseFloat(estado.entrada), estado.entrada));
    }

    estado.tokens.push(mkRP());
    estado.parenProf--;
    estado.entrada   = estado.entrada === "0" ? "0" : estado.entrada;
    estado.esperando = true;

    actualizarDisplay();
  }

  /**
   * Aplica una función científica.
   * - MODO INMEDIATO: si no hay tokens y no se esperaba (tokens vacíos, número visible).
   * - MODO EXPRESIÓN: en cualquier otro caso, añade fn( a los tokens.
   */
  function accionFuncion(nombre) {
    if (estado.hayError) return;

    const info = FUNCIONES[nombre];
    if (!info) return;

    // MODO INMEDIATO
    if (!estado.tokens.length && !estado.esperando && !estado.recienIgual) {
      const val = parseFloat(estado.entrada);
      try {
        const resultado = info.fn(val);
        if (!isFinite(resultado)) throw new Error("Resultado fuera de rango.");
        const fmt = formatearNum(resultado);
        const etq = nombre === "factorial"
          ? `${estado.entrada}!`
          : `${info.etq}(${estado.entrada})`;

        agregarAlHistorial(etq, resultado);
        renderizarHistorial(historial[0]?.id);

        estado.expresionPost = `${etq} =`;
        estado.entrada       = fmt;
        estado.recienIgual   = true;
        estado.ultimoRes     = resultado;

        actualizarDisplay({ animar: true });
        anunciarSR(`Resultado: ${fmt}`);
        SONIDOS.igual();
      } catch (e) {
        mostrarError(e.message);
      }
      return;
    }

    // MODO EXPRESIÓN: añade función a los tokens
    if (estado.recienIgual) {
      const n = parseFloat(estado.entrada);
      estado.tokens        = [mkNum(n, estado.entrada), mkOp("*")];
      estado.recienIgual   = false;
      estado.expresionPost = "";
    } else if (!estado.esperando) {
      estado.tokens.push(mkNum(parseFloat(estado.entrada), estado.entrada));
      estado.tokens.push(mkOp("*")); // multiplicación implícita
    }

    estado.tokens.push(mkFn(nombre));
    estado.tokens.push(mkLP());
    estado.parenProf++;
    estado.entrada   = "0";
    estado.esperando = true;

    actualizarDisplay();
  }

  /** Inserta el último resultado (ANS) */
  function accionANS() {
    if (estado.ultimoRes === null) {
      toast("Aún no hay resultado previo.", "info");
      return;
    }

    const fmt = formatearNum(estado.ultimoRes);

    if (estado.hayError) resetear();

    if (estado.esperando) {
      estado.entrada   = fmt;
      estado.esperando = false;
    } else {
      estado.entrada = fmt;
    }

    estado.recienIgual   = false;
    estado.expresionPost = "";

    actualizarDisplay();
    SONIDOS.digito();
  }

  /** Evalúa la expresión completa */
  function accionIgual() {
    if (estado.hayError) return;

    // Construye lista completa de tokens
    const todos = [...estado.tokens];

    if (!estado.esperando) {
      const n = parseFloat(estado.entrada);
      if (!isNaN(n)) todos.push(mkNum(n, estado.entrada));
    } else if (todos.length) {
      // Quita operador colgante (ej. "2 +  =")
      const ult = todos[todos.length - 1];
      if (ult.t === TT.OP) todos.pop();
    }

    // Auto-cierra paréntesis sin cerrar
    const aperturasExtra = todos.filter(t => t.t === TT.LP).length
                        - todos.filter(t => t.t === TT.RP).length;
    for (let i = 0; i < aperturasExtra; i++) todos.push(mkRP());

    if (!todos.length) return;

    // Caso trivial: solo un número
    if (todos.length === 1 && todos[0].t === TT.NUM) {
      const val = todos[0].v;
      const fmt = formatearNum(val);
      estado.expresionPost = `${todos[0].d} =`;
      estado.entrada       = fmt;
      estado.tokens        = [];
      estado.esperando     = true;
      estado.recienIgual   = true;
      estado.ultimoRes     = val;
      estado.parenProf     = 0;
      actualizarDisplay({ animar: true });
      SONIDOS.igual();
      return;
    }

    // Texto de la expresión (antes de evaluar)
    const exprTexto = todos.map(tokTexto).join("");

    try {
      const resultado = evaluarTokens(todos);

      if (isNaN(resultado))      throw new Error("Resultado no es un número.");
      if (!isFinite(resultado))  throw new Error("Resultado fuera de rango.");

      const fmt = formatearNum(resultado);

      agregarAlHistorial(exprTexto, resultado);
      renderizarHistorial(historial[0]?.id);

      try { sessionStorage.setItem(SS_ULTIMO_RES, fmt); } catch (_) {}

      estado.expresionPost = `${exprTexto} =`;
      estado.entrada       = fmt;
      estado.tokens        = [];
      estado.esperando     = true;
      estado.parenProf     = 0;
      estado.recienIgual   = true;
      estado.ultimoRes     = resultado;

      actualizarDisplay({ animar: true });
      anunciarSR(`Resultado: ${fmt}`);
      SONIDOS.igual();
    } catch (e) {
      mostrarError(e.message);
    }
  }

  /* ── Memoria ── */

  function accionMemoriaPlus() {
    if (estado.hayError) return;
    const val = parseFloat(estado.entrada);
    if (isNaN(val)) return;
    estado.memoria    += val;
    estado.hayMemoria  = true;
    actualizarDisplay();
    SONIDOS.memoria();
    toast(`Memoria: ${formatearNum(estado.memoria)}`, "mem");
  }

  function accionMemoriaMenos() {
    if (estado.hayError) return;
    const val = parseFloat(estado.entrada);
    if (isNaN(val)) return;
    estado.memoria   -= val;
    estado.hayMemoria = estado.memoria !== 0;
    actualizarDisplay();
    SONIDOS.memoria();
    toast(`Memoria: ${formatearNum(estado.memoria)}`, "mem");
  }

  function accionMemoriaRecall() {
    if (!estado.hayMemoria) { toast("Memoria vacía.", "info"); return; }
    const fmt = formatearNum(estado.memoria);

    if (estado.hayError) resetear();
    if (estado.esperando) {
      estado.entrada   = fmt;
      estado.esperando = false;
    } else {
      estado.entrada = fmt;
    }

    estado.recienIgual   = false;
    estado.expresionPost = "";
    actualizarDisplay();
    SONIDOS.memoria();
  }

  function accionMemoriaLimpiar() {
    estado.memoria    = 0;
    estado.hayMemoria = false;
    actualizarDisplay();
    SONIDOS.memoria();
    toast("Memoria borrada.", "mem");
  }

  /* ── Copiar resultado ── */

  function accionCopiar() {
    if (copiarBtn.hidden) return;

    if (!navigator.clipboard) {
      toast("Portapapeles no disponible.", "error");
      return;
    }

    navigator.clipboard.writeText(String(estado.entrada)).then(() => {
      toast("¡Copiado!", "exito");
      SONIDOS.copiar();
    }).catch(() => {
      toast("No se pudo copiar.", "error");
    });
  }

  /* ── §10  TEMA Y MODO ───────────────────────────────────────── */

  function aplicarTema(tema) {
    document.documentElement.dataset.theme = tema;
    const esOscuro = tema === "dark";
    temaIcono.textContent = esOscuro ? "☀️" : "🌙";
    temaBtn.setAttribute("aria-label", esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    try { localStorage.setItem(LS_TEMA, tema); } catch (_) {}
  }

  function toggleTema() {
    aplicarTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  }

  function cambiarModo(modo) {
    modoBtns.forEach((b) => {
      const activo = b.dataset.modo === modo;
      b.classList.toggle("activo", activo);
      b.setAttribute("aria-pressed", String(activo));
    });

    tecladoCient.hidden = modo !== "cientifica";
    try { localStorage.setItem(LS_MODO, modo); } catch (_) {}
  }

  /* ── §11  SISTEMA DE EVENTOS ─────────────────────────────────── */

  /**
   * Delegación de eventos única sobre el .card.
   * Busca el botón más cercano con [data-accion] o dentro de la delegación.
   */
  function manejarClickCard(e) {
    const btn = e.target.closest(".teclado button[data-accion]");
    if (!btn) return;

    animarBtn(btn);

    const { accion, valor, fn } = btn.dataset;

    switch (accion) {
      case "digito":      accionDigito(valor); break;
      case "decimal":     accionDecimal(); break;
      case "operador":    accionOperador(valor); break;
      case "igual":       accionIgual(); break;
      case "limpiar":     accionLimpiar(); break;
      case "borrar":      accionBorrar(); break;
      case "signo":       accionSigno(); break;
      case "porcentaje":  accionPorcentaje(); break;
      case "paren-a":     accionParenAbrir(); break;
      case "paren-c":     accionParenCerrar(); break;
      case "funcion":     accionFuncion(fn); break;
      case "constante":   accionConstante(valor); break;
      case "ans":         accionANS(); break;
      case "mem-+":       accionMemoriaPlus(); break;
      case "mem--":       accionMemoriaMenos(); break;
      case "mem-r":       accionMemoriaRecall(); break;
      case "mem-c":       accionMemoriaLimpiar(); break;
    }
  }

  /** Delegación para el selector de modo */
  function manejarModo(e) {
    const btn = e.target.closest(".modo-btn");
    if (!btn) return;
    cambiarModo(btn.dataset.modo);
  }

  /** Delegación de historial (click + Enter/Espacio) */
  function manejarHistorial(e) {
    const li = e.target.closest(".historial-item");
    if (!li) return;

    const valor = parseFloat(li.dataset.valor);
    if (isNaN(valor)) return;

    const fmt = formatearNum(valor);
    if (estado.hayError) resetear();
    if (estado.esperando) {
      estado.entrada   = fmt;
      estado.esperando = false;
    } else {
      estado.entrada = fmt;
    }
    estado.recienIgual   = false;
    estado.expresionPost = "";
    actualizarDisplay();
    toast(`${fmt} insertado.`, "info", 1400);
  }

  function manejarHistorialTeclado(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      manejarHistorial(e);
    }
  }

  /* ── §12  ATAJOS DE TECLADO ─────────────────────────────────── */

  const MAPA_TECLADO = {
    "0": () => accionDigito("0"),
    "1": () => accionDigito("1"),
    "2": () => accionDigito("2"),
    "3": () => accionDigito("3"),
    "4": () => accionDigito("4"),
    "5": () => accionDigito("5"),
    "6": () => accionDigito("6"),
    "7": () => accionDigito("7"),
    "8": () => accionDigito("8"),
    "9": () => accionDigito("9"),
    ".": () => accionDecimal(),
    ",": () => accionDecimal(),
    "+": () => accionOperador("+"),
    "-": () => accionOperador("-"),
    "*": () => accionOperador("*"),
    "x": () => accionOperador("*"),
    "/": () => accionOperador("/"),
    "^": () => accionOperador("^"),
    "%": () => accionPorcentaje(),
    "Enter":     () => accionIgual(),
    "=":         () => accionIgual(),
    "Backspace": () => accionBorrar(),
    "Delete":    () => accionLimpiar(),
    "Escape":    () => accionLimpiar(),
    "(":         () => accionParenAbrir(),
    ")":         () => accionParenCerrar(),
  };

  function manejarTeclado(e) {
    // No interferir con atajos del navegador o en campos de texto
    if (e.target.tagName === "INPUT"   ||
        e.target.tagName === "TEXTAREA"||
        e.ctrlKey || e.altKey || e.metaKey) return;

    const accion = MAPA_TECLADO[e.key];
    if (accion) {
      e.preventDefault();
      accion();

      // Destella el botón correspondiente en el DOM
      const match = document.querySelector(
        `[data-accion="digito"][data-valor="${e.key}"],` +
        `[data-accion="operador"][data-valor="${e.key === "/" ? "/" : e.key === "*" ? "*" : e.key}"]`
      );
      if (match) animarBtn(match);
    }
  }

  /* ── §13  MODAL ─────────────────────────────────────────────── */

  let focusAnteriorModal = null;

  function abrirModal() {
    focusAnteriorModal = document.activeElement;
    modalOverlay.hidden = false;

    requestAnimationFrame(() => {
      modalOverlay.classList.add("visible");
      modalCerrar.focus();
    });

    modalOverlay.addEventListener("keydown", trampaFoco);
  }

  function cerrarModal() {
    modalOverlay.classList.remove("visible");
    modalOverlay.removeEventListener("keydown", trampaFoco);

    modalOverlay.addEventListener("transitionend", () => {
      modalOverlay.hidden = true;
      focusAnteriorModal?.focus();
    }, { once: true });
  }

  function trampaFoco(e) {
    if (e.key !== "Tab") return;

    const focusables = [...modalOverlay.querySelectorAll(
      "button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])"
    )].filter(el => !el.hasAttribute("disabled") && el.offsetParent !== null);

    if (!focusables.length) return;

    const primero = focusables[0];
    const ultimo  = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
      return;
    }

    if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  /* ── §14  INICIALIZACIÓN ────────────────────────────────────── */

  function init() {
    /* — Pantalla de carga — */
    window.addEventListener("load", () => {
      const overlay = $("cargaOverlay");
      setTimeout(() => {
        overlay.classList.add("saliendo");
        overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
      }, 650);
    });

    /* — Tema — */
    const temaGuardado = (() => {
      try { return localStorage.getItem(LS_TEMA); } catch { return null; }
    })();
    const temaInicial = temaGuardado
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    aplicarTema(temaInicial);

    /* — Modo (básica / científica) — */
    const modoGuardado = (() => {
      try { return localStorage.getItem(LS_MODO); } catch { return null; }
    })();
    cambiarModo(modoGuardado === "cientifica" ? "cientifica" : "basica");

    /* — Sonido — */
    const sonidoGuardado = (() => {
      try { return localStorage.getItem(LS_SONIDO); } catch { return null; }
    })();
    sonidoActivo = sonidoGuardado === "true";
    actualizarBtnSonido();

    /* — Historial — */
    cargarHistorial();
    renderizarHistorial();

    /* — Último resultado de sesión — */
    try {
      const prev = sessionStorage.getItem(SS_ULTIMO_RES);
      if (prev) estado.ultimoRes = parseFloat(prev);
    } catch (_) {}

    /* — Display inicial — */
    actualizarDisplay();

    /* — Eventos centralizados — */
    $("appCard").addEventListener("click", manejarClickCard);
    document.querySelector(".modo-selector").addEventListener("click", manejarModo);

    histListaEl.addEventListener("click",   manejarHistorial);
    histListaEl.addEventListener("keydown", manejarHistorialTeclado);

    limpHistBtn.addEventListener("click", () => {
      historial = [];
      guardarHistorial();
      renderizarHistorial();
    });

    copiarBtn.addEventListener("click", accionCopiar);

    temaBtn.addEventListener("click", toggleTema);

    sonidoBtn.addEventListener("click", () => {
      // Primer clic: desbloquea el AudioContext
      if (!audioCtx && !sonidoActivo) {
        try { getAudioCtx(); } catch (_) {}
      }
      sonidoActivo = !sonidoActivo;
      actualizarBtnSonido();
      try { localStorage.setItem(LS_SONIDO, String(sonidoActivo)); } catch (_) {}
      if (sonidoActivo) tono(880, 0.05, "sine", 0.04);
    });

    sobreBtn.addEventListener("click", abrirModal);
    modalCerrar.addEventListener("click", cerrarModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) cerrarModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modalOverlay.hidden) { cerrarModal(); return; }
      manejarTeclado(e);
    });
  }

  function actualizarBtnSonido() {
    sonidoBtn.querySelector("span").textContent = sonidoActivo ? "🔊" : "🔇";
    sonidoBtn.setAttribute("aria-label",  sonidoActivo ? "Desactivar sonido" : "Activar sonido");
    sonidoBtn.setAttribute("aria-pressed", String(sonidoActivo));
  }

  /* ── Arranque ─────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", init);