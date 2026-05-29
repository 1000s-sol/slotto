import type { WalletAdapter } from "@solana/wallet-adapter-base";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";

export type WalletSendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: { skipPreflight?: boolean },
) => Promise<TransactionSignature>;

export type LotteryWalletSendOpts = {
  sendTransaction?: WalletSendTransaction;
  adapter?: WalletAdapter | null;
};

type PhantomSolana = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  signAndSendTransaction: (
    transaction: Transaction,
    options?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string } | string>;
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/**
 * Build, sign, and send a legacy transaction. Tries Phantom's injected API first,
 * then wallet-adapter sendTransaction (with prepareTransaction), then signTransaction.
 */
export async function sendTransactionViaWallet(
  connection: Connection,
  wallet: AnchorWallet,
  buildTransaction: () => Promise<Transaction>,
  opts?: LotteryWalletSendOpts,
): Promise<TransactionSignature> {
  let tx = await buildTransaction();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const feePayer = opts?.adapter?.publicKey ?? wallet.publicKey;
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;

  if (
    opts?.adapter &&
    "prepareTransaction" in opts.adapter &&
    typeof opts.adapter.prepareTransaction === "function"
  ) {
    tx = await opts.adapter.prepareTransaction(tx, connection, {
      preflightCommitment: "confirmed",
    });
  }

  if (typeof window !== "undefined") {
    const phantom = (
      window as Window & { phantom?: { solana?: PhantomSolana } }
    ).phantom?.solana;
    if (
      phantom?.isPhantom &&
      phantom.publicKey &&
      feePayer.equals(phantom.publicKey)
    ) {
      try {
        const result = await phantom.signAndSendTransaction(tx, {
          skipPreflight: false,
        });
        const signature =
          typeof result === "string" ? result : result.signature;
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        return signature;
      } catch (e) {
        const msg = errorText(e).toLowerCase();
        if (msg.includes("user rejected") || msg.includes("user declined")) {
          throw e;
        }
      }
    }
  }

  if (opts?.sendTransaction) {
    try {
      const signature = await opts.sendTransaction(tx, connection, {
        skipPreflight: false,
      });
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      return signature;
    } catch (e) {
      const msg = errorText(e).toLowerCase();
      if (
        !msg.includes("no signers") &&
        !msg.includes("no signer")
      ) {
        throw e;
      }
    }
  }

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}
