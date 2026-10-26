// Sem FINORA_ADMIN_API_KEY as chamadas admin falham (401) em vez de usar chave fixa.
const ADMIN_KEY = process.env.FINORA_ADMIN_API_KEY ?? "";

function getServerApiUrls(): string[] {
  const list: string[] = [];
  if (process.env.FINORA_INTERNAL_API_URL) list.push(process.env.FINORA_INTERNAL_API_URL);
  list.push("http://127.0.0.1:3334/api/v1");
  list.push("http://localhost:3334/api/v1");
  if (process.env.NEXT_PUBLIC_API_URL) list.push(process.env.NEXT_PUBLIC_API_URL);
  return list;
}

export async function getEventDashboard(eventId: number) {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/dashboard/event/${eventId}`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.summary) {
          return data;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return {
    event: { id: eventId, name: "Finora Experience - Clinicorp", slug: "finora-experience-clinicorp" },
    summary: {
      uniqueParticipants: 0,
      totalParticipations: 0,
      approved: 0,
      blocked: 0,
      deliveredPrizes: 0,
      totalAvailableStock: 0,
    },
    distribution: [],
    queue: [],
    latestWinners: [],
    latestBlocked: [],
    recentActivity: [],
    nextPrize: null,
  };
}

export async function getEvents() {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/events`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const events = await response.json();
        if (Array.isArray(events) && events.length > 0) {
          return events;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return [{ id: 1, name: "Finora Experience - Clinicorp", slug: "finora-experience-clinicorp", status: "ACTIVE" }];
}

export async function getParticipants(eventId: number) {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/participants/event/${eventId}`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return [];
}

export async function getPrizes(eventId: number) {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/prizes/event/${eventId}`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return [];
}

export async function getFraudRules(eventId: number) {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/fraud-rules/event/${eventId}`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return [];
}

export async function getQueue(eventId: number) {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/prize-queue/event/${eventId}`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return [];
}

export async function getEligibleGrandDraw(eventId: number) {
  const candidateUrls = getServerApiUrls();

  for (const url of candidateUrls) {
    try {
      const response = await fetch(`${url}/draws/event/${eventId}/eligible-grand-draw`, {
        cache: "no-store",
        headers: {
          "x-finora-admin-key": ADMIN_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.participants)) {
          return data.participants;
        }
      }
    } catch {
      // Tenta próxima URL
    }
  }

  return [];
}


export type EventReport = {
  event: { id: number; name: string; status: string };
  funnel: { registered: number; validated: number; spun: number; claimed: number; blocked: number };
  perHour: { hour: string; registrations: number; draws: number }[];
  topPrizes: { name: string; total: number }[];
};

// Relatório pós-evento (funil, por hora). null se a API não responder.
export async function getEventReport(eventId: number): Promise<EventReport | null> {
  for (const url of getServerApiUrls()) {
    try {
      const response = await fetch(`${url}/dashboard/event/${eventId}/report`, {
        cache: "no-store",
        headers: { "x-finora-admin-key": ADMIN_KEY },
      });
      if (response.ok) return response.json();
    } catch {
      // Tenta próxima URL
    }
  }
  return null;
}
