import type { PrometheusClient } from "../../domain/ports/prometheus.ts";

const REQUEST_TIMEOUT_MS = 5000;

interface QueryResponse {
  data?: { result?: { value?: unknown[] }[] };
}

interface QueryRangeResponse {
  data?: { result?: { values?: unknown[][] }[] };
}

export function createPrometheusClient(baseUrl: string): PrometheusClient {
  async function fetchJson(url: string): Promise<unknown> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return await response.json();
    } catch {
      return null;
    }
  }

  return {
    async query(promql: string): Promise<number | null> {
      const data = (await fetchJson(
        `${baseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`,
      )) as QueryResponse | null;

      const result = data?.data?.result;
      if (!result?.length) return null;

      const raw = result[0].value?.[1];
      return raw ? Number.parseFloat(raw as string) : null;
    },

    async queryRange(
      promql: string,
      windowSeconds = 300,
      steps = 20,
    ): Promise<number[]> {
      const now = Math.floor(Date.now() / 1000);
      const url =
        `${baseUrl}/api/v1/query_range?query=${encodeURIComponent(promql)}` +
        `&start=${now - windowSeconds}&end=${now}&step=${(windowSeconds / steps).toFixed(0)}`;

      const data = (await fetchJson(url)) as QueryRangeResponse | null;
      const values = data?.data?.result?.[0]?.values;
      if (!values) return [];

      return values.map((sample) => {
        const parsed = Number.parseFloat(sample[1] as string);
        return Number.isNaN(parsed) ? 0 : parsed;
      });
    },
  };
}
