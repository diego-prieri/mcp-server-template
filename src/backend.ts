/**
 * The backend the tools talk to. Tools depend on this interface only, so the
 * example in-memory store can be swapped for a real API client without
 * touching tool code — and tests never need network access.
 */
export type TicketStatus = 'open' | 'in_progress' | 'done';

export interface Ticket {
  id: string;
  title: string;
  status: TicketStatus;
  description?: string;
  createdAt: string;
}

export interface TicketFilter {
  status?: TicketStatus;
  query?: string;
  limit: number;
}

export interface NewTicket {
  title: string;
  description?: string;
}

export interface Backend {
  listTickets(filter: TicketFilter): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(input: NewTicket): Promise<Ticket>;
}

export class NotFoundError extends Error {}

export class InMemoryBackend implements Backend {
  private tickets: Ticket[];
  private nextId: number;

  constructor(seed: Ticket[] = []) {
    this.tickets = [...seed];
    this.nextId = seed.length + 1;
  }

  async listTickets({ status, query, limit }: TicketFilter): Promise<Ticket[]> {
    const q = query?.toLowerCase();
    return this.tickets
      .filter((t) => !status || t.status === status)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, limit);
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    return this.tickets.find((t) => t.id === id);
  }

  async createTicket({ title, description }: NewTicket): Promise<Ticket> {
    const ticket: Ticket = { id: `T-${this.nextId++}`, title, description, status: 'open', createdAt: new Date().toISOString() };
    this.tickets.push(ticket);
    return ticket;
  }
}

/** Example adapter for a REST API. Configure with API_BASE_URL and API_TOKEN. */
export class HttpBackend implements Backend {
  constructor(private baseUrl: string, private token?: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: { 'content-type': 'application/json', ...(this.token && { authorization: `Bearer ${this.token}` }) },
    });
    if (res.status === 404) throw new NotFoundError(path);
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }

  listTickets({ status, query, limit }: TicketFilter): Promise<Ticket[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    if (query) params.set('q', query);
    return this.request(`/tickets?${params}`);
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    try {
      return await this.request(`/tickets/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof NotFoundError) return undefined;
      throw e;
    }
  }

  createTicket(input: NewTicket): Promise<Ticket> {
    return this.request('/tickets', { method: 'POST', body: JSON.stringify(input) });
  }
}
