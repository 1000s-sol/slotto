import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, type Commitment } from "@solana/web3.js";

import idl from "../../../idl/slotto_lottery.json";

import { lotteryProgramId } from "./config";
import type { SlottoLottery } from "./slotto_lottery";

export type SlottoLotteryProgram = Program<SlottoLottery>;

export function createLotteryProgram(
  connection: Connection,
  wallet: AnchorWallet,
  commitment: Commitment = "confirmed",
): SlottoLotteryProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment,
    preflightCommitment: commitment,
  });
  return new Program(idl as SlottoLottery, provider);
}

export function lotteryProgramIdKey(): PublicKey {
  return lotteryProgramId();
}
