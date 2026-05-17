import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  Keypair,
  PublicKey,
  type Commitment,
} from "@solana/web3.js";

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

/** Fetch accounts without a connected wallet (no signing). */
export function createLotteryReadOnlyProgram(
  connection: Connection,
  commitment: Commitment = "confirmed",
): SlottoLotteryProgram {
  const keypair = Keypair.generate();
  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async () => {
      throw new Error("read-only program client");
    },
    signAllTransactions: async () => {
      throw new Error("read-only program client");
    },
  };
  return createLotteryProgram(connection, wallet, commitment);
}
