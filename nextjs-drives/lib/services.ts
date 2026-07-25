import { z } from "zod";

const ServiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  name: z.string().min(1).max(80),
  description: z.string().max(240).default(""),
  upstreamUrl: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "upstreamUrl must use http or https",
  }),
  href: z.string().startsWith("/").optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#235789"),
});

const ServicesSchema = z.array(ServiceSchema).max(50);

export type Service = z.infer<typeof ServiceSchema>;
export type PublicService = Omit<Service, "upstreamUrl"> & { proxyPath: string };

const defaultServices: Service[] = [
  {
    id: "teslamate",
    name: "TeslaMate Drives",
    description: "Browse drives, filter by car, and maintain notes and tags.",
    upstreamUrl: process.env.TESLAMATE_API_URL ?? "http://localhost:4000/api",
    href: "/drives",
    accent: "#d1495b",
  },
];

export function getServices(): Service[] {
  const raw = process.env.HOME_SERVER_SERVICES;
  if (!raw) return defaultServices;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("HOME_SERVER_SERVICES must be valid JSON");
  }

  const services = ServicesSchema.parse(parsed);
  const ids = new Set<string>();
  for (const service of services) {
    if (ids.has(service.id)) throw new Error(`Duplicate service id: ${service.id}`);
    ids.add(service.id);
  }

  return services.map((service) => ({
    ...service,
    upstreamUrl: service.upstreamUrl.replace(/\/+$/, ""),
  }));
}

export function getService(id: string): Service | undefined {
  return getServices().find((service) => service.id === id);
}

export function toPublicService(service: Service): PublicService {
  const { upstreamUrl: _upstreamUrl, ...publicFields } = service;
  return { ...publicFields, proxyPath: `/api/proxy/${service.id}` };
}
