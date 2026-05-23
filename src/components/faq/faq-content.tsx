"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

const FaqAccordionContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

const FaqSectionContext = createContext<string>("");

const sections = [
  { id: "overview", label: "Overview" },
  { id: "buying", label: "Buying tickets" },
  { id: "jackpots", label: "Jackpots" },
  { id: "spl-pool", label: "SPL pool" },
  { id: "draw", label: "Draw & winner" },
  { id: "account", label: "Your account" },
  { id: "projects", label: "Projects" },
  { id: "fees", label: "Fees" },
  { id: "founders", label: "For founders" },
  { id: "trust", label: "Trust" },
  { id: "support", label: "Support" },
] as const;

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  const accordion = useContext(FaqAccordionContext);
  const sectionId = useContext(FaqSectionContext);
  const itemId = useId();
  const id = `${sectionId}${itemId}`;
  const open = accordion?.openId === id;

  return (
    <div
      className={`rounded-xl border border-border bg-bg-elevated/70 ${
        open ? "ring-1 ring-accent-purple/20" : ""
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => accordion?.setOpenId(open ? null : id)}
        className="flex w-full cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-foreground transition hover:text-accent-cyan"
      >
        <span>{question}</span>
        <span
          className={`mt-0.5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border px-4 pb-4 pt-3 text-sm leading-relaxed text-muted">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function FaqSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <FaqSectionContext.Provider value={`${id}:`}>
      <section id={id} className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        <div className="space-y-2">{children}</div>
      </section>
    </FaqSectionContext.Provider>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center py-1 text-accent-gold/70" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path
          d="M12 4l-1.4 1.4 4.6 4.6H4v2h11.2l-4.6 4.6L12 20l8-8-8-8z"
          transform="rotate(90 12 12)"
        />
      </svg>
    </div>
  );
}

function StepCard({
  icon,
  title,
  children,
  accent = "gold",
}: {
  icon: string;
  title: string;
  children: ReactNode;
  accent?: "gold" | "purple" | "cyan";
}) {
  const ring =
    accent === "purple"
      ? "ring-accent-purple/30 bg-accent-purple/10"
      : accent === "cyan"
        ? "ring-accent-cyan/30 bg-accent-cyan/10"
        : "ring-accent-gold/30 bg-accent-gold/10";
  return (
    <div className={`rounded-xl border border-border p-4 ring-1 ${ring}`}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-lg"
          aria-hidden
        >
          {icon}
        </span>
        <div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SolVsSplDiagram() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/5 p-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            ◎
          </span>
          <h3 className="font-semibold text-foreground">SOL ticket</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-accent-gold" aria-hidden>
              →
            </span>
            <span>
              <strong className="text-foreground">Live jackpot increases</strong> in real
              time
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent-gold" aria-hidden>
              →
            </span>
            <span>Win this month&apos;s SOL prize</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent-gold" aria-hidden>
              →
            </span>
            <span>90% of ticket price goes to the prize pot</span>
          </li>
        </ul>
      </div>
      <div className="rounded-xl border border-accent-purple/30 bg-accent-purple/5 p-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🪙
          </span>
          <h3 className="font-semibold text-foreground">SPL ticket</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-accent-purple" aria-hidden>
              →
            </span>
            <span>
              <strong className="text-foreground">Same entry odds</strong> as SOL
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent-purple" aria-hidden>
              →
            </span>
            <span>Tokens go to the SPL pool wallet</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent-purple" aria-hidden>
              →
            </span>
            <span>Seeds next month&apos;s jackpot — not this month&apos;s live pot</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function SplPoolFlow() {
  return (
    <div className="rounded-2xl border border-border bg-bg-elevated/70 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">
        What happens to SPL ticket payments?
      </h3>
      <p className="mt-1 text-sm text-muted">
        SPL buys don&apos;t add to this month&apos;s live SOL jackpot — they fuel next
        month&apos;s seed instead.
      </p>
      <div className="mt-5 space-y-2">
        <StepCard icon="🎟️" title="During this draw" accent="purple">
          <p>
            Every SPL ticket purchased commits{" "}
            <strong className="text-foreground">100%</strong> of those tokens to our SPL
            pool wallet. They accumulate until sales close.
          </p>
        </StepCard>
        <FlowArrow />
        <StepCard icon="🔄" title="After the draw ends" accent="gold">
          <p>
            All pooled project tokens are converted to SOL. That SOL becomes the{" "}
            <strong className="text-foreground">seed jackpot</strong> for the next
            month&apos;s draw — not the current live pot.
          </p>
        </StepCard>
        <FlowArrow />
        <div className="rounded-xl border border-border bg-surface/40 p-4">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">
            Two ways we convert to SOL
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3 text-center">
              <span className="text-2xl" aria-hidden>
                🤝
              </span>
              <p className="mt-2 text-sm font-semibold text-foreground">Founder buyback</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Projects are offered a buyback at{" "}
                <strong className="text-accent-cyan">90% of market value</strong>.
              </p>
            </div>
            <div className="rounded-lg border border-accent-purple/30 bg-accent-purple/5 p-3 text-center">
              <span className="text-2xl" aria-hidden>
                📈
              </span>
              <p className="mt-2 text-sm font-semibold text-foreground">Open market</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                If a project declines buyback, tokens are sold on the open market at
                prevailing prices.
              </p>
            </div>
          </div>
        </div>
        <FlowArrow />
        <StepCard icon="🌱" title="Next month's draw" accent="cyan">
          <p>
            Converted SOL seeds the new prize pool so every SPL community contributes to
            growing the next jackpot — while SOL tickets grow{" "}
            <strong className="text-foreground">this month&apos;s</strong> live pot in
            real time.
          </p>
        </StepCard>
      </div>
    </div>
  );
}

export function FaqContent() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <FaqAccordionContext.Provider value={{ openId, setOpenId }}>
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Everything you need to know about Slotto, our monthly on-chain lotto, and how
          SOL and SPL tickets work.
        </p>
      </header>

      <nav
        aria-label="FAQ sections"
        className="flex flex-wrap gap-2 rounded-2xl border border-border bg-bg-elevated/50 p-3"
      >
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent-purple/40 hover:text-accent-cyan sm:text-sm"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <FaqSection id="overview" title="Overview">
        <FaqItem question="What is Slotto?">
          <p>
            Slotto is a comprehensive listing site focusing on trusted and transparent
            Solana based NFT and token projects. We host a fully on-chain monthly lotto
            game on Solana. You can buy tickets with SOL or featured project tokens. One
            winner takes the SOL jackpot each draw.
          </p>
        </FaqItem>
        <FaqItem question="How often does the draw run?">
          <p>
            Monthly. Each draw has a fixed sales window shown on the homepage countdown
            — from sales open through sales close, then the winner is drawn shortly after
            close.
          </p>
        </FaqItem>
        <FaqItem question="Is it really on-chain?">
          <p>
            Yes. Ticket purchases, ticket ownership, and the SOL prize payout are handled
            by a Solana program. You can verify every transaction on Solscan.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="buying" title="Buying tickets">
        <FaqItem question="How do I buy tickets?">
          <p>
            Connect a Solana wallet on the{" "}
            <Link href="/" className="font-medium text-accent-cyan hover:underline">
              homepage
            </Link>
            , choose SOL or a featured token, pick how many tickets, and confirm in your
            wallet.
          </p>
        </FaqItem>
        <FaqItem question="How much does a SOL ticket cost?">
          <p>
            <strong className="text-foreground">0.01 SOL per ticket</strong> (+ 0.0005 SOL
            platform fee). 90% of the ticket price goes to the prize pot.
          </p>
        </FaqItem>
        <FaqItem question="Do SOL tickets increase the live jackpot?">
          <p>Yes. Only SOL ticket sales increase the current month&apos;s live jackpot.</p>
        </FaqItem>
        <FaqItem question="Can I buy multiple tickets at once?">
          <p>
            Yes. Each ticket gets a sequential ticket ID. More tickets means more entries
            — every ticket has the same odds.
          </p>
        </FaqItem>
        <FaqItem question="What payment tokens are supported besides SOL?">
          <p>
            Featured project SPL tokens listed for the current draw. Availability,
            remaining supply, and price are shown in the Pay with dropdown on the
            homepage.
          </p>
        </FaqItem>
        <FaqItem question="Do SPL tickets count the same as SOL tickets?">
          <p>
            Yes — one ticket equals one entry, with the same win probability. SPL and SOL
            tickets share the same draw.
          </p>
        </FaqItem>
        <FaqItem question="Why do SPL tickets show a remaining cap?">
          <p>
            Each featured token has a limited number of SPL tickets per draw. Once sold
            out for that token, you can still buy with SOL or other listed tokens.
          </p>
        </FaqItem>
        <FaqItem question="Is there a discount for SPL tickets?">
          <p>
            SPL purchases receive a 5% discount and are dynamically priced at time of
            purchase.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="jackpots" title="Jackpots">
        <div className="mb-4">
          <SolVsSplDiagram />
        </div>
        <FaqItem question="What is the live jackpot?">
          <p>
            The SOL prize pool for this month&apos;s draw: seed SOL at draw start plus SOL
            ticket sales during the draw.
          </p>
        </FaqItem>
        <FaqItem question="Do SPL purchases add to the live jackpot?">
          <p>No. SPL payments do not increase this month&apos;s live SOL pot.</p>
        </FaqItem>
        <FaqItem question="What happens to SPL tokens I pay with?">
          <p>
            They are pooled in our SPL pool wallet during the draw, then converted to SOL
            after the draw ends to seed next month&apos;s jackpot. See the{" "}
            <a href="#spl-pool" className="font-medium text-accent-cyan hover:underline">
              SPL pool
            </a>{" "}
            section below for the full flow.
          </p>
        </FaqItem>
      </FaqSection>

      <section id="spl-pool" className="scroll-mt-24">
        <SplPoolFlow />
      </section>

      <FaqSection id="draw" title="Draw schedule & winner">
        <FaqItem question="When does ticket sales open and close?">
          <p>
            Shown on the homepage countdown. Purchases only work between sales open and
            sales close times.
          </p>
        </FaqItem>
        <FaqItem question="When is the winner picked?">
          <p>
            Shortly after sales close. The draw moves through sales close, randomness
            request, settle, and the winner is paid in SOL automatically.
          </p>
        </FaqItem>
        <FaqItem question="How is the winner chosen?">
          <p>
            One winning ticket is selected at random from all ticket IDs. Every ticket has
            an equal chance.
          </p>
        </FaqItem>
        <FaqItem question="How is the prize paid?">
          <p>
            The full SOL jackpot is sent to the winner&apos;s wallet in the settle
            transaction — no separate claim step required.
          </p>
        </FaqItem>
        <FaqItem question="Where can I see past winners?">
          <p>
            On the homepage draws section and on your{" "}
            <Link href="/profile" className="font-medium text-accent-cyan hover:underline">
              profile
            </Link>{" "}
            if you have linked wallets.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="account" title="Your account & tickets">
        <FaqItem question="Do I need to connect a wallet?">
          <p>Yes, to buy tickets. To view tickets across draws, link wallets on your profile.</p>
        </FaqItem>
        <FaqItem question="Where can I see my tickets?">
          <p>
            <Link href="/profile" className="font-medium text-accent-cyan hover:underline">
              Profile
            </Link>{" "}
            → My tickets — shows ticket IDs and which draw they belong to.
          </p>
        </FaqItem>
        <FaqItem question="Can I use multiple wallets?">
          <p>
            Yes. Link them on your profile to see tickets from all linked wallets in one
            place.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="projects" title="Projects directory">
        <FaqItem question="What is the Projects page?">
          <p>
            A curated directory of Solana projects Slotto supports — collections, token
            info, and links to marketplaces and socials.{" "}
            <Link href="/projects" className="font-medium text-accent-cyan hover:underline">
              Browse projects
            </Link>
            .
          </p>
        </FaqItem>
        <FaqItem question="How does a project get featured in the lotto?">
          <p>
            Open a ticket in the Slotto Discord support server — use the link on our{" "}
            <Link href="/contact" className="font-medium text-accent-cyan hover:underline">
              Contact
            </Link>{" "}
            page. Featured tokens can be added to a draw&apos;s SPL ticket list by the
            Slotto team.
          </p>
        </FaqItem>
        <FaqItem question="What does it mean for a project to be in the SPL ticket list?">
          <p>
            Their community can enter the lotto using that token. Tokens paid for tickets
            go through the SPL pool process described above.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="fees" title="Fees & transparency">
        <FaqItem question="What is the platform fee?">
          <p>
            <strong className="text-foreground">0.0005 SOL per ticket</strong>, shown at
            checkout. This covers platform operations.
          </p>
        </FaqItem>
        <FaqItem question="Are there other fees?">
          <p>
            Standard Solana network fees apply to each transaction — small amounts paid to
            validators.
          </p>
        </FaqItem>
        <FaqItem question="Can I verify everything on-chain?">
          <p>
            Yes. Ticket buys, draw state, and prize payouts live on Solana. Solscan links
            are shown after purchases on the homepage.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="founders" title="For project founders">
        <FaqItem question="What is the founder buyback option?">
          <p>
            After a draw, pooled tokens from your project may be offered for buyback at 90%
            of market value before open-market sale.
          </p>
        </FaqItem>
        <FaqItem question="Why would I want my token in the lotto?">
          <p>
            Your community gets a fun way to participate, your token gets visibility on
            Slotto, and pooled tokens can be bought back or sold to seed future jackpots.
          </p>
        </FaqItem>
        <FaqItem question="How do I apply to list?">
          <p>
            Join the Slotto Discord support server via our{" "}
            <Link href="/contact" className="font-medium text-accent-cyan hover:underline">
              Contact
            </Link>{" "}
            page and open a ticket for listing applications or Jackpot Sunday guest spots.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="trust" title="Trust & edge cases">
        <FaqItem question="What if no tickets are sold?">
          <p>
            The draw can be refunded — seed SOL returns to the configured refund wallet.
            No winner is drawn.
          </p>
        </FaqItem>
        <FaqItem question="What if sales close but the draw hasn't settled yet?">
          <p>
            Settlement is permissionless — anyone can trigger it after close. The UI may
            show a settling state briefly while the draw completes on-chain.
          </p>
        </FaqItem>
        <FaqItem question="Is the lottery provably fair?">
          <p>
            Winner selection uses verifiable on-chain randomness. Every ticket has an
            equal, transparent chance to win.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection id="support" title="Support">
        <FaqItem question="Where do I get help or report an issue?">
          <p>
            Join the Slotto Discord support server via our{" "}
            <Link href="/contact" className="font-medium text-accent-cyan hover:underline">
              Contact
            </Link>{" "}
            page and open a support ticket. You can also follow Slotto on X for draw
            updates and our weekly Jackpot Sunday Space (Sundays @ 2pm EST).
          </p>
        </FaqItem>
      </FaqSection>
    </div>
    </FaqAccordionContext.Provider>
  );
}
