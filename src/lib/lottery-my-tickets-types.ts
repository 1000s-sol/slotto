export type MyTicketRow = {
  drawNumber: number;
  dateLabel: string;
  isLive: boolean;
  yourTickets: number;
  poolTickets: number;
  paidWithMints: string[];
  outcomeLabel: string;
  outcomeVariant: "live" | "won" | "lost";
};
