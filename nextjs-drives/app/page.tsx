import Link from "next/link";
import type { CSSProperties } from "react";
import { getServices, toPublicService } from "@/lib/services";

export default async function HomePage() {
  const services = getServices().map(toPublicService);

  return (
    <main className="portalShell">
      <header className="portalHero">
        <p className="eyebrow">Home server</p>
        <h1>Everything, one doorway.</h1>
        <p className="portalIntro">A private launchpad for the services running across the home cluster.</p>
      </header>

      <section className="serviceSection" aria-labelledby="services-heading">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Services</p>
            <h2 id="services-heading">Available now</h2>
          </div>
          <span className="serviceCount">{services.length} online</span>
        </div>

        <div className="serviceGrid">
          {services.map((service, index) => (
            <Link
              className="serviceCard"
              href={service.href ?? service.proxyPath}
              key={service.id}
              style={{ "--service-accent": service.accent, "--card-index": index } as CSSProperties}
            >
              <span className="serviceIcon" aria-hidden="true">{service.name.slice(0, 1).toUpperCase()}</span>
              <span className="serviceText">
                <strong>{service.name}</strong>
                <span>{service.description || "Open service"}</span>
              </span>
              <span className="serviceArrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="portalFooter">
        <span className="statusDot" /> Stateless gateway ready
      </footer>
    </main>
  );
}
