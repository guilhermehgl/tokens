export function demoDay(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // São Paulo utiliza UTC-03 no período atual. Intl determina a data civil;
  // o cálculo dos limites verifica o offset da própria data, sem depender do host.
  const midnight = new Date(`${day}T00:00:00Z`);
  const offsetAt = (date: Date) => Number(new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", timeZoneName: "longOffset" }).formatToParts(date).find(p => p.type === "timeZoneName")!.value.replace("GMT", "").split(":")[0]);
  const start = new Date(midnight.getTime() - offsetAt(midnight) * 3600000);
  const tomorrow = new Date(midnight.getTime() + 86400000);
  const end = new Date(tomorrow.getTime() - offsetAt(tomorrow) * 3600000);
  return { day, start, end };
}

