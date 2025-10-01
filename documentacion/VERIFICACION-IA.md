# 🔍 Verificación de Algoritmos de IA - Gomoku

## 📋 Cómo Verificar que los Algoritmos Están Funcionando

Este documento te ayuda a verificar que **todos los algoritmos de optimización** (Fase 1 + Fase 2) están realmente funcionando durante el juego.

---

## ✅ Qué Debes Ver en los Logs

### **Configuración Actual:**
```typescript
maxDepth: 18                   // Busca hasta 18 niveles de profundidad
maxTimePerMove: 10000ms        // Hasta 10 segundos por movimiento
defensiveness: 2.5             // Alta defensa (bloqueará amenazas)
aggressiveness: 0.9            // Balanceado (no sobre-agresivo)
```

### **Logs Detallados que Verás:**

#### **1. Inicio de Búsqueda:**
```
🧠 AI starting deep search (max depth: 18, max time: 10000ms)...
```
**✅ Esto confirma:** IA está configurada para pensar profundo (18 niveles, 10 segundos)

---

#### **2. Búsqueda por Profundidad:**
```
🔍 Searching depth 1... (23ms elapsed so far)
✅ Depth 1 complete: move (7,7), score 100, time 45ms, nodes 156
🔍 Searching depth 2... (68ms elapsed so far)
✅ Depth 2 complete: move (7,8), score 520, time 143ms, nodes 892
🔍 Searching depth 3... (211ms elapsed so far)
✅ Depth 3 complete: move (7,8), score 5200, time 456ms, nodes 3421
...
🔍 Searching depth 12... (6234ms elapsed so far)
✅ Depth 12 complete: move (8,9), score 52000, time 1234ms, nodes 45231
```

**✅ Esto confirma:**
- IA está pensando más profundo cada iteración
- Está explorando miles de nodos (posiciones)
- Cada nivel toma más tiempo (correcto)

---

#### **3. Decisión Final con Estadísticas:**
```
================================================================================
🤖 AI FINAL DECISION: (8, 9)
   Score: 52000, Depth reached: 12, Time: 7456ms
================================================================================
📊 PHASE 1 OPTIMIZATIONS:
   • Nodes searched: 45231
   • Cache hits: 34128 (75.5% hit rate)
   • Killer move hits: 892 ✅
   • Null-move cutoffs: 234 ✅
📊 PHASE 2 OPTIMIZATIONS:
   • LMR reductions: 1245 ✅
   • Aspiration hits: 8 ✅
   • Threat extensions: 45 ✅
================================================================================
```

**✅ Esto confirma que TODO está funcionando si ves:**

| Optimización | Qué Buscar | ¿Qué Significa? |
|--------------|------------|-----------------|
| **Nodes searched** | > 10,000 | IA está pensando profundamente |
| **Cache hits** | > 60% | Transposition table funcionando |
| **Killer move hits** | ✅ (> 0) | Killer moves están podando bien |
| **Null-move cutoffs** | ✅ (> 0) | Null-move pruning funcionando |
| **LMR reductions** | ✅ (> 0) | Late Move Reduction activo |
| **Aspiration hits** | ✅ (> 0 después depth 4) | Aspiration windows activas |
| **Threat extensions** | ✅ (> 0) | Extiende búsqueda en amenazas |

---

## ⚠️ Señales de Problemas

### **❌ Problema 1: Algoritmos NO están corriendo**

**Síntomas:**
```
📊 PHASE 1 OPTIMIZATIONS:
   • Killer move hits: 0 ⚠️
   • Null-move cutoffs: 0 ⚠️
📊 PHASE 2 OPTIMIZATIONS:
   • LMR reductions: 0 ⚠️
   • Aspiration hits: 0 ⚠️
   • Threat extensions: 0 ⚠️
```

**Posibles causas:**
1. Profundidad muy baja (depth < 5)
2. Opening book respondiendo antes de búsqueda profunda
3. Movimientos inmediatos (ganar/bloquear obvio)

**Solución:**
- Esto es **normal en primeros ~10 movimientos** (opening book)
- Después del movimiento 10, **DEBES ver números > 0**
- Si no, hay un bug en la configuración

---

### **❌ Problema 2: IA muy rápida (<500ms por movimiento)**

**Síntomas:**
```
Time: 145ms
Depth reached: 3
Nodes searched: 245
```

**Causa probable:**
- Opening book está respondiendo (normal movimientos 1-8)
- Movimiento obvio detectado (ganar/bloquear)

**Cuándo preocuparse:**
- Si **después del movimiento 10** sigue siendo rápido
- Si depth reached < 8 constantemente

**Solución:**
- Aumentar `maxDepth` a 20
- Aumentar `maxTimePerMove` a 15000ms

---

### **❌ Problema 3: IA no bloquea amenazas**

**Síntomas:**
- Jugador hace tres en línea, IA no bloquea
- IA juega "en su mundo"

**Causa:**
- `defensiveness` muy bajo
- Pattern values incorrectos

**Verifica que tengas:**
```typescript
defensiveness: 2.5              // MÍNIMO 2.0
aggressiveness: 0.9             // MÁXIMO 1.0
FIVE_IN_ROW: 10000000          // NO 100M+
OPEN_FOUR: 1000000             // NO 50M+
```

---

## 🧪 Test Manual para Verificar IA

### **Test 1: Opening Book (Movimientos 1-3)**

**Pasos:**
1. Inicia partida nueva
2. Observa primeros 3 movimientos de IA

**Esperado:**
```
📚 AI using opening book move in 12ms: (7, 7)
```
✅ **CORRECTO**: IA usa opening book, muy rápido (<50ms)

---

### **Test 2: Búsqueda Profunda (Movimientos 10+)**

**Pasos:**
1. Juega hasta movimiento 10
2. Observa logs de IA

**Esperado:**
```
🧠 AI starting deep search (max depth: 18, max time: 10000ms)...
🔍 Searching depth 1... (23ms elapsed so far)
✅ Depth 1 complete: move (7,7), score 100, time 45ms, nodes 156
🔍 Searching depth 2... (68ms elapsed so far)
...
✅ Depth 12 complete: move (8,9), score 52000, time 1234ms, nodes 45231

📊 PHASE 1 OPTIMIZATIONS:
   • Killer move hits: 892 ✅
   • Null-move cutoffs: 234 ✅
📊 PHASE 2 OPTIMIZATIONS:
   • LMR reductions: 1245 ✅
   • Aspiration hits: 8 ✅
   • Threat extensions: 45 ✅
```

✅ **CORRECTO**:
- Todos los números > 0
- Depth reached > 10
- Time > 2000ms
- Nodes > 10000

---

### **Test 3: Bloqueo de Amenazas**

**Pasos:**
1. Crea tres en línea (XXX)
2. IA debe bloquear inmediatamente

**Esperado:**
```
⚡ AI found immediate move in 45ms: (7, 10)
```
O si usa búsqueda:
```
🤖 AI FINAL DECISION: (7, 10)
   Score: 500000 (cerca de CLOSED_FOUR)
```

✅ **CORRECTO**: IA bloquea en la posición correcta

---

## 📊 Comandos para Debugging

### **Ver logs en tiempo real:**
```bash
cd bun-server
bun src/server.ts | grep "📊"
```

### **Ver solo decisiones finales:**
```bash
bun src/server.ts | grep "🤖 AI FINAL"
```

### **Ver estadísticas de optimizaciones:**
```bash
bun src/server.ts | grep -A 10 "PHASE 1 OPTIMIZATIONS"
```

---

## 🎯 Checklist de Verificación

### **✅ Todo Funciona Correctamente Si:**

- [ ] Movimientos 1-8: Opening book responde rápido (<100ms)
- [ ] Movimientos 10+: Búsqueda profunda activa (>2s, depth >10)
- [ ] Killer move hits > 0 (después movimiento 10)
- [ ] Null-move cutoffs > 0 (después movimiento 10)
- [ ] LMR reductions > 0 (después movimiento 10)
- [ ] Aspiration hits > 0 (después depth 5)
- [ ] Threat extensions > 0 (cuando hay amenazas)
- [ ] Cache hit rate > 60%
- [ ] IA bloquea tres en línea inmediatamente
- [ ] IA crea amenazas propias
- [ ] IA tarda 2-10 segundos en movimientos críticos

### **⚠️ Hay Problemas Si:**

- [ ] TODOS los counters en 0 después movimiento 15
- [ ] Depth reached < 8 constantemente
- [ ] Time < 500ms después movimiento 10
- [ ] IA NO bloquea amenazas obvias
- [ ] Cache hit rate < 30%
- [ ] Nodes searched < 1000

---

## 🚀 Mejoras Adicionales (Opcional)

Si quieres que IA piense **AÚN MÁS**:

```typescript
// En AIService.ts, línea 31-32:
maxDepth: 20,                   // Aumentar de 18 a 20
maxTimePerMove: 15000,          // Aumentar de 10s a 15s
```

**Efectos:**
- ✅ IA pensará 50% más tiempo
- ✅ Profundidad +2 niveles
- ✅ Encontrará tácticas más profundas
- ⚠️ Movimientos tomarán 5-15 segundos

---

## 📝 Resumen

**Para verificar que TODO funciona correctamente:**

1. **Inicia el servidor**: `bun src/server.ts`
2. **Juega una partida** hasta movimiento 15
3. **Observa los logs** - debes ver todos los ✅ verdes
4. **Prueba bloqueo** - crea amenaza, IA debe bloquear
5. **Revisa tiempos** - movimientos críticos deben tomar 2-10s

**Si ves TODOS los ✅ verdes y la IA bloquea correctamente:**
🎉 **¡TODO ESTÁ FUNCIONANDO PERFECTO!**

**Si ves ⚠️ amarillos persistentes:**
⚠️ Hay un problema - revisa configuración en AIService.ts líneas 30-60

---

*Documentación creada: 2024-10-01*
*Versión: 1.0*
