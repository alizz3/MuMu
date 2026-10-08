// Notas de 0.0 a 5.0 (escala colombiana). Si las tareas tienen "vale %", se pondera.
export const PASA = 3.0
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v)
export function resumen(tasks) {
  const g = tasks.filter((t) => num(t.grade) != null)
  if (!g.length) return null
  const conPeso = g.filter((t) => num(t.weight) > 0)
  if (conPeso.length) {
    const evaluado = conPeso.reduce((a, t) => a + +t.weight, 0)
    const acumulado = conPeso.reduce((a, t) => a + (+t.grade * +t.weight) / 100, 0)
    const promedio = acumulado / (evaluado / 100)
    const resto = Math.max(0, 100 - evaluado)
    const necesita = resto > 0 ? (PASA - acumulado) / (resto / 100) : null
    return { n: g.length, promedio, acumulado, evaluado, resto, necesita }
  }
  return { n: g.length, promedio: g.reduce((a, t) => a + +t.grade, 0) / g.length }
}
export const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1)
export const tono = (x) => (x >= 4 ? 'green' : x >= PASA ? '' : 'pink')
